import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  hasAdminPermission,
  requireAdminSession,
  writeAdminAuditLog,
} from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { calculateNegotiationKpis } from "@/lib/crm-negotiation-rules";
import { sendCommercialClientReminder } from "@/lib/commercial-communications";
import type {
  CommercialNegotiation,
  NegotiationDocument,
  NegotiationExchange,
  NegotiationKpis,
  NegotiationStatus,
  NegotiationStep,
  OfferFinancingType,
} from "@/types/crm";
import type { Json, Tables } from "@/types/supabase";

const negotiationStatuses = [
  "IN_PROGRESS",
  "WAITING_SELLER",
  "WAITING_BUYER",
  "COUNTER_OFFER",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CONCLUDED",
] as const;

const counterOfferSchema = z.object({
  action: z.literal("counter-offer"),
  negotiationId: z.string().uuid(),
  amount: z.number().positive(),
  authorRole: z.enum(["BUYER", "SELLER"]),
  comment: z.string().trim().min(2).max(4000),
  responseDeadline: z.string().date(),
});

const decisionSchema = z
  .object({
    action: z.literal("decision"),
    negotiationId: z.string().uuid(),
    decision: z.enum(["ACCEPTED", "REJECTED"]),
    comment: z.string().trim().max(4000).default(""),
  })
  .superRefine((value, context) => {
    if (value.decision === "REJECTED" && value.comment.length < 3) {
      context.addIssue({
        code: "custom",
        path: ["comment"],
        message: "Le motif du refus est obligatoire.",
      });
    }
  });

const remindSchema = z.object({
  action: z.literal("remind"),
  negotiationId: z.string().uuid(),
  comment: z.string().trim().min(2).max(1000),
});

const clientReminderSchema = z.object({
  action: z.literal("client-reminder"),
  negotiationId: z.string().uuid(),
  recipientRole: z.enum(["BUYER", "SELLER"]),
  channel: z.enum(["EMAIL", "SMS"]),
  subject: z.string().trim().min(2).max(180),
  message: z.string().trim().min(4).max(2000),
});

const mutationSchema = z.union([
  counterOfferSchema,
  decisionSchema,
  remindSchema,
  clientReminderSchema,
]);

type NegotiationRow = Tables<"negotiations">;

function numberValue(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactIds(values: Array<string | null | undefined>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function firstPropertyImage(photos: Json) {
  if (typeof photos === "string") return photos || null;
  if (!Array.isArray(photos)) return null;
  for (const photo of photos) {
    if (typeof photo === "string" && photo) return photo;
    if (photo && typeof photo === "object" && !Array.isArray(photo)) {
      const candidate = photo.url ?? photo.src ?? photo.path;
      if (typeof candidate === "string" && candidate) return candidate;
    }
  }
  return null;
}

function kpisFor(rows: NegotiationRow[]): NegotiationKpis {
  return calculateNegotiationKpis(
    rows.map((row) => ({
      status: row.status as NegotiationStatus,
      currentAmount: numberValue(row.current_amount),
      currentGapPercent: numberValue(row.current_gap_percent),
      isUrgent: row.is_urgent,
      daysWithoutActivity: row.days_without_activity,
      concludedAt: row.concluded_at,
    })),
  );
}

function migrationResponse(message?: string) {
  const missing = /negotiations|negotiation_steps|schema cache/i.test(
    message ?? "",
  );
  return NextResponse.json(
    {
      success: false,
      error: {
        code: missing
          ? "NEGOTIATIONS_MIGRATION_REQUIRED"
          : "NEGOTIATIONS_READ_FAILED",
      },
      message: missing
        ? "La migration 202608130001 du hub Négociations doit être appliquée."
        : "Les négociations n'ont pas pu être chargées.",
    },
    { status: missing ? 503 : 500 },
  );
}

async function loadNegotiations(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return {
      response: NextResponse.json(
        { success: false, message: "Supabase serveur n'est pas configuré." },
        { status: 503 },
      ),
    };

  const id = request.nextUrl.searchParams.get("id");
  const requestedStatus = request.nextUrl.searchParams.get("status");
  const status = negotiationStatuses.includes(
    requestedStatus as (typeof negotiationStatuses)[number],
  )
    ? (requestedStatus as NegotiationStatus)
    : null;
  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit")) || 100, 1),
    200,
  );

  let query = supabase
    .from("negotiations")
    .select("*")
    .order("is_urgent", { ascending: false })
    .order("response_deadline", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (id) query = query.eq("id", id);
  if (status) query = query.eq("status", status);

  const negotiationsResult = await query;
  if (negotiationsResult.error)
    return { response: migrationResponse(negotiationsResult.error.message) };
  const negotiationRows: NegotiationRow[] = negotiationsResult.data ?? [];
  const negotiationIds = compactIds(negotiationRows.map((row) => row.id));
  const propertyIds = compactIds(negotiationRows.map((row) => row.property_id));
  const contactIds = compactIds(
    negotiationRows.flatMap((row) => [
      row.buyer_contact_id,
      row.seller_contact_id,
    ]),
  );
  const profileIds = compactIds(
    negotiationRows.map((row) => row.responsible_user_id),
  );
  const offerIds = compactIds(negotiationRows.map((row) => row.offer_id));

  const [
    propertiesResult,
    contactsResult,
    profilesResult,
    offersResult,
    stepsResult,
    exchangesResult,
    documentsResult,
  ] = await Promise.all([
    propertyIds.length
      ? supabase
          .from("properties")
          .select("id,slug,reference,title,city,postal_code,photos")
          .in("id", propertyIds)
      : Promise.resolve({ data: [], error: null }),
    contactIds.length
      ? supabase
          .from("contacts")
          .select("id,name,email,phone")
          .in("id", contactIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    offerIds.length
      ? supabase
          .from("offers")
          .select(
            "id,financing_type,down_payment_amount,loan_amount,suspensive_conditions,included_furniture",
          )
          .in("id", offerIds)
      : Promise.resolve({ data: [], error: null }),
    negotiationIds.length
      ? supabase
          .from("negotiation_steps")
          .select("*")
          .in("negotiation_id", negotiationIds)
          .order("step_number")
      : Promise.resolve({ data: [], error: null }),
    negotiationIds.length
      ? supabase
          .from("negotiation_exchanges")
          .select("*")
          .in("negotiation_id", negotiationIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    negotiationIds.length
      ? supabase
          .from("negotiation_documents")
          .select(
            "id,negotiation_id,file_name,document_type,mime_type,created_at",
          )
          .in("negotiation_id", negotiationIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const relationError =
    propertiesResult.error ??
    contactsResult.error ??
    profilesResult.error ??
    offersResult.error ??
    stepsResult.error ??
    exchangesResult.error ??
    documentsResult.error;
  if (relationError)
    return { response: migrationResponse(relationError.message) };

  const properties = new Map(
    (propertiesResult.data ?? []).map((row) => [row.id, row]),
  );
  const contacts = new Map(
    (contactsResult.data ?? []).map((row) => [row.id, row]),
  );
  const profiles = new Map(
    (profilesResult.data ?? []).map((row) => [row.id, row]),
  );
  const offers = new Map((offersResult.data ?? []).map((row) => [row.id, row]));
  const stepRows = stepsResult.data ?? [];
  const exchangeRows = exchangesResult.data ?? [];
  const documentRows = documentsResult.data ?? [];

  const data: CommercialNegotiation[] = negotiationRows.map((row) => {
    const property = properties.get(row.property_id);
    const buyer = contacts.get(row.buyer_contact_id);
    const seller = row.seller_contact_id
      ? contacts.get(row.seller_contact_id)
      : null;
    const responsible = profiles.get(row.responsible_user_id);
    const offer = offers.get(row.offer_id);
    const steps: NegotiationStep[] = stepRows
      .filter((step) => step.negotiation_id === row.id)
      .map((step) => ({
        id: step.id,
        stepNumber: step.step_number,
        label: step.label,
        amount: step.amount == null ? null : numberValue(step.amount),
        authorRole: step.author_role as NegotiationStep["authorRole"],
        status: step.step_status as NegotiationStep["status"],
        isCurrent: step.is_current,
        comment: step.comment,
        createdAt: step.created_at,
      }));
    const exchanges: NegotiationExchange[] = exchangeRows
      .filter((exchange) => exchange.negotiation_id === row.id)
      .map((exchange) => ({
        id: exchange.id,
        type: exchange.exchange_type,
        amount: exchange.amount == null ? null : numberValue(exchange.amount),
        authorName: exchange.author_name,
        comment: exchange.comment,
        isInternalNote: exchange.is_internal_note,
        createdAt: exchange.created_at,
      }));
    const documents: NegotiationDocument[] = documentRows
      .filter((document) => document.negotiation_id === row.id)
      .map((document) => ({
        id: document.id,
        fileName: document.file_name,
        documentType: document.document_type,
        mimeType: document.mime_type,
        createdAt: document.created_at,
      }));

    return {
      id: row.id,
      offerId: row.offer_id,
      property: {
        id: row.property_id,
        slug: property?.slug ?? null,
        reference: property?.reference ?? null,
        title: property?.title ?? "Bien sans titre",
        city: property?.city ?? "Localisation non renseignée",
        postalCode: property?.postal_code ?? null,
        imageUrl: property ? firstPropertyImage(property.photos) : null,
      },
      buyer: {
        id: buyer?.id ?? row.buyer_contact_id,
        name: buyer?.name ?? "Acquéreur non renseigné",
        email: buyer?.email ?? null,
        phone: buyer?.phone ?? null,
      },
      seller: seller
        ? {
            id: seller.id,
            name: seller.name,
            email: seller.email,
            phone: seller.phone,
          }
        : null,
      responsible: {
        id: responsible?.id ?? row.responsible_user_id,
        name:
          responsible?.full_name ??
          responsible?.email ??
          "Conseiller non renseigné",
        email: responsible?.email ?? null,
        phone: null,
      },
      status: row.status as NegotiationStatus,
      initialAmount: numberValue(row.initial_amount),
      currentAmount: numberValue(row.current_amount),
      askingPrice: numberValue(row.asking_price),
      currentGapPercent: numberValue(row.current_gap_percent),
      currentStep: row.current_step,
      totalSteps: row.total_steps,
      responseDeadline: row.response_deadline,
      isUrgent: row.is_urgent,
      daysWithoutActivity: row.days_without_activity,
      lastActivityAt: row.last_activity_at,
      finalAmount:
        row.final_amount == null ? null : numberValue(row.final_amount),
      concludedAt: row.concluded_at,
      internalNotes: row.internal_notes,
      financingType: (offer?.financing_type ?? "UNKNOWN") as OfferFinancingType,
      downPaymentAmount: offer?.down_payment_amount ?? null,
      loanAmount: offer?.loan_amount ?? null,
      suspensiveConditions: offer?.suspensive_conditions ?? null,
      includedFurniture: offer?.included_furniture ?? null,
      steps,
      exchanges,
      documents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  return { data, kpis: kpisFor(negotiationRows), response: null };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const result = await loadNegotiations(request);
  if (result.response) return result.response;
  return NextResponse.json({
    success: true,
    source: "supabase",
    generatedAt: new Date().toISOString(),
    data: result.data,
    meta: {
      count: result.data?.length ?? 0,
      limit: Math.min(
        Number(request.nextUrl.searchParams.get("limit")) || 100,
        200,
      ),
    },
    kpis: result.kpis,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const parsed = mutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          fields: parsed.error.flatten().fieldErrors,
        },
        message: "Données de négociation invalides.",
      },
      { status: 400 },
    );
  }
  if (!hasAdminPermission(auth.session.profile.role, "offer.write")) {
    return NextResponse.json(
      {
        success: false,
        message: "Droits insuffisants pour modifier une négociation.",
      },
      { status: 403 },
    );
  }
  if (
    parsed.data.action === "decision" &&
    !hasAdminPermission(auth.session.profile.role, "offer.decide")
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Seule la direction peut accepter ou refuser une offre.",
      },
      { status: 403 },
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return NextResponse.json(
      { success: false, message: "Supabase serveur n'est pas configuré." },
      { status: 503 },
    );

  const { data: negotiation, error: negotiationError } = await supabase
    .from("negotiations")
    .select(
      "id,responsible_user_id,status,buyer_contact_id,seller_contact_id,property_id,offer_id",
    )
    .eq("id", parsed.data.negotiationId)
    .maybeSingle();
  if (negotiationError) return migrationResponse(negotiationError.message);
  const current = negotiation;
  if (!current)
    return NextResponse.json(
      { success: false, message: "Négociation introuvable." },
      { status: 404 },
    );
  if (
    auth.session.profile.role === "AGENT" &&
    current.responsible_user_id !== auth.session.user.id
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Cette négociation est assignée à un autre conseiller.",
      },
      { status: 403 },
    );
  }
  if (
    ["ACCEPTED", "REJECTED", "EXPIRED", "CONCLUDED"].includes(current.status)
  ) {
    return NextResponse.json(
      { success: false, message: "Cette négociation est déjà clôturée." },
      { status: 409 },
    );
  }

  const actorName = auth.session.profile.full_name ?? auth.session.user.email;
  if (parsed.data.action === "counter-offer") {
    const { data, error } = await supabase.rpc("add_negotiation_proposal", {
      p_negotiation_id: parsed.data.negotiationId,
      p_amount: parsed.data.amount,
      p_author_role: parsed.data.authorRole,
      p_comment: parsed.data.comment,
      p_response_deadline: parsed.data.responseDeadline,
      p_actor_id: auth.session.user.id,
      p_actor_name: actorName,
    });
    if (error) return migrationResponse(error.message);
    await writeAdminAuditLog(
      auth.session,
      "commercial.negotiation.counter_offer",
      "negotiation",
      parsed.data.negotiationId,
      {
        amount: parsed.data.amount,
        authorRole: parsed.data.authorRole,
        responseDeadline: parsed.data.responseDeadline,
      },
    );
    return NextResponse.json(
      {
        success: true,
        stepId: data,
        message: "Contre-proposition enregistrée.",
      },
      { status: 201 },
    );
  }

  if (parsed.data.action === "decision") {
    const { error } = await supabase.rpc("decide_negotiation", {
      p_negotiation_id: parsed.data.negotiationId,
      p_status: parsed.data.decision,
      p_comment: parsed.data.comment,
      p_actor_id: auth.session.user.id,
      p_actor_name: actorName,
    });
    if (error) return migrationResponse(error.message);
    await writeAdminAuditLog(
      auth.session,
      "commercial.negotiation.decision",
      "negotiation",
      parsed.data.negotiationId,
      {
        decision: parsed.data.decision,
        comment: parsed.data.comment || null,
      },
    );
    return NextResponse.json({
      success: true,
      message:
        parsed.data.decision === "ACCEPTED"
          ? "Offre acceptée."
          : "Offre refusée.",
    });
  }

  if (parsed.data.action === "client-reminder") {
    const contactId =
      parsed.data.recipientRole === "SELLER"
        ? current.seller_contact_id
        : current.buyer_contact_id;
    if (!contactId) {
      return NextResponse.json(
        {
          success: false,
          message: "Le destinataire n'est pas relié à cette négociation.",
        },
        { status: 409 },
      );
    }
    const { data: recipient, error: recipientError } = await supabase
      .from("contacts")
      .select("id,name,email,phone")
      .eq("id", contactId)
      .maybeSingle();
    if (recipientError) return migrationResponse(recipientError.message);
    if (!recipient) {
      return NextResponse.json(
        { success: false, message: "Destinataire introuvable." },
        { status: 404 },
      );
    }
    const destination =
      parsed.data.channel === "EMAIL" ? recipient.email : recipient.phone;
    if (!destination) {
      return NextResponse.json(
        {
          success: false,
          message: `Aucune coordonnée ${parsed.data.channel === "EMAIL" ? "email" : "SMS"} disponible.`,
        },
        { status: 409 },
      );
    }
    const sent = await sendCommercialClientReminder({
      channel: parsed.data.channel,
      recipient: destination,
      recipientName: recipient.name,
      subject: parsed.data.subject,
      message: parsed.data.message,
      negotiationId: current.id,
    });
    if (!sent.sent) {
      await writeAdminAuditLog(
        auth.session,
        "commercial.negotiation.client_reminder.unavailable",
        "negotiation",
        current.id,
        { channel: parsed.data.channel, reason: sent.reason },
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code:
              sent.reason === "provider_not_configured"
                ? "COMMUNICATION_PROVIDER_NOT_CONFIGURED"
                : "COMMUNICATION_PROVIDER_ERROR",
          },
          message:
            sent.reason === "provider_not_configured"
              ? "Relance client non envoyée : aucun fournisseur email/SMS n'est configuré. Aucune note interne n'a été créée à sa place."
              : "Le fournisseur de communication a refusé l'envoi. Aucun envoi n'est annoncé comme réussi.",
        },
        { status: 503 },
      );
    }
    const sentAt = new Date().toISOString();
    const [exchange, communication, negotiationUpdate] = await Promise.all([
      supabase.from("negotiation_exchanges").insert({
        negotiation_id: current.id,
        exchange_type: `Relance client ${parsed.data.channel}`,
        author_id: auth.session.user.id,
        author_name: actorName,
        comment: parsed.data.message,
        is_internal_note: false,
      }),
      supabase.from("communications").insert({
        contact_id: recipient.id,
        channel: parsed.data.channel,
        direction: "OUTBOUND",
        subject: parsed.data.subject,
        body: parsed.data.message,
        created_by: auth.session.user.id,
      }),
      supabase
        .from("negotiations")
        .update({ last_activity_at: sentAt })
        .eq("id", current.id),
    ]);
    const persistenceError =
      exchange.error ?? communication.error ?? negotiationUpdate.error;
    if (persistenceError) return migrationResponse(persistenceError.message);
    await writeAdminAuditLog(
      auth.session,
      "commercial.negotiation.client_reminder.sent",
      "negotiation",
      current.id,
      {
        channel: parsed.data.channel,
        provider: sent.provider,
        providerMessageId: sent.providerMessageId,
      },
    );
    return NextResponse.json({
      success: true,
      sent: true,
      message: `Relance client envoyée par ${parsed.data.channel}.`,
    });
  }

  const now = new Date().toISOString();
  const { error: exchangeError } = await supabase
    .from("negotiation_exchanges")
    .insert({
      negotiation_id: parsed.data.negotiationId,
      exchange_type: "Relance interne",
      author_id: auth.session.user.id,
      author_name: actorName,
      comment: parsed.data.comment,
      is_internal_note: true,
    });
  if (exchangeError) return migrationResponse(exchangeError.message);
  const { error: updateError } = await supabase
    .from("negotiations")
    .update({ last_activity_at: now })
    .eq("id", parsed.data.negotiationId);
  if (updateError) return migrationResponse(updateError.message);
  await writeAdminAuditLog(
    auth.session,
    "commercial.negotiation.remind",
    "negotiation",
    parsed.data.negotiationId,
    {
      comment: parsed.data.comment,
    },
  );
  return NextResponse.json({
    success: true,
    message:
      "Note interne de relance enregistrée. Aucun message client n'a été envoyé.",
  });
}

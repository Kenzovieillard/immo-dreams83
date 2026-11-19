import { NextRequest, NextResponse } from "next/server";
import {
  hasAdminPermission,
  requireAdminSession,
  writeAdminAuditLog,
} from "@/lib/admin-auth";
import { isCommercialOfferStatus } from "@/lib/crm";
import {
  canTransitionCommercialOfferStatus,
  getPropertyOfferIneligibility,
  isAssignableActiveProfile,
  isCommercialOfferExpired,
} from "@/lib/crm-pipeline-rules";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  CommercialOfferStatus,
  OfferFinancingType,
} from "@/types/crm";
import type { TablesUpdate } from "@/types/supabase";

type JsonRecord = Record<string, unknown>;

type OfferStatusRow = {
  id: string;
  property_id: string;
  status: string;
  valid_until: string;
  rejection_reason: string | null;
  withdrawal_reason: string | null;
  is_test: boolean;
};

const financingTypes = new Set<OfferFinancingType>(["CASH", "LOAN", "MIXED", "UNKNOWN"]);
function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(value: unknown) {
  return getString(value) || null;
}

function getPositiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(getString(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getOptionalPositiveNumber(value: unknown) {
  if (value == null || getString(value) === "") return null;
  return getPositiveNumber(value);
}

function getDate(value: unknown) {
  const date = getString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function getDateTime(value: unknown) {
  const raw = getString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getFinancingType(value: unknown): OfferFinancingType {
  return financingTypes.has(value as OfferFinancingType) ? (value as OfferFinancingType) : "UNKNOWN";
}

async function loadAssignableProfile(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  profileId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,is_active")
    .eq("id", profileId)
    .maybeSingle();

  if (error) return { profile: null, error };
  if (!data || !isAssignableActiveProfile(data)) {
    return { profile: null, error: null };
  }
  return { profile: data, error: null };
}

async function loadOffer(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  offerId: string
) {
  const result = await supabase
    .from("offers")
    .select([
      "id",
      "property_id",
      "buyer_dossier_id",
      "buyer_contact_id",
      "responsible_user_id",
      "status",
      "valid_until",
      "rejection_reason",
      "withdrawal_reason",
      "is_test",
    ].join(","))
    .eq("id", offerId)
    .maybeSingle();

  return {
    ...result,
    data: result.data as OfferStatusRow | null,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("offer.write");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as JsonRecord | null;
  if (!payload) {
    return NextResponse.json({ success: false, message: "Données d'offre invalides." }, { status: 400 });
  }

  const propertyId = getString(payload.propertyId);
  const buyerDossierId = getString(payload.buyerDossierId);
  const buyerContactId = getString(payload.buyerContactId);
  const requestedResponsibleId = getString(payload.responsibleUserId);
  const amount = getPositiveNumber(payload.amount);
  const offerDate = getDate(payload.offerDate);
  const validUntil = getDate(payload.validUntil);
  const nextAction = getString(payload.nextAction);
  const nextActionDueAt = getDateTime(payload.nextActionDueAt);

  if (
    !propertyId ||
    !buyerDossierId ||
    !buyerContactId ||
    !amount ||
    !offerDate ||
    !validUntil ||
    !nextAction ||
    !nextActionDueAt
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Bien, dossier, acquéreur, montant, dates et prochaine action sont obligatoires.",
      },
      { status: 400 }
    );
  }
  if (validUntil < offerDate) {
    return NextResponse.json(
      { success: false, message: "La date de validité doit être postérieure à la date de l'offre." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const [leadResult, propertyResult] = await Promise.all([
    supabase
      .from("leads")
      .select("id,contact_id,assigned_to,linked_property_id,status,archived")
      .eq("id", buyerDossierId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id,reference,title,status,commercial_status,publication_status,archived_at")
      .eq("id", propertyId)
      .maybeSingle(),
  ]);

  if (leadResult.error || propertyResult.error) {
    console.error(
      "[IMMO-DREAMS83] Offer relation validation failed",
      leadResult.error?.message ?? propertyResult.error?.message
    );
    return NextResponse.json(
      { success: false, message: "Le dossier ou le bien n'a pas pu être vérifié." },
      { status: 500 }
    );
  }

  const lead = leadResult.data;
  const property = propertyResult.data;
  if (!lead || lead.archived || lead.status === "LOST") {
    return NextResponse.json(
      { success: false, message: "Le dossier acquéreur n'est plus actif." },
      { status: 409 }
    );
  }
  if (lead.contact_id !== buyerContactId) {
    return NextResponse.json(
      { success: false, message: "L'acquéreur ne correspond pas au contact principal du dossier." },
      { status: 409 }
    );
  }

  const propertyIneligibility = getPropertyOfferIneligibility(
    property
      ? {
          status: property.status,
          commercialStatus: property.commercial_status,
          publicationStatus: property.publication_status,
          archivedAt: property.archived_at,
        }
      : null
  );
  if (propertyIneligibility) {
    return NextResponse.json(
      { success: false, message: "Ce bien n'est pas éligible à une nouvelle offre." },
      { status: 409 }
    );
  }

  const responsibleUserId = requestedResponsibleId || lead.assigned_to || auth.session.user.id;
  const responsibleResult = await loadAssignableProfile(supabase, responsibleUserId);
  if (responsibleResult.error) {
    console.error("[IMMO-DREAMS83] Offer responsible validation failed", responsibleResult.error.message);
    return NextResponse.json(
      { success: false, message: "Le responsable de l'offre n'a pas pu être vérifié." },
      { status: 500 }
    );
  }
  if (!responsibleResult.profile) {
    return NextResponse.json(
      { success: false, message: "Choisissez un agent actif autorisé comme responsable." },
      { status: 400 }
    );
  }

  const financingType = getFinancingType(payload.financingType);
  const offeredAt = `${offerDate}T12:00:00.000Z`;
  const expiresAt = `${validUntil}T23:59:59.999Z`;
  const insertRecord = {
    lead_id: buyerDossierId,
    contact_id: buyerContactId,
    property_id: propertyId,
    assigned_to: responsibleUserId,
    buyer_dossier_id: buyerDossierId,
    buyer_contact_id: buyerContactId,
    responsible_user_id: responsibleUserId,
    created_by: auth.session.user.id,
    amount,
    status: "DRAFT",
    offered_at: offeredAt,
    expires_at: expiresAt,
    offer_date: offerDate,
    valid_until: validUntil,
    next_action: nextAction,
    next_action_due_at: nextActionDueAt,
    financing_type: financingType,
    down_payment_amount: getOptionalPositiveNumber(payload.downPaymentAmount),
    loan_amount: getOptionalPositiveNumber(payload.loanAmount),
    suspensive_conditions: getNullableString(payload.suspensiveConditions),
    included_furniture: getNullableString(payload.includedFurniture),
    negotiation_comment: getNullableString(payload.negotiationComment),
    notes: getNullableString(payload.negotiationComment),
    created_from_visit_id: getNullableString(payload.createdFromVisitId),
    is_test: false,
  };

  const { data: offer, error: createError } = await supabase
    .from("offers")
    .insert(insertRecord)
    .select("id,status")
    .single();

  if (createError || !offer) {
    console.error("[IMMO-DREAMS83] Offer creation failed", createError?.message);
    const migrationMissing = /buyer_dossier_id|next_action|financing_type/i.test(createError?.message ?? "");
    return NextResponse.json(
      {
        success: false,
        message: migrationMissing
          ? "La migration opérationnelle des offres doit être appliquée avant cette action."
          : "L'offre n'a pas pu être enregistrée.",
      },
      { status: migrationMissing ? 503 : 500 }
    );
  }

  await supabase.from("offer_status_history").insert({
    offer_id: offer.id,
    previous_status: null,
    next_status: "DRAFT",
    changed_by: auth.session.user.id,
    metadata: { source: "crm.offer.create" },
  });
  if (!lead.linked_property_id) {
    await supabase.from("leads").update({ linked_property_id: propertyId }).eq("id", buyerDossierId);
  }
  await supabase.from("activities").insert({
    entity_type: "offer",
    entity_id: offer.id,
    action: `Offre créée · ${property?.reference ?? property?.title ?? propertyId}`,
    user_name: auth.session.profile.full_name ?? auth.session.user.email,
  });
  await writeAdminAuditLog(auth.session, "offer.create", "offer", offer.id, {
    buyerDossierId,
    buyerContactId,
    propertyId,
    responsibleUserId,
    amount,
    status: "DRAFT",
  });

  return NextResponse.json(
    { success: true, message: "Brouillon d'offre créé.", offerId: offer.id },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession("offer.write");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as JsonRecord | null;
  const offerId = getString(payload?.id);
  const nextStatusValue = getString(payload?.status);
  if (!offerId || !isCommercialOfferStatus(nextStatusValue)) {
    return NextResponse.json({ success: false, message: "Offre ou statut invalide." }, { status: 400 });
  }

  const nextStatus = nextStatusValue as CommercialOfferStatus;
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const currentResult = await loadOffer(supabase, offerId);
  if (currentResult.error) {
    console.error("[IMMO-DREAMS83] Offer status read failed", currentResult.error.message);
    return NextResponse.json({ success: false, message: "L'offre n'a pas pu être relue." }, { status: 500 });
  }
  const currentOffer = currentResult.data;
  if (!currentOffer || currentOffer.is_test) {
    return NextResponse.json({ success: false, message: "Offre introuvable." }, { status: 404 });
  }

  const currentStatus = currentOffer.status as CommercialOfferStatus;
  if (!isCommercialOfferStatus(currentStatus) || !canTransitionCommercialOfferStatus(currentStatus, nextStatus)) {
    return NextResponse.json(
      { success: false, message: "Cette transition de statut n'est pas autorisée." },
      { status: 409 }
    );
  }
  if (
    (nextStatus === "ACCEPTED" || nextStatus === "REJECTED") &&
    !hasAdminPermission(auth.session.profile.role, "offer.decide")
  ) {
    return NextResponse.json(
      { success: false, message: "Seule la direction peut accepter ou refuser une offre." },
      { status: 403 }
    );
  }
  if (nextStatus === "ACCEPTED" && isCommercialOfferExpired(currentOffer.valid_until)) {
    return NextResponse.json(
      { success: false, message: "Une offre expirée doit être réactivée explicitement avant acceptation." },
      { status: 409 }
    );
  }

  const reason = getNullableString(payload?.reason);
  if ((nextStatus === "REJECTED" || nextStatus === "WITHDRAWN") && !reason) {
    return NextResponse.json(
      { success: false, message: "Une raison est obligatoire pour refuser ou retirer l'offre." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const updates: TablesUpdate<"offers"> = { status: nextStatus };
  if (nextStatus === "SENT_TO_SELLER") updates.submitted_to_seller_at = now;
  if (nextStatus === "ACCEPTED") updates.accepted_at = now;
  if (nextStatus === "REJECTED") {
    updates.rejected_at = now;
    updates.rejection_reason = reason;
  }
  if (nextStatus === "WITHDRAWN") {
    updates.withdrawn_at = now;
    updates.withdrawal_reason = reason;
  }

  const { error: updateError } = await supabase.from("offers").update(updates).eq("id", offerId);
  if (updateError) {
    console.error("[IMMO-DREAMS83] Offer status update failed", updateError.message);
    return NextResponse.json({ success: false, message: "Le statut de l'offre n'a pas pu être modifié." }, { status: 500 });
  }

  await supabase.from("offer_status_history").insert({
    offer_id: offerId,
    previous_status: currentStatus,
    next_status: nextStatus,
    reason,
    changed_by: auth.session.user.id,
  });

  let propertyUpdated = false;
  if (nextStatus === "ACCEPTED" && payload?.confirmPropertyUnderOffer === true) {
    const { data: property } = await supabase
      .from("properties")
      .select("*")
      .eq("id", currentOffer.property_id)
      .maybeSingle();
    if (property) {
      await supabase.from("property_versions").insert({
        property_id: property.id,
        reference: property.reference,
        snapshot: property,
        changed_by: auth.session.user.id,
        change_reason: "offer.accepted.confirm_under_offer",
      });
      const { error: propertyError } = await supabase
        .from("properties")
        .update({
          status: "under_offer",
          commercial_status: "UNDER_OFFER",
          updated_by: auth.session.user.id,
        })
        .eq("id", currentOffer.property_id);
      propertyUpdated = !propertyError;
    }
  }

  await writeAdminAuditLog(auth.session, "offer.status.update", "offer", offerId, {
    previousStatus: currentStatus,
    nextStatus,
    reason,
    propertyUpdated,
  });

  return NextResponse.json({
    success: true,
    message: propertyUpdated
      ? "Offre mise à jour et bien passé sous offre."
      : "Statut de l'offre mis à jour.",
  });
}

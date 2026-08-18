import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { AdminSession } from "@/types/admin";
import type {
  CommercialContactOption,
  CommercialEstimationDetail,
  CommercialEstimationPayload,
  CommercialEstimationSummary,
  CommercialHistoryEntry,
  CommercialOfferDetail,
  CommercialOfferPayload,
  CommercialOfferSummary,
  CommercialPipelineCard,
  CommercialPipelineKind,
  CommercialPipelinePayload,
  CommercialPipelineStage,
  CommercialProfileOption,
  CommercialPropertyOption,
  CommercialTask,
  CommercialVisitDetail,
  CommercialVisitPayload,
  CommercialVisitSummary,
} from "@/types/commercial";
import type { Database, Json } from "@/types/supabase";

type Tables = Database["public"]["Tables"];
type ContactRow = Tables["contacts"]["Row"];
type PropertyRow = Tables["properties"]["Row"];
type ProfileRow = Tables["profiles"]["Row"];
type TaskRow = Tables["tasks"]["Row"];
type ActivityRow = Tables["activities"]["Row"];
type EstimationRow = Tables["estimations"]["Row"];
type AppointmentRow = Tables["appointments"]["Row"];
type OfferRow = Tables["offers"]["Row"];
type NegotiationRow = Tables["negotiations"]["Row"];

export class CommercialDataError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "CommercialDataError";
  }
}

function requiredClient() {
  const client = getSupabaseAdminClient();
  if (!client)
    throw new CommercialDataError("Supabase serveur n'est pas configuré.", 503);
  return client;
}

function assertNoError(error: { message: string } | null, context: string) {
  if (!error) return;
  console.error(`[IMMO-DREAMS83] ${context}`, error.message);
  throw new CommercialDataError(
    `Impossible de charger ${context.toLowerCase()}.`,
  );
}

function agentScope(session: AdminSession) {
  return session.profile.role === "AGENT" ? session.user.id : null;
}

function toNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringArray(value: Json | null): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function contactOptions(rows: ContactRow[]): CommercialContactOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    role: row.contact_role,
  }));
}

function propertyOptions(rows: PropertyRow[]): CommercialPropertyOption[] {
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    city: row.city,
    price: row.price,
    status: row.status,
    slug: row.slug,
  }));
}

function profileOptions(rows: ProfileRow[]): CommercialProfileOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.full_name ?? row.email,
    email: row.email,
    role: row.role,
  }));
}

function toTask(
  row: TaskRow,
  profiles: Map<string, ProfileRow>,
): CommercialTask {
  return {
    id: row.id,
    leadId: row.lead_id,
    appointmentId: row.appointment_id,
    offerId: row.offer_id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to
      ? (profiles.get(row.assigned_to)?.full_name ??
        profiles.get(row.assigned_to)?.email ??
        null)
      : null,
    completedAt: row.completed_at,
  };
}

function toHistory(row: ActivityRow): CommercialHistoryEntry {
  return {
    id: row.id,
    action: row.action,
    actorName: row.user_name,
    createdAt: row.created_at,
  };
}

async function loadReferenceData() {
  const supabase = requiredClient();
  const [contacts, properties, profiles, buyerCases] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("archived", false)
      .order("name")
      .limit(500),
    supabase
      .from("properties")
      .select("*")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .order("full_name")
      .limit(100),
    supabase
      .from("leads")
      .select("*")
      .eq("archived", false)
      .eq("pipeline_type", "BUYER")
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);
  assertNoError(contacts.error, "les contacts");
  assertNoError(properties.error, "les biens");
  assertNoError(profiles.error, "les conseillers");
  assertNoError(buyerCases.error, "les dossiers acquéreurs");
  return {
    contacts: contacts.data ?? [],
    properties: properties.data ?? [],
    profiles: profiles.data ?? [],
    buyerCases: buyerCases.data ?? [],
  };
}

export async function loadCommercialPipeline(
  session: AdminSession,
): Promise<CommercialPipelinePayload> {
  const supabase = requiredClient();
  const assignedTo = agentScope(session);
  let leadsQuery = supabase
    .from("leads")
    .select("*")
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (assignedTo) leadsQuery = leadsQuery.eq("assigned_to", assignedTo);

  const [
    leadsResult,
    reference,
    estimationsResult,
    tasksResult,
    visitsResult,
    offersResult,
    negotiationsResult,
    activitiesResult,
    statsResult,
  ] = await Promise.all([
    leadsQuery,
    loadReferenceData(),
    supabase
      .from("estimations")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("appointments")
      .select("*")
      .eq("appointment_type", "VISIT")
      .order("starts_at", { ascending: false })
      .limit(500),
    supabase
      .from("offers")
      .select("*")
      .eq("is_test", false)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("negotiations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1500),
    supabase.from("v_commercial_pipeline_stats").select("*"),
  ]);
  for (const [result, label] of [
    [leadsResult, "le pipeline"],
    [estimationsResult, "les estimations"],
    [tasksResult, "les tâches"],
    [visitsResult, "les visites"],
    [offersResult, "les offres"],
    [negotiationsResult, "les négociations"],
    [activitiesResult, "l'historique"],
    [statsResult, "les statistiques pipeline"],
  ] as const)
    assertNoError(result.error, label);

  const leads = leadsResult.data ?? [];
  const contacts = new Map(reference.contacts.map((row) => [row.id, row]));
  const properties = new Map(reference.properties.map((row) => [row.id, row]));
  const profiles = new Map(reference.profiles.map((row) => [row.id, row]));
  const estimations = new Map(
    (estimationsResult.data ?? []).map((row) => [row.id, row]),
  );
  const tasks = tasksResult.data ?? [];
  const visits = visitsResult.data ?? [];
  const offers = offersResult.data ?? [];
  const negotiations = negotiationsResult.data ?? [];
  const activities = activitiesResult.data ?? [];

  const cards: CommercialPipelineCard[] = leads.map((lead) => {
    const contact = lead.contact_id ? contacts.get(lead.contact_id) : undefined;
    const property = lead.linked_property_id
      ? properties.get(lead.linked_property_id)
      : undefined;
    const estimation = lead.estimation_id
      ? estimations.get(lead.estimation_id)
      : undefined;
    const cardTasks = tasks
      .filter((row) => row.lead_id === lead.id)
      .map((row) => toTask(row, profiles));
    const cardVisits = visits.filter(
      (row) =>
        row.lead_id === lead.id ||
        (lead.contact_id && row.contact_id === lead.contact_id),
    );
    const cardOffers = offers.filter(
      (row) => row.buyer_dossier_id === lead.id || row.lead_id === lead.id,
    );
    const offerIds = new Set(cardOffers.map((row) => row.id));
    const propertyIds = new Set(
      [
        lead.linked_property_id,
        ...cardOffers.map((row) => row.property_id),
      ].filter((id): id is string => Boolean(id)),
    );
    const cardNegotiations = negotiations.filter(
      (row) => offerIds.has(row.offer_id) || propertyIds.has(row.property_id),
    );
    const history = activities
      .filter((row) => row.entity_type === "lead" && row.entity_id === lead.id)
      .map(toHistory);
    const openTasks = cardTasks
      .filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status))
      .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
    const profile = lead.assigned_to
      ? profiles.get(lead.assigned_to)
      : undefined;
    return {
      id: lead.id,
      dossierReference: lead.dossier_reference ?? lead.id,
      pipelineType: lead.pipeline_type as CommercialPipelineKind,
      stage: (lead.pipeline_stage ??
        (lead.pipeline_type === "SELLER"
          ? "SELLER_NEW"
          : "BUYER_NEW")) as CommercialPipelineStage,
      status: lead.status,
      priority: lead.priority,
      isBlocked: lead.is_blocked,
      blockingReason: lead.blocking_reason,
      contactId: lead.contact_id,
      contactName: contact?.name ?? null,
      contactEmail: contact?.email ?? null,
      contactPhone: contact?.phone ?? null,
      propertyId: lead.linked_property_id,
      propertyTitle: property?.title ?? null,
      propertySlug: property?.slug ?? null,
      estimationId: lead.estimation_id,
      estimationLabel: estimation
        ? (estimation.commercial_reference ??
          estimation.property_address ??
          estimation.city)
        : null,
      assignedTo: lead.assigned_to,
      assignedToName: profile?.full_name ?? profile?.email ?? null,
      amount: lead.estimated_budget,
      nextAction: openTasks[0] ?? null,
      tasks: cardTasks,
      visitIds: cardVisits.map((row) => row.id),
      offerIds: cardOffers.map((row) => row.id),
      negotiationIds: cardNegotiations.map((row) => row.id),
      history,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      lastActivityAt: history[0]?.createdAt ?? null,
    };
  });

  const byStage = (statsResult.data ?? []).map((row) => ({
    pipelineType: row.pipeline_type ?? "BUYER",
    stage: row.pipeline_stage ?? "BUYER_NEW",
    count: toNumber(row.dossier_count),
    estimatedValue: toNumber(row.estimated_value),
    blocked: toNumber(row.blocked_count),
  }));
  const stats = assignedTo
    ? {
        total: cards.length,
        blocked: cards.filter((row) => row.isBlocked).length,
        estimatedValue: cards.reduce(
          (sum, row) => sum + toNumber(row.amount),
          0,
        ),
        byStage: Array.from(new Set(cards.map((row) => row.stage))).map(
          (stage) => {
            const rows = cards.filter((row) => row.stage === stage);
            return {
              pipelineType: rows[0]?.pipelineType ?? "BUYER",
              stage,
              count: rows.length,
              estimatedValue: rows.reduce(
                (sum, row) => sum + toNumber(row.amount),
                0,
              ),
              blocked: rows.filter((row) => row.isBlocked).length,
            };
          },
        ),
      }
    : {
        total: byStage.reduce((sum, row) => sum + row.count, 0),
        blocked: byStage.reduce((sum, row) => sum + row.blocked, 0),
        estimatedValue: byStage.reduce(
          (sum, row) => sum + row.estimatedValue,
          0,
        ),
        byStage,
      };
  const team = Array.from(new Set(cards.map((row) => row.assignedTo))).map(
    (profileId) => {
      const rows = cards.filter((row) => row.assignedTo === profileId);
      const profile = profileId ? profiles.get(profileId) : undefined;
      return {
        profileId,
        name: profile?.full_name ?? profile?.email ?? "Non assigné",
        dossierCount: rows.length,
        blockedCount: rows.filter((row) => row.isBlocked).length,
        estimatedValue: rows.reduce(
          (sum, row) => sum + toNumber(row.amount),
          0,
        ),
      };
    },
  );
  return {
    cards,
    stats,
    team,
    options: {
      profiles: profileOptions(reference.profiles),
      contacts: contactOptions(reference.contacts),
      properties: propertyOptions(reference.properties),
      estimations: (estimationsResult.data ?? []).map((row) => ({
        id: row.id,
        label:
          row.commercial_reference ??
          row.property_address ??
          `${row.property_type} - ${row.city}`,
        contactId: row.contact_id,
      })),
      sellerCases: leads
        .filter((row) => row.pipeline_type === "SELLER")
        .map((row) => ({
          id: row.id,
          label: row.dossier_reference ?? row.title ?? row.id,
          propertyId: row.linked_property_id,
        })),
    },
    permissions: {
      canWrite: session.profile.role !== "READ_ONLY",
      canAssign: ["ADMIN", "DIRECTOR"].includes(session.profile.role),
      canViewTeam: session.profile.role !== "AGENT",
    },
    generatedAt: new Date().toISOString(),
  };
}

function estimationSummary(
  row: EstimationRow,
  contacts: Map<string, ContactRow>,
  profiles: Map<string, ProfileRow>,
  properties: Map<string, PropertyRow>,
): CommercialEstimationSummary {
  const contact = row.contact_id ? contacts.get(row.contact_id) : undefined;
  const profile = row.assigned_to ? profiles.get(row.assigned_to) : undefined;
  const property = row.converted_property_id
    ? properties.get(row.converted_property_id)
    : undefined;
  return {
    id: row.id,
    reference: row.commercial_reference,
    contactId: row.contact_id,
    contactName: contact?.name ?? row.name,
    contactEmail: contact?.email ?? row.email,
    contactPhone: contact?.phone ?? row.phone,
    address: row.property_address ?? "Adresse non renseignée",
    city: row.city,
    postalCode: row.postal_code,
    propertyType: row.property_type,
    surface: row.surface,
    rooms: row.rooms,
    appointmentAt: row.appointment_at,
    timeSlot: row.time_slot,
    assignedTo: row.assigned_to,
    assignedToName: profile?.full_name ?? profile?.email ?? null,
    status: row.commercial_status,
    estimatedValue: row.estimated_value,
    estimateLow: row.estimate_low,
    estimateHigh: row.estimate_high,
    reportAvailable: Boolean(row.report_storage_path),
    convertedPropertyId: row.converted_property_id,
    convertedPropertySlug: property?.slug ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadCommercialEstimations(
  session: AdminSession,
  options: {
    id?: string | null;
    query?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<CommercialEstimationPayload> {
  const supabase = requiredClient();
  const assignedTo = agentScope(session);
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 30));
  let query = supabase
    .from("estimations")
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(500);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (options.status) query = query.eq("commercial_status", options.status);
  const [rowsResult, reference, activitiesResult, statsResult] =
    await Promise.all([
      query,
      loadReferenceData(),
      supabase
        .from("activities")
        .select("*")
        .eq("entity_type", "estimation")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("v_commercial_estimation_stats").select("*").maybeSingle(),
    ]);
  assertNoError(rowsResult.error, "les estimations");
  assertNoError(activitiesResult.error, "l'historique des estimations");
  assertNoError(statsResult.error, "les statistiques des estimations");
  const contacts = new Map(reference.contacts.map((row) => [row.id, row]));
  const profiles = new Map(reference.profiles.map((row) => [row.id, row]));
  const properties = new Map(reference.properties.map((row) => [row.id, row]));
  const all = (rowsResult.data ?? []).map((row) =>
    estimationSummary(row, contacts, profiles, properties),
  );
  const normalizedQuery = options.query?.trim().toLocaleLowerCase("fr") ?? "";
  const filtered = normalizedQuery
    ? all.filter((row) =>
        [
          row.reference,
          row.contactName,
          row.contactEmail,
          row.address,
          row.city,
        ].some((value) =>
          value?.toLocaleLowerCase("fr").includes(normalizedQuery),
        ),
      )
    : all;
  const items = filtered.slice((page - 1) * limit, page * limit);
  const row = options.id
    ? (rowsResult.data ?? []).find((item) => item.id === options.id)
    : undefined;
  let detail: CommercialEstimationDetail | null = null;
  if (row) {
    const base = estimationSummary(row, contacts, profiles, properties);
    const comparables: Json[] = Array.isArray(row.market_comparables)
      ? row.market_comparables
      : [];
    detail = {
      ...base,
      constructionYear: row.construction_year,
      propertyCondition: row.property_condition,
      appointmentLocation: row.appointment_location,
      durationMinutes: row.duration_minutes,
      notes: row.notes ?? row.message,
      marketComparables: comparables
        .filter(
          (item): item is Record<string, Json | undefined> =>
            Boolean(item) && typeof item === "object" && !Array.isArray(item),
        )
        .map((item) => ({
          label: typeof item.label === "string" ? item.label : "Comparable",
          surface: typeof item.surface === "number" ? item.surface : undefined,
          price: typeof item.price === "number" ? item.price : undefined,
          soldAt: typeof item.soldAt === "string" ? item.soldAt : undefined,
        })),
      listingPrice: row.listing_price,
      mandateType: row.selected_mandate_type,
      history: (activitiesResult.data ?? [])
        .filter((activity) => activity.entity_id === row.id)
        .map(toHistory),
    };
  }
  const stats = statsResult.data;
  return {
    items,
    detail,
    stats: {
      newRequests: toNumber(stats?.new_requests),
      toSchedule: toNumber(stats?.to_schedule),
      scheduledThisWeek: toNumber(stats?.scheduled_this_week),
      completedThisMonth: toNumber(stats?.completed_this_month),
      mandatesThisMonth: toNumber(stats?.mandates_this_month),
    },
    options: {
      contacts: contactOptions(reference.contacts),
      profiles: profileOptions(reference.profiles),
    },
    meta: { count: filtered.length, page, limit },
    generatedAt: new Date().toISOString(),
  };
}

function visitSummary(
  row: AppointmentRow,
  contacts: Map<string, ContactRow>,
  properties: Map<string, PropertyRow>,
  profiles: Map<string, ProfileRow>,
  offerByVisit: Map<string, OfferRow>,
): CommercialVisitSummary {
  const contact = row.contact_id ? contacts.get(row.contact_id) : undefined;
  const property = row.property_id
    ? properties.get(row.property_id)
    : undefined;
  const profile = row.assigned_to ? profiles.get(row.assigned_to) : undefined;
  return {
    id: row.id,
    leadId: row.lead_id,
    propertyId: row.property_id,
    propertyTitle: property?.title ?? null,
    propertyReference: property?.reference ?? null,
    propertySlug: property?.slug ?? null,
    contactId: row.contact_id,
    contactName: contact?.name ?? null,
    contactEmail: contact?.email ?? null,
    contactPhone: contact?.phone ?? null,
    assignedTo: row.assigned_to,
    assignedToName: profile?.full_name ?? profile?.email ?? null,
    title: row.title,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    visitStatus: row.visit_status,
    reportSubmittedAt: row.report_submitted_at,
    reportNextAction: row.report_next_action,
    nextAction: row.next_action,
    offerId: offerByVisit.get(row.id)?.id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadCommercialVisits(
  session: AdminSession,
  options: {
    id?: string | null;
    query?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<CommercialVisitPayload> {
  const supabase = requiredClient();
  const assignedTo = agentScope(session);
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  let visitsQuery = supabase
    .from("appointments")
    .select("*")
    .eq("appointment_type", "VISIT")
    .order("starts_at", { ascending: false })
    .limit(500);
  if (assignedTo) visitsQuery = visitsQuery.eq("assigned_to", assignedTo);
  if (options.status)
    visitsQuery = visitsQuery.eq("visit_status", options.status);
  const [
    visitsResult,
    reference,
    offersResult,
    tasksResult,
    activitiesResult,
    statsResult,
  ] = await Promise.all([
    visitsQuery,
    loadReferenceData(),
    supabase
      .from("offers")
      .select("*")
      .eq("is_test", false)
      .not("created_from_visit_id", "is", null)
      .limit(500),
    supabase
      .from("tasks")
      .select("*")
      .not("appointment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("activities")
      .select("*")
      .eq("entity_type", "appointment")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("v_commercial_visit_week_stats").select("*").maybeSingle(),
  ]);
  assertNoError(visitsResult.error, "les visites");
  assertNoError(offersResult.error, "les offres liées aux visites");
  assertNoError(tasksResult.error, "les tâches de visite");
  assertNoError(activitiesResult.error, "l'historique des visites");
  assertNoError(statsResult.error, "les statistiques des visites");
  const contacts = new Map(reference.contacts.map((row) => [row.id, row]));
  const properties = new Map(reference.properties.map((row) => [row.id, row]));
  const profiles = new Map(reference.profiles.map((row) => [row.id, row]));
  const offerByVisit = new Map(
    (offersResult.data ?? [])
      .filter((row) => row.created_from_visit_id)
      .map((row) => [row.created_from_visit_id as string, row]),
  );
  const all = (visitsResult.data ?? []).map((row) =>
    visitSummary(row, contacts, properties, profiles, offerByVisit),
  );
  const normalizedQuery = options.query?.trim().toLocaleLowerCase("fr") ?? "";
  const filtered = normalizedQuery
    ? all.filter((row) =>
        [
          row.title,
          row.propertyTitle,
          row.propertyReference,
          row.contactName,
        ].some((value) =>
          value?.toLocaleLowerCase("fr").includes(normalizedQuery),
        ),
      )
    : all;
  const items = filtered.slice((page - 1) * limit, page * limit);
  const row = options.id
    ? (visitsResult.data ?? []).find((item) => item.id === options.id)
    : undefined;
  let detail: CommercialVisitDetail | null = null;
  if (row)
    detail = {
      ...visitSummary(row, contacts, properties, profiles, offerByVisit),
      comment: row.comment,
      generalImpression: row.general_impression,
      positivePoints: row.positive_points,
      blockingPoints: row.blocking_points,
      interestLevel: row.interest_level,
      additionalComments: row.additional_comments,
      tasks: (tasksResult.data ?? [])
        .filter((task) => task.appointment_id === row.id)
        .map((task) => toTask(task, profiles)),
      history: (activitiesResult.data ?? [])
        .filter((activity) => activity.entity_id === row.id)
        .map(toHistory),
    };
  const stats = statsResult.data;
  return {
    items,
    detail,
    stats: {
      total: toNumber(stats?.total),
      confirmed: toNumber(stats?.confirmed),
      toConfirm: toNumber(stats?.to_confirm),
      reportsMissing: toNumber(stats?.reports_missing),
    },
    options: {
      contacts: contactOptions(reference.contacts),
      properties: propertyOptions(reference.properties),
      profiles: profileOptions(reference.profiles),
      buyerCases: reference.buyerCases.map((lead) => ({
        id: lead.id,
        label: lead.dossier_reference ?? lead.title ?? lead.id,
        contactId: lead.contact_id,
      })),
    },
    meta: { count: filtered.length, page, limit },
    generatedAt: new Date().toISOString(),
  };
}

function offerSummary(
  row: OfferRow,
  contacts: Map<string, ContactRow>,
  properties: Map<string, PropertyRow>,
  profiles: Map<string, ProfileRow>,
  negotiationByOffer: Map<string, NegotiationRow>,
  documentCounts: Map<string, number>,
): CommercialOfferSummary | null {
  if (
    !row.property_id ||
    !row.buyer_dossier_id ||
    !row.buyer_contact_id ||
    !row.responsible_user_id ||
    row.amount == null
  )
    return null;
  const property = properties.get(row.property_id);
  const buyer = contacts.get(row.buyer_contact_id);
  const responsible = profiles.get(row.responsible_user_id);
  if (!property || !buyer || !responsible) return null;
  return {
    id: row.id,
    propertyId: property.id,
    propertyTitle: property.title,
    propertyReference: property.reference,
    propertySlug: property.slug,
    propertyCity: property.city,
    propertyPrice: property.price,
    propertyPhotos: toStringArray(property.photos),
    buyerDossierId: row.buyer_dossier_id,
    buyerContactId: buyer.id,
    buyerName: buyer.name,
    buyerEmail: buyer.email,
    buyerPhone: buyer.phone,
    visitId: row.created_from_visit_id,
    responsibleUserId: responsible.id,
    responsibleUserName: responsible.full_name ?? responsible.email,
    amount: row.amount,
    status: row.status,
    offerDate: row.offer_date,
    validUntil: row.valid_until,
    financingType: row.financing_type,
    negotiationId: negotiationByOffer.get(row.id)?.id ?? null,
    documentCount: documentCounts.get(row.id) ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadCommercialOffers(
  session: AdminSession,
  options: {
    id?: string | null;
    query?: string;
    status?: string;
    page?: number;
    limit?: number;
    propertyId?: string | null;
    contactId?: string | null;
    visitId?: string | null;
  } = {},
): Promise<CommercialOfferPayload> {
  const supabase = requiredClient();
  const assignedTo = agentScope(session);
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  let offersQuery = supabase
    .from("offers")
    .select("*")
    .eq("is_test", false)
    .order("created_at", { ascending: false })
    .limit(500);
  if (assignedTo)
    offersQuery = offersQuery.eq("responsible_user_id", assignedTo);
  if (options.status) offersQuery = offersQuery.eq("status", options.status);
  const [
    offersResult,
    reference,
    negotiationsResult,
    documentsResult,
    historyResult,
  ] = await Promise.all([
    offersQuery,
    loadReferenceData(),
    supabase
      .from("negotiations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("offer_documents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("offer_status_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1500),
  ]);
  assertNoError(offersResult.error, "les offres");
  assertNoError(negotiationsResult.error, "les négociations liées");
  assertNoError(documentsResult.error, "les documents d'offre");
  assertNoError(historyResult.error, "l'historique des offres");
  const contacts = new Map(reference.contacts.map((row) => [row.id, row]));
  const properties = new Map(reference.properties.map((row) => [row.id, row]));
  const profiles = new Map(reference.profiles.map((row) => [row.id, row]));
  const negotiationByOffer = new Map(
    (negotiationsResult.data ?? []).map((row) => [row.offer_id, row]),
  );
  const documentCounts = new Map<string, number>();
  for (const document of documentsResult.data ?? [])
    documentCounts.set(
      document.offer_id,
      (documentCounts.get(document.offer_id) ?? 0) + 1,
    );
  const all = (offersResult.data ?? [])
    .map((row) =>
      offerSummary(
        row,
        contacts,
        properties,
        profiles,
        negotiationByOffer,
        documentCounts,
      ),
    )
    .filter((row): row is CommercialOfferSummary => Boolean(row));
  const normalizedQuery = options.query?.trim().toLocaleLowerCase("fr") ?? "";
  const filtered = normalizedQuery
    ? all.filter((row) =>
        [
          row.propertyTitle,
          row.propertyReference,
          row.buyerName,
          row.buyerEmail,
        ].some((value) =>
          value.toLocaleLowerCase("fr").includes(normalizedQuery),
        ),
      )
    : all;
  const items = filtered.slice((page - 1) * limit, page * limit);
  const row = options.id
    ? (offersResult.data ?? []).find((item) => item.id === options.id)
    : undefined;
  let detail: CommercialOfferDetail | null = null;
  if (row) {
    const base = offerSummary(
      row,
      contacts,
      properties,
      profiles,
      negotiationByOffer,
      documentCounts,
    );
    if (base)
      detail = {
        ...base,
        downPaymentAmount: row.down_payment_amount,
        loanAmount: row.loan_amount,
        suspensiveConditions: row.suspensive_conditions,
        includedFurniture: row.included_furniture,
        negotiationComment: row.negotiation_comment,
        nextAction: row.next_action,
        nextActionDueAt: row.next_action_due_at,
        documents: (documentsResult.data ?? [])
          .filter((document) => document.offer_id === row.id)
          .map((document) => ({
            id: document.id,
            fileName: document.file_name,
            documentType: document.document_type,
            mimeType: document.mime_type,
            createdAt: document.created_at,
          })),
        history: (historyResult.data ?? [])
          .filter((item) => item.offer_id === row.id)
          .map((item) => ({
            id: item.id,
            previousStatus: item.previous_status,
            nextStatus: item.next_status,
            reason: item.reason,
            createdAt: item.created_at,
          })),
      };
  }
  const active = new Set(["TO_BE_SIGNED", "SIGNED_BY_BUYER", "SENT_TO_SELLER"]);
  let prefillBuyerDossierId: string | null = null;
  if (options.contactId)
    prefillBuyerDossierId =
      reference.buyerCases.find(
        (lead) =>
          lead.contact_id === options.contactId &&
          (!options.propertyId ||
            !lead.linked_property_id ||
            lead.linked_property_id === options.propertyId),
      )?.id ?? null;
  return {
    items,
    detail,
    stats: {
      total: all.length,
      draft: all.filter((item) => item.status === "DRAFT").length,
      active: all.filter((item) => active.has(item.status)).length,
      negotiating: all.filter((item) => item.status === "NEGOTIATING").length,
      accepted: all.filter((item) => item.status === "ACCEPTED").length,
    },
    options: {
      contacts: contactOptions(reference.contacts),
      properties: propertyOptions(reference.properties),
      profiles: profileOptions(reference.profiles),
      buyerCases: reference.buyerCases.map((lead) => ({
        id: lead.id,
        label: lead.dossier_reference ?? lead.title ?? lead.id,
        contactId: lead.contact_id,
        propertyId: lead.linked_property_id,
      })),
    },
    prefill: {
      propertyId: options.propertyId ?? null,
      contactId: options.contactId ?? null,
      visitId: options.visitId ?? null,
      buyerDossierId: prefillBuyerDossierId,
    },
    meta: { count: filtered.length, page, limit },
    generatedAt: new Date().toISOString(),
  };
}

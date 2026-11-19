import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission, requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import {
  activeCommercialOfferStatuses,
  assignableProfileRoles,
  contactRoleLabels,
  isContactQualificationStatus,
  isContactRole,
  isLeadPriority,
  isLeadStatus,
  isCommercialOfferStatus,
  leadPriorityLabels,
  leadStatusLabels,
} from "@/lib/crm";
import {
  filterAssignableProfiles,
  isAssignableActiveProfile,
  isPotentialDuplicateReminder,
  uniquePipelineRecordsById,
} from "@/lib/crm-pipeline-rules";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  ContactQualificationStatus,
  ContactRole,
  CommercialOfferStatus,
  LeadPriority,
  LeadStatus,
  PipelineTaskStatus,
  TaskEmailReminderStatus,
  TaskRecurrenceRule,
  TaskReminderChannel,
} from "@/types/crm";
import type { TablesInsert, TablesUpdate } from "@/types/supabase";

type JsonRecord = Record<string, unknown>;

type LeadRow = {
  id: string;
  contact_id: string | null;
  estimation_id: string | null;
  linked_property_id: string | null;
  source_table: string | null;
  source_id: string | null;
  lead_type: string | null;
  source: string | null;
  priority: string | null;
  assigned_to: string | null;
  status: string | null;
  notes: string | null;
  archived: boolean | null;
  created_at: string;
  updated_at: string;
  title?: string | null;
  request_type?: string | null;
  project_type?: string | null;
  property_type?: string | null;
  city?: string | null;
  postal_code?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  desired_surface?: number | null;
  desired_rooms?: number | null;
  source_code?: string | null;
  dossier_reference?: string | null;
};

type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  request_type: string | null;
};

type QualifiedContactRow = ContactRow & {
  message: string | null;
  notes: string | null;
  archived: boolean;
  status: string | null;
  contact_source: string | null;
  contact_role: string | null;
  qualification_status: string | null;
  active_prospect: boolean | null;
  pipeline_lead_id: string | null;
};

type PropertyRow = {
  id: string;
  reference: string | null;
  title: string | null;
  status?: string | null;
  commercial_status?: string | null;
  publication_status?: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
};

type TaskRow = {
  id: string;
  lead_id: string | null;
  assigned_to: string | null;
  created_by?: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  completed_at: string | null;
  completed_by?: string | null;
  priority: string | null;
  status?: string | null;
  task_type?: string | null;
  contact_id?: string | null;
  property_id?: string | null;
  offer_id?: string | null;
  appointment_id?: string | null;
  recurrence_rule?: string | null;
  reminder_channel?: string | null;
  email_reminder_enabled?: boolean | null;
  email_reminder_status?: string | null;
  email_reminder_scheduled_at?: string | null;
  email_reminder_sent_at?: string | null;
  email_reminder_last_error?: string | null;
  created_at: string;
  updated_at: string;
};

type PipelineObjectRow = {
  lead_id: string | null;
  status: string | null;
  appointment_type?: string | null;
};

type OfferRow = {
  id: string;
  lead_id: string | null;
  contact_id: string | null;
  property_id: string | null;
  assigned_to: string | null;
  buyer_dossier_id?: string | null;
  buyer_contact_id?: string | null;
  responsible_user_id?: string | null;
  amount: number | null;
  status: string | null;
  offered_at: string | null;
  expires_at: string | null;
  offer_date?: string | null;
  valid_until?: string | null;
  next_action?: string | null;
  next_action_due_at?: string | null;
  financing_type?: string | null;
  down_payment_amount?: number | null;
  loan_amount?: number | null;
  suspensive_conditions?: string | null;
  included_furniture?: string | null;
  negotiation_comment?: string | null;
  signed_document_id?: string | null;
  submitted_to_seller_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  withdrawn_at?: string | null;
  rejection_reason?: string | null;
  withdrawal_reason?: string | null;
  created_from_visit_id?: string | null;
  is_test?: boolean | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

const inactiveAppointmentStatuses = new Set(["cancelled", "canceled", "no_show"]);
const activeOfferStatuses = new Set<string>([...activeCommercialOfferStatuses, "SUBMITTED"]);
const activeMandateStatuses = new Set(["signed", "active"]);

function compactIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function safeStatus(value: unknown): LeadStatus {
  return isLeadStatus(value) ? value : "NEW";
}

function safePriority(value: unknown): LeadPriority {
  return isLeadPriority(value) ? value : "normal";
}

function safeContactRole(value: unknown): ContactRole {
  return isContactRole(value) ? value : "UNKNOWN";
}

function safeContactQualificationStatus(value: unknown): ContactQualificationStatus {
  return isContactQualificationStatus(value) ? value : "TO_REVIEW";
}

function safeRecurrenceRule(value: unknown): TaskRecurrenceRule {
  return value === "WEEKLY" || value === "MONTHLY" ? value : "NONE";
}

function safeReminderChannel(value: unknown): TaskReminderChannel {
  return value === "EMAIL" ? value : "NONE";
}

function safeEmailReminderStatus(value: unknown): TaskEmailReminderStatus {
  return value === "PENDING" || value === "SENT" || value === "FAILED" ? value : "NOT_SCHEDULED";
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(value: unknown) {
  const clean = getString(value);
  return clean || null;
}

function getNullableDate(value: unknown) {
  const clean = getString(value);
  if (!clean) return null;
  const date = new Date(clean);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isMissingColumnError(error: { message?: string } | null) {
  return Boolean(error?.message && /column .* does not exist|Could not find .* column/i.test(error.message));
}

function safeTaskStatus(value: unknown, completedAt?: string | null): PipelineTaskStatus {
  if (value === "IN_PROGRESS" || value === "COMPLETED" || value === "CANCELLED") return value;
  return completedAt ? "COMPLETED" : "TODO";
}

function safeOfferStatus(value: unknown): CommercialOfferStatus {
  if (value === "SUBMITTED") return "SENT_TO_SELLER";
  if (value === "REFUSED") return "REJECTED";
  return isCommercialOfferStatus(value) ? value : "DRAFT";
}

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        (error.message && /relation .* does not exist|Could not find the table/i.test(error.message)))
  );
}

async function loadAssignableProfile(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  profileId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,is_active")
    .eq("id", profileId)
    .maybeSingle();

  if (error) return { profile: null, error };
  const profile = data as ProfileRow | null;
  if (!profile || !isAssignableActiveProfile(profile)) {
    return { profile: null, error: null };
  }

  return { profile, error: null };
}

async function loadTasks(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  if (!supabase) return { data: [] as TaskRow[], error: null };

  const fullSelect = [
    "id",
    "lead_id",
    "assigned_to",
    "created_by",
    "title",
    "description",
    "due_at",
    "completed_at",
    "completed_by",
    "priority",
    "status",
    "task_type",
    "contact_id",
    "property_id",
    "offer_id",
    "appointment_id",
    "recurrence_rule",
    "reminder_channel",
    "email_reminder_enabled",
    "email_reminder_status",
    "email_reminder_scheduled_at",
    "email_reminder_sent_at",
    "email_reminder_last_error",
    "created_at",
    "updated_at",
  ].join(",");

  const fullResult = await supabase
    .from("tasks")
    .select(fullSelect)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (!fullResult.error || !isMissingColumnError(fullResult.error)) {
    return { data: (fullResult.data ?? []) as unknown as TaskRow[], error: fullResult.error };
  }

  const fallbackResult = await supabase
    .from("tasks")
    .select("id,lead_id,assigned_to,title,description,due_at,completed_at,priority,created_at,updated_at")
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  return { data: (fallbackResult.data ?? []) as unknown as TaskRow[], error: fallbackResult.error };
}

async function loadLeads(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  if (!supabase) return { data: [] as LeadRow[], error: null };

  const baseColumns = [
    "id",
    "contact_id",
    "estimation_id",
    "linked_property_id",
    "source_table",
    "source_id",
    "lead_type",
    "source",
    "priority",
    "assigned_to",
    "status",
    "notes",
    "archived",
    "created_at",
    "updated_at",
    "title",
    "request_type",
    "project_type",
    "property_type",
    "city",
    "postal_code",
    "budget_min",
    "budget_max",
    "desired_surface",
    "desired_rooms",
    "source_code",
  ];

  const fullResult = await supabase
    .from("leads")
    .select([...baseColumns, "dossier_reference"].join(","))
    .order("updated_at", { ascending: false })
    .limit(300);

  if (!fullResult.error || !isMissingColumnError(fullResult.error)) {
    return { data: (fullResult.data ?? []) as unknown as LeadRow[], error: fullResult.error };
  }

  const fallbackResult = await supabase
    .from("leads")
    .select(baseColumns.join(","))
    .order("updated_at", { ascending: false })
    .limit(300);

  return { data: (fallbackResult.data ?? []) as unknown as LeadRow[], error: fallbackResult.error };
}

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const [leadsResult, tasksResult, profilesResult, appointmentsResult, mandatesResult, offersResult] = await Promise.all([
    loadLeads(supabase),
    loadTasks(supabase),
    supabase
      .from("profiles")
      .select("id,email,full_name,role,is_active")
      .eq("is_active", true)
      .in("role", [...assignableProfileRoles])
      .order("full_name", { ascending: true }),
    loadAppointments(supabase),
    supabase
      .from("mandates")
      .select("lead_id,status")
      .limit(1000),
    loadOffers(supabase),
  ]);

  const offersMissing = isMissingRelationError(offersResult.error);
  const error =
    leadsResult.error ??
    tasksResult.error ??
    profilesResult.error ??
    appointmentsResult.error ??
    mandatesResult.error ??
    (offersMissing ? null : offersResult.error);
  if (error) {
    console.error("[IMMO-DREAMS83] Pipeline load failed", error.message);
    return NextResponse.json({ success: false, message: "Le pipeline CRM n'a pas pu etre charge." }, { status: 500 });
  }

  const leads = uniquePipelineRecordsById((leadsResult.data ?? []) as unknown as LeadRow[]);
  const profiles = filterAssignableProfiles((profilesResult.data ?? []) as unknown as ProfileRow[]);
  const tasks = (tasksResult.data ?? []) as unknown as TaskRow[];
  const appointments = (appointmentsResult.data ?? []) as unknown as PipelineObjectRow[];
  const mandates = (mandatesResult.data ?? []) as unknown as PipelineObjectRow[];
  const offers = offersMissing ? [] : (offersResult.data ?? []) as unknown as OfferRow[];
  const activeAppointments = appointments.filter(
    (appointment) =>
      appointment.appointment_type === "VISIT" &&
      !inactiveAppointmentStatuses.has((appointment.status ?? "").toLowerCase())
  );
  const activeOffers = offers.filter(
    (offer) =>
      !offer.is_test &&
      !offer.notes?.includes("[RECETTE:") &&
      activeOfferStatuses.has((offer.status ?? "").toUpperCase())
  );
  const activeMandates = mandates.filter((mandate) => activeMandateStatuses.has((mandate.status ?? "").toLowerCase()));
  const appointmentLeadIds = new Set(compactIds(activeAppointments.map((appointment) => appointment.lead_id)));
  const offerLeadIds = new Set(
    compactIds(activeOffers.map((offer) => offer.buyer_dossier_id ?? offer.lead_id))
  );
  const mandateLeadIds = new Set(compactIds(activeMandates.map((mandate) => mandate.lead_id)));
  const contactIds = compactIds([
    ...leads.map((lead) => lead.contact_id),
    ...offers.map((offer) => offer.buyer_contact_id ?? offer.contact_id),
  ]);
  const propertyIds = compactIds([
    ...leads.map((lead) => lead.linked_property_id),
    ...offers.map((offer) => offer.property_id),
  ]);

  const [contactsResult, propertiesResult] = await Promise.all([
    contactIds.length
      ? supabase
          .from("contacts")
          .select("id,name,email,phone,city,request_type")
          .in("id", contactIds)
      : Promise.resolve({ data: [] as ContactRow[], error: null }),
    propertyIds.length
      ? supabase
          .from("properties")
          .select("id,reference,title,status,commercial_status,publication_status")
          .in("id", propertyIds)
      : Promise.resolve({ data: [] as PropertyRow[], error: null }),
  ]);

  const relatedError = contactsResult.error ?? propertiesResult.error;
  if (relatedError) {
    console.error("[IMMO-DREAMS83] Pipeline related data load failed", relatedError.message);
    return NextResponse.json({ success: false, message: "Les donnees liees au pipeline n'ont pas pu etre chargees." }, { status: 500 });
  }

  const contactsById = new Map(((contactsResult.data ?? []) as ContactRow[]).map((contact) => [contact.id, contact]));
  const propertiesById = new Map(((propertiesResult.data ?? []) as PropertyRow[]).map((property) => [property.id, property]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const offersByLead = new Map<string, OfferRow[]>();
  offers.forEach((offer) => {
    const leadId = offer.buyer_dossier_id ?? offer.lead_id;
    if (!leadId || offer.is_test || offer.notes?.includes("[RECETTE:")) return;
    const current = offersByLead.get(leadId) ?? [];
    current.push(offer);
    offersByLead.set(leadId, current);
  });

  const payloadLeads = leads.map((lead) => {
    const contact = lead.contact_id ? contactsById.get(lead.contact_id) : null;
    const assignedProfile = lead.assigned_to ? profilesById.get(lead.assigned_to) : null;
    const linkedProperty = lead.linked_property_id ? propertiesById.get(lead.linked_property_id) : null;
    const leadOffers = offersByLead.get(lead.id) ?? [];
    const latestOffer = leadOffers[0] ?? null;
    const requestType = lead.request_type ?? lead.title ?? contact?.request_type ?? lead.lead_type ?? "Demande";

    return {
      id: lead.id,
      dossierReference:
        lead.dossier_reference ?? `DOS-${lead.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      title: lead.title ?? requestType,
      requestType,
      projectType: lead.project_type ?? lead.lead_type ?? "general",
      propertyType: lead.property_type ?? null,
      city: lead.city ?? contact?.city ?? null,
      postalCode: lead.postal_code ?? null,
      budgetMin: lead.budget_min ?? null,
      budgetMax: lead.budget_max ?? null,
      desiredSurface: lead.desired_surface ?? null,
      desiredRooms: lead.desired_rooms ?? null,
      source: lead.source ?? "crm",
      sourceCode: lead.source_code ?? null,
      status: safeStatus(lead.status),
      priority: safePriority(lead.priority),
      assignedTo: lead.assigned_to ?? null,
      assignedToName: assignedProfile?.full_name ?? assignedProfile?.email ?? null,
      contactId: lead.contact_id ?? null,
      contactName: contact?.name ?? lead.title ?? "Prospect sans nom",
      contactEmail: contact?.email ?? null,
      contactPhone: contact?.phone ?? null,
      linkedPropertyId: lead.linked_property_id ?? null,
      linkedPropertyTitle: linkedProperty
        ? `${linkedProperty.reference ? `Ref. ${linkedProperty.reference} - ` : ""}${linkedProperty.title ?? "Bien lie"}`
        : null,
      hasActiveAppointment: appointmentLeadIds.has(lead.id),
      hasActiveOffer: offerLeadIds.has(lead.id),
      hasActiveMandate: mandateLeadIds.has(lead.id),
      offerCount: leadOffers.length,
      latestOfferId: latestOffer?.id ?? null,
      latestOfferStatus: latestOffer ? safeOfferStatus(latestOffer.status) : null,
      notes: lead.notes ?? null,
      archived: Boolean(lead.archived),
    };
  });

  const payloadTasks = tasks.map((task) => {
    const assignedProfile = task.assigned_to ? profilesById.get(task.assigned_to) : null;

    return {
      id: task.id,
      leadId: task.lead_id,
      assignedTo: task.assigned_to,
      assignedToName: assignedProfile?.full_name ?? assignedProfile?.email ?? null,
      createdBy: task.created_by ?? null,
      title: task.title,
      description: task.description,
      dueAt: task.due_at,
      completedAt: task.completed_at,
      completedBy: task.completed_by ?? null,
      priority: safePriority(task.priority),
      status: safeTaskStatus(task.status, task.completed_at),
      taskType: task.task_type ?? "FOLLOW_UP",
      contactId: task.contact_id ?? null,
      propertyId: task.property_id ?? null,
      offerId: task.offer_id ?? null,
      appointmentId: task.appointment_id ?? null,
      recurrenceRule: safeRecurrenceRule(task.recurrence_rule),
      reminderChannel: safeReminderChannel(task.reminder_channel),
      emailReminderEnabled: Boolean(task.email_reminder_enabled),
      emailReminderStatus: safeEmailReminderStatus(task.email_reminder_status),
      emailReminderScheduledAt: task.email_reminder_scheduled_at ?? null,
      emailReminderSentAt: task.email_reminder_sent_at ?? null,
      emailReminderLastError: task.email_reminder_last_error ?? null,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    };
  });

  const payloadOffers = offers
    .filter((offer) => !offer.is_test && !offer.notes?.includes("[RECETTE:"))
    .map((offer) => {
      const buyerDossierId = offer.buyer_dossier_id ?? offer.lead_id ?? "";
      const buyerContactId = offer.buyer_contact_id ?? offer.contact_id ?? "";
      const responsibleUserId = offer.responsible_user_id ?? offer.assigned_to ?? "";
      const buyerContact = buyerContactId ? contactsById.get(buyerContactId) : null;
      const property = offer.property_id ? propertiesById.get(offer.property_id) : null;
      const responsibleProfile = responsibleUserId ? profilesById.get(responsibleUserId) : null;

      return {
        id: offer.id,
        leadId: buyerDossierId,
        buyerDossierId,
        buyerContactId,
        buyerContactName: buyerContact?.name ?? "Acquéreur non renseigné",
        propertyId: offer.property_id ?? "",
        propertyReference: property?.reference ?? null,
        propertyTitle: property?.title ?? "Bien non renseigné",
        propertyCommercialStatus: property?.commercial_status ?? property?.status ?? null,
        responsibleUserId,
        responsibleUserName: responsibleProfile?.full_name ?? responsibleProfile?.email ?? "Non attribué",
        amount: Number(offer.amount ?? 0),
        status: safeOfferStatus(offer.status),
        offerDate: offer.offer_date ?? offer.offered_at?.slice(0, 10) ?? offer.created_at.slice(0, 10),
        validUntil: offer.valid_until ?? offer.expires_at?.slice(0, 10) ?? offer.created_at.slice(0, 10),
        nextAction: offer.next_action ?? "Valider et transmettre l'offre",
        nextActionDueAt: offer.next_action_due_at ?? offer.expires_at ?? offer.updated_at,
        financingType:
          offer.financing_type === "CASH" ||
          offer.financing_type === "LOAN" ||
          offer.financing_type === "MIXED"
            ? offer.financing_type
            : "UNKNOWN",
        downPaymentAmount: offer.down_payment_amount == null ? null : Number(offer.down_payment_amount),
        loanAmount: offer.loan_amount == null ? null : Number(offer.loan_amount),
        suspensiveConditions: offer.suspensive_conditions ?? null,
        includedFurniture: offer.included_furniture ?? null,
        negotiationComment: offer.negotiation_comment ?? offer.notes ?? null,
        signedDocumentId: offer.signed_document_id ?? null,
        submittedToSellerAt: offer.submitted_to_seller_at ?? null,
        acceptedAt: offer.accepted_at ?? null,
        rejectedAt: offer.rejected_at ?? null,
        withdrawnAt: offer.withdrawn_at ?? null,
        rejectionReason: offer.rejection_reason ?? null,
        withdrawalReason: offer.withdrawal_reason ?? null,
        createdFromVisitId: offer.created_from_visit_id ?? null,
        isTest: false,
        createdAt: offer.created_at,
        updatedAt: offer.updated_at,
      };
    });

  return NextResponse.json({
    success: true,
    leads: payloadLeads,
    tasks: payloadTasks,
    offers: payloadOffers,
    team: profiles.map((profile) => ({
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      isActive: profile.is_active,
    })),
    permissions: {
      canAssignDossiers:
        auth.session.profile.role === "ADMIN" || auth.session.profile.role === "DIRECTOR",
      canCreateOffers: hasAdminPermission(auth.session.profile.role, "offer.write"),
      canDecideOffers: hasAdminPermission(auth.session.profile.role, "offer.decide"),
    },
    metrics: {
      visits: activeAppointments.length,
      offers: activeOffers.length,
      mandates: activeMandates.length,
      sources: {
        visits: "real",
        offers: offersMissing ? "missing" : "real",
        mandates: "real",
      },
    },
  });
}

async function loadAppointments(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  if (!supabase) return { data: [] as PipelineObjectRow[], error: null };

  const fullResult = await supabase
    .from("appointments")
    .select("lead_id,status,appointment_type")
    .limit(1000);

  if (!fullResult.error || !isMissingColumnError(fullResult.error)) {
    return {
      data: (fullResult.data ?? []) as unknown as PipelineObjectRow[],
      error: fullResult.error,
    };
  }

  const fallbackResult = await supabase
    .from("appointments")
    .select("lead_id,status")
    .limit(1000);

  return {
    data: ((fallbackResult.data ?? []) as unknown as PipelineObjectRow[]).map((row) => ({
      ...row,
      appointment_type: "MEETING",
    })),
    error: fallbackResult.error,
  };
}

async function loadOffers(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  if (!supabase) return { data: [] as OfferRow[], error: null };

  const fullResult = await supabase
    .from("offers")
    .select([
      "id",
      "lead_id",
      "contact_id",
      "property_id",
      "assigned_to",
      "buyer_dossier_id",
      "buyer_contact_id",
      "responsible_user_id",
      "amount",
      "status",
      "offered_at",
      "expires_at",
      "offer_date",
      "valid_until",
      "next_action",
      "next_action_due_at",
      "financing_type",
      "down_payment_amount",
      "loan_amount",
      "suspensive_conditions",
      "included_furniture",
      "negotiation_comment",
      "signed_document_id",
      "submitted_to_seller_at",
      "accepted_at",
      "rejected_at",
      "withdrawn_at",
      "rejection_reason",
      "withdrawal_reason",
      "created_from_visit_id",
      "is_test",
      "notes",
      "created_at",
      "updated_at",
    ].join(","))
    .order("created_at", { ascending: false })
    .limit(1000);

  if (!fullResult.error || !isMissingColumnError(fullResult.error)) {
    return { data: (fullResult.data ?? []) as unknown as OfferRow[], error: fullResult.error };
  }

  const fallbackResult = await supabase
    .from("offers")
    .select("id,lead_id,contact_id,property_id,assigned_to,amount,status,offered_at,expires_at,notes,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  return { data: (fallbackResult.data ?? []) as unknown as OfferRow[], error: fallbackResult.error };
}

async function createPipelineTask(payload: JsonRecord, actorId: string) {
  const leadId = getNullableString(payload.leadId);
  const title = getString(payload.title);
  const description = getNullableString(payload.description);
  const dueAt = getNullableDate(payload.dueAt);
  const requestedAssignee = getNullableString(payload.assignedTo);
  const priority = safePriority(payload.priority);
  const taskType = getString(payload.taskType) || "FOLLOW_UP";
  const recurrenceRule = safeRecurrenceRule(payload.recurrenceRule);
  const reminderChannel = safeReminderChannel(payload.reminderChannel);
  const emailReminderEnabled = reminderChannel === "EMAIL" && Boolean(dueAt);
  const emailReminderStatus = emailReminderEnabled ? "PENDING" : "NOT_SCHEDULED";
  const confirmDuplicate = payload.confirmDuplicate === true;

  if (!leadId || !title || !dueAt) {
    return {
      response: NextResponse.json(
        { success: false, message: "Dossier, titre et échéance du rappel sont obligatoires." },
        { status: 400 }
      ),
    };
  }
  if (title.length > 160 || (description?.length ?? 0) > 2000) {
    return {
      response: NextResponse.json(
        { success: false, message: "Le titre ou le commentaire du rappel est trop long." },
        { status: 400 }
      ),
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { response: NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 }) };
  }

  const { data: rawLead, error: leadError } = await supabase
    .from("leads")
    .select("id,contact_id,linked_property_id,assigned_to,status,archived")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    console.error("[IMMO-DREAMS83] Reminder dossier validation failed", leadError.message);
    return {
      response: NextResponse.json(
        { success: false, message: "Le dossier du rappel n'a pas pu être vérifié." },
        { status: 500 }
      ),
    };
  }

  const lead = rawLead as {
    id: string;
    contact_id: string | null;
    linked_property_id: string | null;
    assigned_to: string | null;
    status: string | null;
    archived: boolean;
  } | null;
  if (!lead || lead.archived || lead.status === "LOST") {
    return {
      response: NextResponse.json(
        { success: false, message: "Ce dossier n'est plus actif et ne peut pas recevoir de rappel." },
        { status: 409 }
      ),
    };
  }

  const assignedTo = requestedAssignee ?? lead.assigned_to ?? actorId;
  const assigneeResult = await loadAssignableProfile(supabase, assignedTo);
  if (assigneeResult.error) {
    console.error("[IMMO-DREAMS83] Reminder assignee validation failed", assigneeResult.error.message);
    return {
      response: NextResponse.json(
        { success: false, message: "Le responsable du rappel n'a pas pu être vérifié." },
        { status: 500 }
      ),
    };
  }
  if (!assigneeResult.profile) {
    return {
      response: NextResponse.json(
        { success: false, message: "Choisissez un agent actif autorisé comme responsable." },
        { status: 400 }
      ),
    };
  }

  if (!confirmDuplicate) {
    const dueTimestamp = new Date(dueAt).getTime();
    const windowStart = new Date(dueTimestamp - 30 * 60 * 1000).toISOString();
    const windowEnd = new Date(dueTimestamp + 30 * 60 * 1000).toISOString();
    const { data: candidates, error: duplicateError } = await supabase
      .from("tasks")
      .select("id,title,due_at,assigned_to")
      .eq("lead_id", leadId)
      .is("completed_at", null)
      .gte("due_at", windowStart)
      .lte("due_at", windowEnd)
      .limit(20);

    if (duplicateError) {
      console.error("[IMMO-DREAMS83] Reminder duplicate lookup failed", duplicateError.message);
    } else {
      const duplicate = (candidates ?? []).find((candidate) =>
        isPotentialDuplicateReminder(
          {
            leadId,
            assignedTo: candidate.assigned_to,
            title: candidate.title,
            dueAt: candidate.due_at,
          },
          { leadId, assignedTo, title, dueAt }
        )
      );
      if (duplicate) {
        return {
          response: NextResponse.json(
            {
              success: false,
              code: "POTENTIAL_DUPLICATE",
              message: "Un rappel très proche existe déjà pour ce dossier.",
              duplicateTask: {
                id: duplicate.id,
                title: duplicate.title,
                dueAt: duplicate.due_at,
              },
            },
            { status: 409 }
          ),
        };
      }
    }
  }

  const fullInsert = {
    lead_id: leadId,
    contact_id: lead.contact_id,
    property_id: getNullableString(payload.propertyId) ?? lead.linked_property_id,
    offer_id: getNullableString(payload.offerId),
    appointment_id: getNullableString(payload.appointmentId),
    assigned_to: assignedTo,
    created_by: actorId,
    title,
    description,
    due_at: dueAt,
    priority,
    status: "TODO",
    task_type: taskType,
    recurrence_rule: recurrenceRule,
    reminder_channel: reminderChannel,
    email_reminder_enabled: emailReminderEnabled,
    email_reminder_status: emailReminderStatus,
    email_reminder_scheduled_at: emailReminderEnabled ? dueAt : null,
  };
  let result = await supabase.from("tasks").insert(fullInsert as TablesInsert<"tasks">).select("*").single();

  if (result.error && isMissingColumnError(result.error)) {
    const fallbackInsert = {
      lead_id: leadId,
      assigned_to: assignedTo,
      title,
      description,
      due_at: dueAt,
      priority,
    };
    result = await supabase.from("tasks").insert(fallbackInsert).select("*").single();
  }

  if (result.error) {
    console.error("[IMMO-DREAMS83] Pipeline task creation failed", result.error.message);
    return { response: NextResponse.json({ success: false, message: "Le rappel n'a pas pu etre cree." }, { status: 500 }) };
  }

  return { task: result.data as TaskRow, response: null };
}

function getLeadSourceCode(contactSource: string | null) {
  if (contactSource === "PHONE" || contactSource === "AGENCY" || contactSource === "EMAIL") {
    return contactSource;
  }
  if (contactSource?.startsWith("LESTY") || contactSource === "LEGACY_IMPORT") {
    return "LEGACY_IMPORT";
  }
  return "CONTACT_FORM";
}

function getProjectType(role: ContactRole) {
  if (role === "BUYER") return "buyer";
  if (role === "SELLER") return "seller";
  if (role === "BOTH") return "mixed";
  return "general";
}

async function createLeadFromContact(payload: JsonRecord, actorId: string) {
  const contactId = getNullableString(payload.contactId);
  if (!contactId) {
    return {
      response: NextResponse.json({ success: false, message: "Contact introuvable." }, { status: 400 }),
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      response: NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 }),
    };
  }

  const { data: rawContact, error: contactError } = await supabase
    .from("contacts")
    .select([
      "id",
      "name",
      "email",
      "phone",
      "city",
      "request_type",
      "message",
      "notes",
      "archived",
      "status",
      "contact_source",
      "contact_role",
      "qualification_status",
      "active_prospect",
      "pipeline_lead_id",
    ].join(","))
    .eq("id", contactId)
    .single();

  if (contactError || !rawContact) {
    console.error("[IMMO-DREAMS83] Contact-to-pipeline read failed", contactError?.message);
    return {
      response: NextResponse.json({ success: false, message: "Le contact n'a pas pu être relu." }, { status: 500 }),
    };
  }

  const contact = rawContact as unknown as QualifiedContactRow;
  const role = safeContactRole(contact.contact_role);
  const qualificationStatus = safeContactQualificationStatus(contact.qualification_status);

  if (contact.archived || qualificationStatus !== "QUALIFIED" || !contact.active_prospect || role === "UNKNOWN") {
    return {
      response: NextResponse.json(
        {
          success: false,
          message: "Le contact doit être qualifié, actif et associé à un rôle commercial avant sa création dans le pipeline.",
        },
        { status: 409 }
      ),
    };
  }

  if (contact.pipeline_lead_id) {
    return {
      leadId: contact.pipeline_lead_id,
      contactName: contact.name,
      role,
      created: false,
      task: null,
      response: null,
    };
  }

  const { data: existingLead, error: existingLeadError } = await supabase
    .from("leads")
    .select("id")
    .eq("contact_id", contactId)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingLeadError) {
    console.error("[IMMO-DREAMS83] Existing contact lead lookup failed", existingLeadError.message);
    return {
      response: NextResponse.json({ success: false, message: "Le pipeline n'a pas pu être vérifié." }, { status: 500 }),
    };
  }

  if (existingLead?.id) {
    const { error: existingLinkError } = await supabase
      .from("contacts")
      .update({ pipeline_lead_id: existingLead.id })
      .eq("id", contactId);
    if (existingLinkError) {
      console.error("[IMMO-DREAMS83] Existing contact lead link failed", existingLinkError.message);
      return {
        response: NextResponse.json(
          { success: false, message: "Le prospect existe, mais le contact n'a pas pu être relié." },
          { status: 500 }
        ),
      };
    }

    return {
      leadId: existingLead.id,
      contactName: contact.name,
      role,
      created: false,
      task: null,
      response: null,
    };
  }

  const { data: createdLead, error: createError } = await supabase
    .from("leads")
    .insert({
      contact_id: contactId,
      source_table: "contacts",
      source_id: contactId,
      lead_type: getProjectType(role),
      source: contact.contact_source ?? "crm_contact",
      source_code: getLeadSourceCode(contact.contact_source),
      title: `${contact.request_type ?? contactRoleLabels[role]} · ${contact.name}`,
      request_type: contact.request_type ?? contactRoleLabels[role],
      project_type: getProjectType(role),
      city: contact.city,
      priority: "normal",
      assigned_to: actorId,
      status: "NEW",
      notes: contact.notes ?? contact.message,
      archived: false,
      dedupe_status: "READY",
      source_payload: {
        qualificationRole: role,
        qualificationStatus,
        createdFrom: "contact-qualification",
      },
    })
    .select("id")
    .single();

  if (createError || !createdLead) {
    console.error("[IMMO-DREAMS83] Contact-to-pipeline creation failed", createError?.message);
    return {
      response: NextResponse.json({ success: false, message: "Le prospect n'a pas pu être créé." }, { status: 500 }),
    };
  }

  const { data: linkedContact, error: linkError } = await supabase
    .from("contacts")
    .update({ pipeline_lead_id: createdLead.id })
    .eq("id", contactId)
    .is("pipeline_lead_id", null)
    .select("pipeline_lead_id")
    .maybeSingle();

  if (linkError) {
    console.error("[IMMO-DREAMS83] Contact-to-pipeline link failed", linkError.message);
    await supabase.from("leads").delete().eq("id", createdLead.id);
    return {
      response: NextResponse.json({ success: false, message: "Le lien avec le pipeline n'a pas pu être enregistré." }, { status: 500 }),
    };
  }

  if (!linkedContact?.pipeline_lead_id) {
    const { data: concurrentContact } = await supabase
      .from("contacts")
      .select("pipeline_lead_id")
      .eq("id", contactId)
      .single();
    await supabase.from("leads").delete().eq("id", createdLead.id);

    if (concurrentContact?.pipeline_lead_id) {
      return {
        leadId: concurrentContact.pipeline_lead_id,
        contactName: contact.name,
        role,
        created: false,
        task: null,
        response: null,
      };
    }

    return {
      response: NextResponse.json({ success: false, message: "Le contact a changé pendant la création. Réessayez." }, { status: 409 }),
    };
  }

  const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const taskResult = await createPipelineTask(
    {
      leadId: createdLead.id,
      title: `Première relance · ${contact.name}`,
      description: `Prospect créé depuis un contact qualifié (${contactRoleLabels[role]}).`,
      dueAt,
      assignedTo: actorId,
      priority: "normal",
      taskType: "CALL",
      recurrenceRule: "NONE",
      reminderChannel: "NONE",
    },
    actorId
  );

  return {
    leadId: createdLead.id,
    contactName: contact.name,
    role,
    created: true,
    task: taskResult.task ?? null,
    taskWarning: taskResult.response ? "Le prospect est créé, mais le rappel doit être ajouté manuellement." : null,
    response: null,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as JsonRecord | null;
  if (!payload?.action) {
    return NextResponse.json({ success: false, message: "Action pipeline invalide." }, { status: 400 });
  }

  if (payload.action === "create-lead-from-contact") {
    const result = await createLeadFromContact(payload, auth.session.user.id);
    if (result.response) return result.response;

    const actorName = auth.session.profile.full_name ?? auth.session.user.email;
    const supabase = getSupabaseAdminClient();
    await supabase?.from("activities").insert({
      entity_type: "lead",
      entity_id: result.leadId,
      action: result.created
        ? `Prospect créé depuis Contact : ${result.contactName}`
        : `Prospect déjà présent dans le pipeline : ${result.contactName}`,
      user_name: actorName,
    });
    await writeAdminAuditLog(
      auth.session,
      result.created ? "pipeline.lead.create_from_contact" : "pipeline.lead.reuse_from_contact",
      "lead",
      result.leadId,
      {
        contactId: getNullableString(payload.contactId),
        contactRole: result.role,
        taskId: result.task?.id ?? null,
      }
    );

    return NextResponse.json({
      success: true,
      message: result.created
        ? result.taskWarning ?? "Prospect créé dans le pipeline avec une première relance."
        : "Ce contact est déjà présent dans le pipeline.",
      leadId: result.leadId,
      created: result.created,
      task: result.task,
    });
  }

  if (payload.action === "create-task") {
    const { task, response } = await createPipelineTask(payload, auth.session.user.id);
    if (response) return response;

    const actorName = auth.session.profile.full_name ?? auth.session.user.email;
    const supabase = getSupabaseAdminClient();
    await supabase?.from("activities").insert({
      entity_type: "lead",
      entity_id: task?.lead_id ?? task?.id,
      action: `Rappel cree : ${task?.title}`,
      user_name: actorName,
    });
    await writeAdminAuditLog(auth.session, "pipeline.task.create", "task", task?.id ?? null, {
      leadId: task?.lead_id,
      priority: task?.priority,
      recurrenceRule: task?.recurrence_rule ?? "NONE",
      reminderChannel: task?.reminder_channel ?? "NONE",
    });

    return NextResponse.json({ success: true, message: "Rappel cree.", task });
  }

  return NextResponse.json({ success: false, message: "Action pipeline inconnue." }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as JsonRecord | null;
  if (!payload?.action) {
    return NextResponse.json({ success: false, message: "Action pipeline invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const actorName = auth.session.profile.full_name ?? auth.session.user.email;

  if (payload.action === "update-lead") {
    const id = getNullableString(payload.id);
    if (!id) return NextResponse.json({ success: false, message: "Lead introuvable." }, { status: 400 });

    const { data: currentLead, error: currentError } = await supabase
      .from("leads")
      .select("id,status,assigned_to")
      .eq("id", id)
      .single();

    if (currentError) {
      console.error("[IMMO-DREAMS83] Pipeline current lead read failed", currentError.message);
      return NextResponse.json({ success: false, message: "Le lead n'a pas pu etre relu." }, { status: 500 });
    }

    const updates: TablesUpdate<"leads"> = {};
    if ("status" in payload) {
      if (!isLeadStatus(payload.status)) {
        return NextResponse.json({ success: false, message: "Statut invalide." }, { status: 400 });
      }
      updates.status = payload.status;
    }
    if ("priority" in payload) {
      if (!isLeadPriority(payload.priority)) {
        return NextResponse.json({ success: false, message: "Priorite invalide." }, { status: 400 });
      }
      updates.priority = payload.priority;
    }
    if ("assignedTo" in payload) {
      const requestedAssignee = getNullableString(payload.assignedTo);
      const canManageAssignments =
        auth.session.profile.role === "ADMIN" || auth.session.profile.role === "DIRECTOR";
      if (!canManageAssignments) {
        return NextResponse.json(
          { success: false, message: "Seule la direction peut réattribuer un dossier." },
          { status: 403 }
        );
      }
      if (requestedAssignee) {
        const assigneeResult = await loadAssignableProfile(supabase, requestedAssignee);
        if (assigneeResult.error) {
          console.error("[IMMO-DREAMS83] Pipeline assignee validation failed", assigneeResult.error.message);
          return NextResponse.json(
            { success: false, message: "Le responsable n'a pas pu être vérifié." },
            { status: 500 }
          );
        }
        if (!assigneeResult.profile) {
          return NextResponse.json(
            { success: false, message: "Ce profil ne peut pas recevoir de dossier." },
            { status: 400 }
          );
        }
      }
      updates.assigned_to = requestedAssignee;
    }
    if ("notes" in payload) updates.notes = getNullableString(payload.notes);
    if ("archived" in payload && typeof payload.archived === "boolean") updates.archived = payload.archived;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, message: "Aucune modification a enregistrer." }, { status: 400 });
    }

    const { error } = await supabase.from("leads").update(updates).eq("id", id);
    if (error) {
      console.error("[IMMO-DREAMS83] Pipeline lead update failed", error.message);
      return NextResponse.json({ success: false, message: "La mise a jour du lead a echoue." }, { status: 500 });
    }

    const previousStatus = safeStatus((currentLead as { status?: string }).status);
    const nextStatus = safeStatus(updates.status ?? previousStatus);
    if (updates.status && previousStatus !== nextStatus) {
      await supabase.from("lead_status_history").insert({
        lead_id: id,
        previous_status: previousStatus,
        next_status: nextStatus,
        changed_by: auth.session.user.id,
      });
    }

    const actionLabel = updates.status
      ? `Statut lead : ${leadStatusLabels[nextStatus]}`
      : updates.priority
        ? `Priorite lead : ${leadPriorityLabels[safePriority(updates.priority)]}`
        : updates.assigned_to === null
          ? "Lead desassigne"
          : updates.assigned_to
            ? "Lead assigne"
            : updates.archived
              ? "Lead archive"
              : "Lead mis a jour";

    await supabase.from("activities").insert({
      entity_type: "lead",
      entity_id: id,
      action: actionLabel,
      user_name: actorName,
    });
    await writeAdminAuditLog(auth.session, "pipeline.lead.update", "lead", id, updates);

    return NextResponse.json({ success: true, message: "Lead mis a jour." });
  }

  if (payload.action === "complete-task") {
    const id = getNullableString(payload.id);
    if (!id) return NextResponse.json({ success: false, message: "Rappel introuvable." }, { status: 400 });

    const completed = payload.completed !== false;
    const fullUpdates = {
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? auth.session.user.id : null,
    };
    let result = await supabase.from("tasks").update(fullUpdates).eq("id", id);

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase
        .from("tasks")
        .update({ completed_at: fullUpdates.completed_at })
        .eq("id", id);
    }

    if (result.error) {
      console.error("[IMMO-DREAMS83] Pipeline task completion failed", result.error.message);
      return NextResponse.json({ success: false, message: "Le rappel n'a pas pu etre mis a jour." }, { status: 500 });
    }

    await supabase.from("activities").insert({
      entity_type: "task",
      entity_id: id,
      action: completed ? "Rappel termine" : "Rappel rouvert",
      user_name: actorName,
    });
    await writeAdminAuditLog(auth.session, "pipeline.task.complete", "task", id, { completed });

    return NextResponse.json({ success: true, message: completed ? "Rappel termine." : "Rappel rouvert." });
  }

  return NextResponse.json({ success: false, message: "Action pipeline inconnue." }, { status: 400 });
}

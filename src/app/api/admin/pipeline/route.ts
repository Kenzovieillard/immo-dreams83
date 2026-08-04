import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import {
  contactRoleLabels,
  isContactQualificationStatus,
  isContactRole,
  isLeadPriority,
  isLeadStatus,
  leadPriorityLabels,
  leadStatusLabels,
} from "@/lib/crm";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  ContactQualificationStatus,
  ContactRole,
  LeadPriority,
  LeadStatus,
  TaskEmailReminderStatus,
  TaskRecurrenceRule,
  TaskReminderChannel,
} from "@/types/crm";

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
  task_type?: string | null;
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
};

const inactiveAppointmentStatuses = new Set(["cancelled", "canceled", "no_show"]);
const activeOfferStatuses = new Set(["DRAFT", "SUBMITTED", "NEGOTIATING", "ACCEPTED"]);
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

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        (error.message && /relation .* does not exist|Could not find the table/i.test(error.message)))
  );
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
    "task_type",
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

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const [leadsResult, tasksResult, profilesResult, appointmentsResult, mandatesResult, offersResult] = await Promise.all([
    supabase
      .from("leads")
      .select([
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
      ].join(","))
      .order("updated_at", { ascending: false })
      .limit(300),
    loadTasks(supabase),
    supabase
      .from("profiles")
      .select("id,email,full_name,role,is_active")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("appointments")
      .select("lead_id,status")
      .limit(1000),
    supabase
      .from("mandates")
      .select("lead_id,status")
      .limit(1000),
    supabase
      .from("offers")
      .select("lead_id,status")
      .limit(1000),
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

  const leads = (leadsResult.data ?? []) as unknown as LeadRow[];
  const profiles = (profilesResult.data ?? []) as unknown as ProfileRow[];
  const tasks = (tasksResult.data ?? []) as unknown as TaskRow[];
  const appointments = (appointmentsResult.data ?? []) as unknown as PipelineObjectRow[];
  const mandates = (mandatesResult.data ?? []) as unknown as PipelineObjectRow[];
  const offers = offersMissing ? [] : (offersResult.data ?? []) as unknown as PipelineObjectRow[];
  const activeAppointments = appointments.filter(
    (appointment) => !inactiveAppointmentStatuses.has((appointment.status ?? "").toLowerCase())
  );
  const activeOffers = offers.filter((offer) => activeOfferStatuses.has((offer.status ?? "").toUpperCase()));
  const activeMandates = mandates.filter((mandate) => activeMandateStatuses.has((mandate.status ?? "").toLowerCase()));
  const appointmentLeadIds = new Set(compactIds(activeAppointments.map((appointment) => appointment.lead_id)));
  const offerLeadIds = new Set(compactIds(activeOffers.map((offer) => offer.lead_id)));
  const mandateLeadIds = new Set(compactIds(activeMandates.map((mandate) => mandate.lead_id)));
  const contactIds = compactIds(leads.map((lead) => lead.contact_id));
  const propertyIds = compactIds(leads.map((lead) => lead.linked_property_id));

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
          .select("id,reference,title")
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

  const payloadLeads = leads.map((lead) => {
    const contact = lead.contact_id ? contactsById.get(lead.contact_id) : null;
    const assignedProfile = lead.assigned_to ? profilesById.get(lead.assigned_to) : null;
    const linkedProperty = lead.linked_property_id ? propertiesById.get(lead.linked_property_id) : null;
    const requestType = lead.request_type ?? lead.title ?? contact?.request_type ?? lead.lead_type ?? "Demande";

    return {
      id: lead.id,
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
      taskType: task.task_type ?? "FOLLOW_UP",
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

  return NextResponse.json({
    success: true,
    leads: payloadLeads,
    tasks: payloadTasks,
    team: profiles.map((profile) => ({
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
    })),
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

async function createPipelineTask(payload: JsonRecord, actorId: string) {
  const leadId = getNullableString(payload.leadId);
  const title = getString(payload.title);
  const description = getNullableString(payload.description);
  const dueAt = getNullableDate(payload.dueAt);
  const assignedTo = getNullableString(payload.assignedTo);
  const priority = safePriority(payload.priority);
  const taskType = getString(payload.taskType) || "FOLLOW_UP";
  const recurrenceRule = safeRecurrenceRule(payload.recurrenceRule);
  const reminderChannel = safeReminderChannel(payload.reminderChannel);
  const emailReminderEnabled = reminderChannel === "EMAIL" && Boolean(dueAt);
  const emailReminderStatus = emailReminderEnabled ? "PENDING" : "NOT_SCHEDULED";

  if (!leadId || !title) {
    return { response: NextResponse.json({ success: false, message: "Lead et titre de rappel obligatoires." }, { status: 400 }) };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { response: NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 }) };
  }

  const fullInsert = {
    lead_id: leadId,
    assigned_to: assignedTo,
    created_by: actorId,
    title,
    description,
    due_at: dueAt,
    priority,
    task_type: taskType,
    recurrence_rule: recurrenceRule,
    reminder_channel: reminderChannel,
    email_reminder_enabled: emailReminderEnabled,
    email_reminder_status: emailReminderStatus,
    email_reminder_scheduled_at: emailReminderEnabled ? dueAt : null,
  };
  let result = await supabase.from("tasks").insert(fullInsert).select("*").single();

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
      .select("id,status")
      .eq("id", id)
      .single();

    if (currentError) {
      console.error("[IMMO-DREAMS83] Pipeline current lead read failed", currentError.message);
      return NextResponse.json({ success: false, message: "Le lead n'a pas pu etre relu." }, { status: 500 });
    }

    const updates: JsonRecord = {};
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
    if ("assignedTo" in payload) updates.assigned_to = getNullableString(payload.assignedTo);
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

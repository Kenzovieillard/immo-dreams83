import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import {
  isLeadPriority,
  isLeadStatus,
  leadPriorityLabels,
  leadStatusLabels,
} from "@/lib/crm";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { LeadPriority, LeadStatus } from "@/types/crm";

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
  created_at: string;
  updated_at: string;
};

function compactIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function safeStatus(value: unknown): LeadStatus {
  return isLeadStatus(value) ? value : "NEW";
}

function safePriority(value: unknown): LeadPriority {
  return isLeadPriority(value) ? value : "normal";
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

  const [leadsResult, tasksResult, profilesResult] = await Promise.all([
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
  ]);

  const error = leadsResult.error ?? tasksResult.error ?? profilesResult.error;
  if (error) {
    console.error("[IMMO-DREAMS83] Pipeline load failed", error.message);
    return NextResponse.json({ success: false, message: "Le pipeline CRM n'a pas pu etre charge." }, { status: 500 });
  }

  const leads = (leadsResult.data ?? []) as unknown as LeadRow[];
  const profiles = (profilesResult.data ?? []) as unknown as ProfileRow[];
  const tasks = (tasksResult.data ?? []) as unknown as TaskRow[];
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

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as JsonRecord | null;
  if (!payload || payload.action !== "create-task") {
    return NextResponse.json({ success: false, message: "Action pipeline invalide." }, { status: 400 });
  }

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
  });

  return NextResponse.json({ success: true, message: "Rappel cree.", task });
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

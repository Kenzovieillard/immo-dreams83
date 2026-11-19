import "server-only";

import {
  agendaDetailsSchema,
  agendaPriorities,
  agendaTaskTypes,
  agendaTypes,
  type AgendaData,
  type AgendaEntry,
  type AgendaOption,
  type AgendaReference,
  type AgendaSource,
  type AgendaStatus,
  type AgendaView,
} from "@/lib/agenda";
import {
  agendaDayItems,
  agendaRange,
  agendaReminderAt,
  parisDay,
  shiftAgendaDay,
} from "@/lib/agenda-time";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { AdminSession } from "@/types/admin";
import type { Database } from "@/types/supabase";

type Client = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
type Tables = Database["public"]["Tables"];
type Appointment = Tables["appointments"]["Row"];
type Estimation = Tables["estimations"]["Row"];
type Task = Tables["tasks"]["Row"];
type Profile = Pick<
  Tables["profiles"]["Row"],
  "id" | "full_name" | "email" | "role"
>;

export class AgendaDataError extends Error {
  constructor(
    message: string,
    public readonly status = 503,
  ) {
    super(message);
  }
}

const roles: readonly Profile["role"][] = [
  "ADMIN",
  "DIRECTOR",
  "AGENT",
  "ASSISTANT",
];
function client() {
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    throw new AgendaDataError("Le service Agenda est indisponible.");
  return supabase;
}
export function agendaViewer(session: AdminSession) {
  const { role } = session.profile;
  const canAssign = role === "ADMIN" || role === "DIRECTOR";
  return {
    id: session.user.id,
    canWrite: roles.includes(role),
    canAssign,
    canDelete: canAssign,
  };
}
function scope(session: AdminSession, assignee?: string | null) {
  const viewer = agendaViewer(session);
  if (assignee && !viewer.canAssign && assignee !== viewer.id)
    throw new AgendaDataError("Cet agenda est réservé à son responsable.", 403);
  return viewer.canAssign ? (assignee ?? null) : viewer.id;
}

async function readPages<T>(
  read: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await read(offset, offset + 499);
    if (result.error || !result.data)
      throw result.error ?? new AgendaDataError("Lecture incomplète.");
    rows.push(...result.data);
    if (result.data.length < 500) return rows;
  }
}

const appointmentFields =
  "id,appointment_type,title,status,visit_status,assigned_to,contact_id,property_id,starts_at,ends_at,location,comment,updated_at,agenda_details,agenda_reminder_minutes" as const;
const estimationFields =
  "id,name,commercial_reference,commercial_status,assigned_to,contact_id,appointment_at,appointment_location,property_address,property_type,surface,notes,duration_minutes,updated_at,agenda_details,agenda_reminder_minutes" as const;
const taskFields =
  "id,title,status,assigned_to,contact_id,property_id,appointment_id,description,due_at,completed_at,priority,task_type,updated_at,agenda_details,agenda_reminder_minutes" as const;

type AppointmentRead = Pick<
  Appointment,
  | "id"
  | "appointment_type"
  | "title"
  | "status"
  | "visit_status"
  | "assigned_to"
  | "contact_id"
  | "property_id"
  | "starts_at"
  | "ends_at"
  | "location"
  | "comment"
  | "updated_at"
  | "agenda_details"
  | "agenda_reminder_minutes"
>;
type EstimationRead = Pick<
  Estimation,
  | "id"
  | "name"
  | "commercial_reference"
  | "commercial_status"
  | "assigned_to"
  | "contact_id"
  | "appointment_at"
  | "appointment_location"
  | "property_address"
  | "property_type"
  | "surface"
  | "notes"
  | "duration_minutes"
  | "updated_at"
  | "agenda_details"
  | "agenda_reminder_minutes"
>;
type TaskRead = Pick<
  Task,
  | "id"
  | "title"
  | "status"
  | "assigned_to"
  | "contact_id"
  | "property_id"
  | "appointment_id"
  | "description"
  | "due_at"
  | "completed_at"
  | "priority"
  | "task_type"
  | "updated_at"
  | "agenda_details"
  | "agenda_reminder_minutes"
>;

function details(value: unknown) {
  return agendaDetailsSchema.safeParse(value).data ?? {};
}
function status(value: string): AgendaStatus {
  switch (value.toLowerCase()) {
    case "completed":
    case "done":
      return "completed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "confirmed":
      return "confirmed";
    case "to_confirm":
      return "to_confirm";
    case "missed":
    case "no_show":
      return "missed";
    case "todo":
      return "todo";
    case "in_progress":
      return "in_progress";
    default:
      return "planned";
  }
}
function shifted(value: string, minutes: number) {
  return new Date(Date.parse(value) + minutes * 60000).toISOString();
}
function toAppointment(row: AppointmentRead): AgendaEntry {
  const type =
    Object.hasOwn(agendaTypes, row.appointment_type) &&
    row.appointment_type !== "TASK"
      ? (row.appointment_type as AgendaEntry["type"])
      : "MEETING";
  return {
    id: row.id,
    source: "appointment",
    type,
    title: row.title,
    status: status(type === "VISIT" ? row.visit_status : row.status),
    assigneeId: row.assigned_to,
    assignee: null,
    contactId: row.contact_id,
    contact: null,
    propertyId: row.property_id,
    appointmentId: null,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? shifted(row.starts_at, 30),
    dueAt: null,
    completedAt: null,
    notes: row.comment ?? "",
    location: row.location ?? "",
    priority: details(row.agenda_details).priority ?? "normal",
    taskType: "APPOINTMENT",
    reminderMinutes: row.agenda_reminder_minutes,
    updatedAt: row.updated_at,
    details: details(row.agenda_details),
  };
}
function toEstimation(row: EstimationRead): AgendaEntry {
  const custom =
    row.agenda_details &&
    typeof row.agenda_details === "object" &&
    !Array.isArray(row.agenda_details)
      ? row.agenda_details.state
      : null;
  const estimateStatus =
    custom === "cancelled" || custom === "completed"
      ? custom
      : ["COMPLETED", "REPORT_SENT", "FINISHED"].includes(row.commercial_status)
        ? "completed"
        : row.commercial_status === "NO_FOLLOW_UP"
          ? "cancelled"
          : "planned";
  return {
    id: row.id,
    source: "estimation",
    type: "ESTIMATION",
    title: `Estimation · ${row.name}`,
    status: estimateStatus,
    assigneeId: row.assigned_to,
    assignee: null,
    contactId: row.contact_id,
    contact: null,
    propertyId: null,
    appointmentId: null,
    startsAt: row.appointment_at,
    endsAt: row.appointment_at
      ? shifted(row.appointment_at, row.duration_minutes || 60)
      : null,
    dueAt: null,
    completedAt: null,
    location: row.appointment_location || row.property_address || "",
    notes: row.notes ?? "",
    priority: "normal",
    taskType: "APPOINTMENT",
    reminderMinutes: row.agenda_reminder_minutes,
    updatedAt: row.updated_at,
    details: details(row.agenda_details),
    estimation: { propertyType: row.property_type, surface: row.surface },
  };
}
function toTask(row: TaskRead): AgendaEntry {
  return {
    id: row.id,
    source: "task",
    type: "TASK",
    title: row.title,
    status: row.completed_at ? "completed" : status(row.status),
    assigneeId: row.assigned_to,
    assignee: null,
    contactId: row.contact_id,
    contact: null,
    propertyId: row.property_id,
    appointmentId: row.appointment_id,
    startsAt: null,
    endsAt: null,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    location: "",
    notes: row.description ?? "",
    priority: Object.hasOwn(agendaPriorities, row.priority)
      ? (row.priority as AgendaEntry["priority"])
      : "normal",
    taskType: Object.hasOwn(agendaTaskTypes, row.task_type)
      ? (row.task_type as AgendaEntry["taskType"])
      : "ADMIN",
    reminderMinutes: row.agenda_reminder_minutes,
    updatedAt: row.updated_at,
    details: details(row.agenda_details),
  };
}
function profileName(profile: Profile) {
  return profile.full_name || profile.email || "Conseiller";
}

export async function loadAgenda(
  session: AdminSession,
  date: string,
  view: AgendaView,
  assignee?: string | null,
): Promise<AgendaData> {
  const db = client();
  const owner = scope(session, assignee);
  const viewer = agendaViewer(session);
  const visibleRange = agendaRange(date, view);
  const calendar = view === "tasks" ? visibleRange : agendaRange(date, "month");
  const { from, to } = calendar;
  const now = new Date().toISOString();
  const reminderLimit = shifted(now, 10080);
  let events = db
    .from("appointments")
    .select(appointmentFields)
    .lt("starts_at", to)
    .or(
      `ends_at.gt.${from},and(ends_at.is.null,starts_at.gte.${shifted(from, -30)})`,
    )
    .order("starts_at")
    .order("id");
  let estimates = db
    .from("estimations")
    .select(estimationFields)
    .eq("archived", false)
    .gte("appointment_at", shifted(from, -1440))
    .lt("appointment_at", to)
    .order("appointment_at")
    .order("id");
  let tasks = db
    .from("tasks")
    .select(taskFields)
    .order("due_at", { nullsFirst: false })
    .order("id");
  let reminderEvents = db
    .from("appointments")
    .select(appointmentFields)
    .not("agenda_reminder_minutes", "is", null)
    .gte("starts_at", shifted(now, -1440))
    .lte("starts_at", reminderLimit)
    .order("id");
  let reminderEstimates = db
    .from("estimations")
    .select(estimationFields)
    .eq("archived", false)
    .not("agenda_reminder_minutes", "is", null)
    .gte("appointment_at", shifted(now, -1440))
    .lte("appointment_at", reminderLimit)
    .order("id");
  let team = db
    .from("profiles")
    .select("id,full_name,email,role")
    .eq("is_active", true)
    .in("role", roles)
    .order("full_name");
  if (owner) {
    events = events.eq("assigned_to", owner);
    estimates = estimates.eq("assigned_to", owner);
    tasks = tasks.eq("assigned_to", owner);
    reminderEvents = reminderEvents.eq("assigned_to", owner);
    reminderEstimates = reminderEstimates.eq("assigned_to", owner);
  }
  if (!viewer.canAssign) team = team.eq("id", viewer.id);

  const [
    appointments,
    estimations,
    taskRows,
    teamResult,
    pendingEvents,
    pendingEstimates,
  ] = await Promise.all([
    readPages<AppointmentRead>((start, end) => events.range(start, end)),
    readPages<EstimationRead>((start, end) => estimates.range(start, end)),
    readPages<TaskRead>((start, end) => tasks.range(start, end)),
    team.limit(500),
    readPages<AppointmentRead>((start, end) =>
      reminderEvents.range(start, end),
    ),
    readPages<EstimationRead>((start, end) =>
      reminderEstimates.range(start, end),
    ),
  ]);
  if (teamResult.error) throw teamResult.error;
  const teamRows = teamResult.data ?? [];
  const entries = [
    ...appointments.map(toAppointment),
    ...estimations
      .map(toEstimation)
      .filter(
        (item) => item.endsAt && Date.parse(item.endsAt) > Date.parse(from),
      ),
  ].sort(
    (a, b) =>
      (a.startsAt ?? "").localeCompare(b.startsAt ?? "") ||
      a.id.localeCompare(b.id),
  );
  const taskItems = taskRows.map(toTask);
  const contacts = new Map<string, string>();
  const names = new Map(
    teamRows.map((profile) => [profile.id, profileName(profile)]),
  );
  const ids = [
    ...new Set(
      [...entries, ...taskItems].flatMap((item) =>
        item.contactId ? [item.contactId] : [],
      ),
    ),
  ];
  for (let offset = 0; offset < ids.length; offset += 100) {
    let lookup = db
      .from("contacts")
      .select("id,name")
      .eq("archived", false)
      .in("id", ids.slice(offset, offset + 100));
    if (!viewer.canAssign) lookup = lookup.eq("assigned_to", viewer.id);
    const result = await lookup;
    if (result.error) throw result.error;
    for (const person of result.data) contacts.set(person.id, person.name);
  }
  const hydrate = (item: AgendaEntry) => ({
    ...item,
    contact: contacts.get(item.contactId ?? "") ?? null,
    assignee: names.get(item.assigneeId ?? "") ?? null,
  });
  return {
    viewer,
    assignees: teamRows.map((profile) => ({
      id: profile.id,
      label: profileName(profile),
    })),
    events: entries
      .filter(
        (item) =>
          item.startsAt &&
          item.endsAt &&
          Date.parse(item.startsAt) < Date.parse(visibleRange.to) &&
          Date.parse(item.endsAt) > Date.parse(visibleRange.from),
      )
      .map(hydrate),
    tasks: taskItems.map(hydrate),
    monthCounts: Object.fromEntries(
      Array.from({ length: calendar.length }, (_, index) => {
        const day = shiftAgendaDay(calendar.first, index);
        return [day, agendaDayItems(entries, day).length];
      }),
    ),
    reminders: [
      ...pendingEvents.map(toAppointment),
      ...pendingEstimates.map(toEstimation),
      ...taskItems,
    ]
      .filter((item) => {
        const due = agendaReminderAt(item);
        return (
          due !== null &&
          Date.parse(due) <= Date.parse(now) &&
          (item.endsAt === null || Date.parse(item.endsAt) >= Date.parse(now))
        );
      })
      .map(hydrate),
  };
}

async function loadEntry(
  db: Client,
  session: AdminSession,
  source: AgendaSource,
  id: string,
) {
  const owner = scope(session);
  if (source === "task") {
    let query = db.from("tasks").select(taskFields).eq("id", id);
    if (owner) query = query.eq("assigned_to", owner);
    const result = await query.maybeSingle();
    if (result.error) throw result.error;
    return result.data ? toTask(result.data) : null;
  }
  if (source === "estimation") {
    let query = db
      .from("estimations")
      .select(estimationFields)
      .eq("id", id)
      .eq("archived", false);
    if (owner) query = query.eq("assigned_to", owner);
    const result = await query.maybeSingle();
    if (result.error) throw result.error;
    return result.data ? toEstimation(result.data) : null;
  }
  let query = db.from("appointments").select(appointmentFields).eq("id", id);
  if (owner) query = query.eq("assigned_to", owner);
  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  return result.data ? toAppointment(result.data) : null;
}

async function readParty(
  db: Client,
  id: string | null | undefined,
  owner: string | null,
) {
  if (!id) return null;
  let contact = db
    .from("contacts")
    .select("id,name,phone,email,city")
    .eq("id", id)
    .eq("archived", false);
  if (owner) contact = contact.eq("assigned_to", owner);
  const result = await contact.maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

export async function loadAgendaEntry(
  session: AdminSession,
  source: AgendaSource,
  id: string,
): Promise<{ item: AgendaEntry; reference: AgendaReference }> {
  const db = client();
  const owner = scope(session);
  const item = await loadEntry(db, session, source, id);
  if (!item)
    throw new AgendaDataError(
      "Cette activité est introuvable ou hors de votre périmètre.",
      404,
    );
  const [contact, seller, propertyResult, profileResult] = await Promise.all([
    readParty(db, item.contactId, owner),
    readParty(db, item.details.sellerId, owner),
    item.propertyId
      ? db
          .from("properties")
          .select(
            "id,reference,title,city,price,surface,rooms,land_surface,archived_at,photos",
          )
          .eq("id", item.propertyId)
          .maybeSingle()
      : null,
    item.assigneeId
      ? db
          .from("profiles")
          .select("id,full_name,email,role")
          .eq("id", item.assigneeId)
          .maybeSingle()
      : null,
  ]);
  if (propertyResult?.error || profileResult?.error)
    throw propertyResult?.error ?? profileResult?.error;
  const property = propertyResult?.data;
  const profile = profileResult?.data;
  let timeline: AgendaReference["contact"] extends infer Contact
    ? NonNullable<Contact> extends { timeline: infer Timeline }
      ? Timeline
      : never
    : never = [];
  if (contact) {
    let events = db
      .from("appointments")
      .select("id,title,starts_at")
      .eq("contact_id", contact.id);
    let tasks = db
      .from("tasks")
      .select("id,title,updated_at")
      .eq("contact_id", contact.id)
      .not("completed_at", "is", null);
    if (owner) {
      events = events.eq("assigned_to", owner);
      tasks = tasks.eq("assigned_to", owner);
    }
    const [eventResult, taskResult] = await Promise.all([
      events.order("starts_at", { ascending: false }).limit(8),
      tasks.order("updated_at", { ascending: false }).limit(8),
    ]);
    if (eventResult.error || taskResult.error)
      throw eventResult.error ?? taskResult.error;
    timeline = [
      ...eventResult.data.map((entry) => ({
        id: entry.id,
        label: entry.title,
        date: entry.starts_at,
      })),
      ...taskResult.data.map((entry) => ({
        id: entry.id,
        label: entry.title,
        date: entry.updated_at,
      })),
    ]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 8);
  }
  let assignee: AgendaReference["assignee"] = null;
  if (profile) {
    const { from, to } = agendaRange(parisDay(), "week");
    const [events, estimates, tasks] = await Promise.all([
      db
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", profile.id)
        .gte("starts_at", from)
        .lt("starts_at", to)
        .neq("status", "cancelled")
        .neq("visit_status", "CANCELLED"),
      db
        .from("estimations")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", profile.id)
        .eq("archived", false)
        .gte("appointment_at", from)
        .lt("appointment_at", to)
        .neq("commercial_status", "NO_FOLLOW_UP"),
      db
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", profile.id)
        .gte("completed_at", from)
        .lt("completed_at", to),
    ]);
    if (events.error || estimates.error || tasks.error)
      throw events.error ?? estimates.error ?? tasks.error;
    assignee = {
      id: profile.id,
      label: profileName(profile),
      role: profile.role,
      email: profile.email,
      weekEvents: (events.count ?? 0) + (estimates.count ?? 0),
      weekCompletedTasks: tasks.count ?? 0,
    };
  }
  return {
    item: {
      ...item,
      contact: contact?.name ?? null,
      assignee: assignee?.label ?? null,
    },
    reference: {
      contact: contact
        ? {
            id: contact.id,
            label: contact.name,
            phone: contact.phone,
            email: contact.email,
            city: contact.city,
            timeline,
          }
        : null,
      seller: seller
        ? {
            id: seller.id,
            label: seller.name,
            phone: seller.phone,
            email: seller.email,
          }
        : null,
      property: property
        ? {
            id: property.id,
            label: property.title,
            note: `Réf. ${property.reference} · ${property.city}`,
            price: property.price,
            surface: property.surface,
            rooms: property.rooms,
            land: property.land_surface,
            archived: Boolean(property.archived_at),
            photo: Array.isArray(property.photos)
              ? (property.photos.find(
                  (photo): photo is string =>
                    typeof photo === "string" && photo.startsWith("https://"),
                ) ?? null)
              : null,
          }
        : null,
      assignee,
    },
  };
}

export async function searchAgendaOptions(
  session: AdminSession,
  type: "contact" | "property" | "estimation",
  text: string,
  id?: string,
): Promise<AgendaOption[]> {
  const db = client();
  const owner = scope(session);
  const q = text.replace(/[^\p{L}\p{N} &'’-]/gu, " ").trim();
  if (type === "contact") {
    let search = db
      .from("contacts")
      .select("id,name,city,phone,email")
      .eq("archived", false)
      .order("name");
    if (owner) search = search.eq("assigned_to", owner);
    if (id) search = search.eq("id", id);
    else if (q) search = search.ilike("name", `%${q}%`);
    const result = await search.limit(30);
    if (result.error) throw result.error;
    return result.data.map((person) => ({
      id: person.id,
      label: person.name,
      note: person.city ?? undefined,
      phone: person.phone,
      email: person.email,
    }));
  }
  if (type === "property") {
    let search = db
      .from("properties")
      .select("id,reference,title,city")
      .is("archived_at", null)
      .order("title");
    if (id) search = search.eq("id", id);
    else if (q)
      search = search.or(
        `title.ilike.%${q}%,city.ilike.%${q}%,reference.ilike.%${q}%`,
      );
    const result = await search.limit(30);
    if (result.error) throw result.error;
    return result.data.map((property) => ({
      id: property.id,
      label: property.title,
      note: `Réf. ${property.reference} · ${property.city}`,
      location: property.city,
    }));
  }
  let search = db
    .from("estimations")
    .select(
      "id,name,commercial_reference,contact_id,assigned_to,appointment_at,appointment_location,property_address,property_type,surface,duration_minutes,updated_at",
    )
    .eq("archived", false)
    .in("commercial_status", ["NEW_REQUEST", "TO_CONTACT", "SCHEDULED"])
    .order("created_at", { ascending: false });
  if (owner) search = search.eq("assigned_to", owner);
  if (id) search = search.eq("id", id);
  else if (q)
    search = search.or(`name.ilike.%${q}%,commercial_reference.ilike.%${q}%`);
  const result = await search.limit(30);
  if (result.error) throw result.error;
  return result.data.map((entry) => ({
    id: entry.id,
    label: entry.name,
    note: entry.commercial_reference ?? "Estimation",
    revision: entry.updated_at,
    contactId: entry.contact_id,
    assigneeId: entry.assigned_to,
    startsAt: entry.appointment_at,
    location: entry.appointment_location ?? entry.property_address,
    duration: entry.duration_minutes,
    estimation: { propertyType: entry.property_type, surface: entry.surface },
  }));
}

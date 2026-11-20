import "server-only";

import { agendaEntryHref, parisDay, parisInstant, shiftAgendaDay, weekStart } from "@/lib/agenda-time";
import { readNotificationPreferences, readSettingsRows, type SettingsDb } from "@/lib/crm-settings-service";
import { statisticsHref } from "@/lib/statistics";
import type { AdminSession } from "@/types/admin";
import type { InboxItem } from "./crm-settings";

const dayMs = 86_400_000;

export async function readCrmInbox(db: SettingsDb, session: AdminSession, now = new Date()) {
  const owner = session.user.id;
  const { preferences, seenAt } = await readNotificationPreferences(db, owner);
  const since = new Date(+now - 30 * dayMs).toISOString();
  const instant = now.toISOString();
  const coming = new Date(+now + 7 * dayMs).toISOString();
  const [contacts, estimates, visits, offers, tasks, scheduledEstimates] = await Promise.all([
    preferences.contact ? db.from("contacts").select("id,name,created_at,updated_at").eq("assigned_to", owner).eq("archived", false)
      .is("canonical_contact_id", null).gte("updated_at", since).order("updated_at", { ascending: false }).limit(12) : null,
    preferences.estimate ? db.from("estimations").select("id,city,requested_at").eq("assigned_to", owner).eq("archived", false)
      .gte("requested_at", since).order("requested_at", { ascending: false }).limit(12) : null,
    preferences.visit || preferences.reminder ? db.from("appointments")
      .select("id,title,starts_at,created_at,appointment_type,agenda_reminder_minutes").eq("assigned_to", owner)
      .neq("visit_status", "CANCELLED").not("status", "in", "(CANCELLED,COMPLETED)").gte("starts_at", instant).lte("starts_at", coming)
      .order("starts_at").limit(60) : null,
    preferences.offer && ["ADMIN", "DIRECTOR", "AGENT"].includes(session.profile.role)
      ? db.from("offers").select("id,created_at").eq("responsible_user_id", owner).eq("is_test", false)
        .neq("status", "DRAFT").gte("created_at", since).order("created_at", { ascending: false }).limit(12) : null,
    preferences.overdue ? db.from("tasks").select("id,title,due_at").eq("assigned_to", owner).is("completed_at", null)
      .not("status", "in", "(CANCELLED,COMPLETED)").lte("due_at", instant).order("due_at", { ascending: false }).limit(20) : null,
    preferences.reminder ? db.from("estimations").select("id,city,appointment_at,agenda_reminder_minutes").eq("assigned_to", owner)
      .eq("archived", false).eq("commercial_status", "SCHEDULED").gte("appointment_at", instant).lte("appointment_at", coming)
      .order("appointment_at").limit(40) : null,
  ]);
  const entries: InboxItem[] = [];
  function add(id: string, title: string, summary: string, date: string, href: string) {
    if (Date.parse(date) > +now) return;
    entries.push({ id, title, summary, date, href, unread: !seenAt || Date.parse(date) > Date.parse(seenAt) });
  }
  for (const item of contacts ? readSettingsRows(contacts) ?? [] : []) {
    add(`contact:${item.id}`, "Contact dans votre portefeuille", item.name, item.updated_at ?? item.created_at, `/admin?tab=contacts&contact=${item.id}`);
  }
  for (const item of estimates ? readSettingsRows(estimates) ?? [] : []) {
    add(`estimate:${item.id}`, "Estimation demandée", item.city || "Estimation attribuée", item.requested_at, `/commercial/estimations/${item.id}`);
  }
  for (const item of visits ? readSettingsRows(visits) ?? [] : []) {
    const href = agendaEntryHref("appointment", item.id, item.starts_at);
    if (preferences.visit && item.appointment_type === "VISIT" && item.created_at >= since) {
      add(`visit:${item.id}`, "Visite planifiée", item.title, item.created_at, href);
    }
    if (preferences.reminder) {
      const at = new Date(Date.parse(item.starts_at) - (item.agenda_reminder_minutes ?? preferences.reminderMinutes) * 60_000);
      add(`reminder:appointment:${item.id}`, "Rappel de rendez-vous", item.title, at.toISOString(), href);
    }
  }
  for (const item of scheduledEstimates ? readSettingsRows(scheduledEstimates) ?? [] : []) {
    if (!item.appointment_at) continue;
    const at = new Date(Date.parse(item.appointment_at) - (item.agenda_reminder_minutes ?? preferences.reminderMinutes) * 60_000);
    add(`reminder:estimate:${item.id}`, "Rappel d’estimation", item.city || "Estimation planifiée", at.toISOString(), agendaEntryHref("estimation", item.id, item.appointment_at));
  }
  for (const item of offers ? readSettingsRows(offers) ?? [] : []) {
    add(`offer:${item.id}`, "Offre attribuée", "Consulter les détails de l’offre", item.created_at, `/commercial/offres/${item.id}`);
  }
  for (const item of tasks ? readSettingsRows(tasks) ?? [] : []) {
    if (item.due_at) add(`task:${item.id}`, "Tâche en retard", item.title, item.due_at, agendaEntryHref("task", item.id, item.due_at));
  }

  const start = weekStart(parisDay(now)), monday = parisInstant(`${start}T00:00`)!;
  if (preferences.weekly) add(`weekly:${start}`, "Rapport de la semaine passée", "Consulter le bilan dans Statistiques", monday,
    statisticsHref("overview", { from: shiftAgendaDay(start, -7), to: shiftAgendaDay(start, -1) }));
  const release = process.env.CRM_RELEASE_PUBLISHED_AT;
  const message = process.env.CRM_RELEASE_MESSAGE?.trim();
  if (preferences.release && release && message && Number.isFinite(Date.parse(release)) && Date.parse(release) >= +now - 30 * dayMs) {
    add(`release:${release}`, "Mise à jour du CRM", message.slice(0, 240), new Date(release).toISOString(), "/admin?tab=settings");
  }

  const results = entries.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 30);
  return { items: results, unread: results.filter(row => row.unread).length };
}

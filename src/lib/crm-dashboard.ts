import type { AdminCrmLead, PipelineLead, PipelineTask } from "@/types/crm";

export type CrmDailyPriorityTone = "neutral" | "success" | "warning" | "danger";

export type CrmDailyPriority = {
  id: string;
  badge: string;
  title: string;
  context: string;
  timeLabel: string;
  actionLabel: string;
  tone: CrmDailyPriorityTone;
  tab: "contacts" | "pipeline";
  contactId?: string;
  rank: number;
  timestamp: number;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatAge(value: string, now: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";

  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (elapsedMinutes < 60) return `Reçu il y a ${elapsedMinutes} min`;

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Reçu il y a ${elapsedHours} h`;

  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function taskContext(task: PipelineTask, lead?: PipelineLead) {
  const contact = lead?.contactName ?? "Prospect";
  const location = lead?.city ? ` · ${lead.city}` : "";
  const owner = task.assignedToName ? ` · ${task.assignedToName}` : "";
  return `${contact}${location}${owner}`;
}

export function buildCrmDailyPriorities({
  contacts,
  leads,
  tasks,
  now = new Date(),
}: {
  contacts: AdminCrmLead[];
  leads: PipelineLead[];
  tasks: PipelineTask[];
  now?: Date;
}) {
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const dayStart = startOfDay(now).getTime();
  const priorities: CrmDailyPriority[] = [];

  tasks
    .filter((task) => !task.completedAt && task.dueAt)
    .forEach((task) => {
      const due = new Date(task.dueAt!);
      if (Number.isNaN(due.getTime()) || (!isSameDay(due, now) && due.getTime() >= dayStart)) return;

      const overdue = due.getTime() < now.getTime();
      priorities.push({
        id: `task-${task.id}`,
        badge: overdue ? "En retard" : "À faire",
        title: task.title,
        context: taskContext(task, task.leadId ? leadById.get(task.leadId) : undefined),
        timeLabel: overdue ? `Prévu à ${formatClock(due)}` : `Aujourd'hui · ${formatClock(due)}`,
        actionLabel: overdue ? "Relancer maintenant" : "Ouvrir la tâche",
        tone: overdue ? "danger" : "warning",
        tab: "pipeline",
        rank: overdue ? 0 : 3,
        timestamp: due.getTime(),
      });
    });

  leads
    .filter((lead) => !lead.archived && lead.status === "NEW" && !lead.assignedTo)
    .forEach((lead) => {
      priorities.push({
        id: `unassigned-${lead.id}`,
        badge: "Non attribué",
        title: `Attribuer ${lead.contactName}`,
        context: `${lead.requestType}${lead.city ? ` · ${lead.city}` : ""}`,
        timeLabel: formatAge(lead.createdAt, now),
        actionLabel: "Attribuer maintenant",
        tone: "danger",
        tab: "pipeline",
        rank: 1,
        timestamp: new Date(lead.createdAt).getTime(),
      });
    });

  contacts
    .filter((contact) => !contact.archived && contact.qualificationStatus === "TO_REVIEW")
    .forEach((contact) => {
      priorities.push({
        id: `qualification-${contact.id}`,
        badge: "À qualifier",
        title: `Qualifier ${contact.name}`,
        context: `${contact.category}${contact.city !== "Non renseignée" ? ` · ${contact.city}` : ""}`,
        timeLabel: formatAge(contact.createdAt, now),
        actionLabel: "Qualifier le contact",
        tone: "warning",
        tab: "contacts",
        contactId: contact.id,
        rank: 2,
        timestamp: new Date(contact.createdAt).getTime(),
      });
    });

  contacts
    .filter(
      (contact) =>
        !contact.archived &&
        contact.qualificationStatus === "QUALIFIED" &&
        contact.activeProspect &&
        contact.contactRole !== "UNKNOWN" &&
        !contact.pipelineLeadId
    )
    .forEach((contact) => {
      priorities.push({
        id: `pipeline-${contact.id}`,
        badge: "Prêt pipeline",
        title: `Créer le prospect ${contact.name}`,
        context: `${contact.category}${contact.city !== "Non renseignée" ? ` · ${contact.city}` : ""}`,
        timeLabel: "Qualification validée",
        actionLabel: "Créer le prospect",
        tone: "success",
        tab: "contacts",
        contactId: contact.id,
        rank: 2,
        timestamp: new Date(contact.qualifiedAt ?? contact.createdAt).getTime(),
      });
    });

  return priorities.sort((first, second) => {
    if (first.rank !== second.rank) return first.rank - second.rank;
    return first.rank <= 1
      ? first.timestamp - second.timestamp
      : second.timestamp - first.timestamp;
  });
}

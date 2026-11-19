import { z } from "zod";
import type { AdminRole } from "@/types/admin";
import type { AdminCrmLead, PipelineTask } from "@/types/crm";

export const contactActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("update-project"),
      projectId: z.string().uuid(),
      budgetMin: z.number().finite().nonnegative().nullable(),
      budgetMax: z.number().finite().nonnegative().nullable(),
      financingApproved: z.boolean(),
      city: z.string().trim().max(250),
      notes: z.string().trim().max(4000),
    })
    .refine(
      (value) =>
        value.budgetMin == null ||
        value.budgetMax == null ||
        value.budgetMin <= value.budgetMax,
      { message: "Budget minimum supérieur au maximum." },
    ),
  z.object({
    action: z.literal("create-task"),
    title: z.string().trim().min(2).max(200),
    dueAt: z.string().datetime({ offset: true }),
    assignedTo: z.string().uuid().nullable(),
    description: z.string().trim().max(4000).default(""),
  }),
  z.object({
    action: z.literal("complete-task"),
    taskId: z.string().uuid(),
    completed: z.boolean(),
  }),
  z.object({
    action: z.literal("log-activity"),
    kind: z.enum(["CALL", "EMAIL", "NOTE", "MEETING"]),
    description: z.string().trim().min(2).max(4000),
  }),
]);
export type ContactAction = z.infer<typeof contactActionSchema>;
export function contactPermissions(role: AdminRole) {
  return {
    canWrite: ["ADMIN", "DIRECTOR", "AGENT", "ASSISTANT"].includes(role),
    canDelete: ["ADMIN", "DIRECTOR"].includes(role),
    canAssign: ["ADMIN", "DIRECTOR", "ASSISTANT"].includes(role),
    canExport: ["ADMIN", "DIRECTOR", "AGENT", "ASSISTANT"].includes(role),
  };
}
export function normalizeContactSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}
export function contactNeedsFollowUp(
  contactId: string,
  leadIds: string[],
  tasks: PipelineTask[],
  now = Date.now(),
) {
  return tasks.some(
    (task) =>
      !task.completedAt &&
      task.status !== "COMPLETED" &&
      task.status !== "CANCELLED" &&
      task.dueAt &&
      Date.parse(task.dueAt) <= now &&
      (task.contactId === contactId ||
        (!!task.leadId && leadIds.includes(task.leadId))),
  );
}
export function findContactDuplicate(
  lead: AdminCrmLead,
  contacts: AdminCrmLead[],
) {
  if (["IGNORED", "MERGED"].includes(lead.dedupeStatus)) return null;
  return (
    contacts.find(
      (candidate) =>
        candidate.id !== lead.id &&
        !candidate.archived &&
        !["IGNORED", "MERGED"].includes(candidate.dedupeStatus) &&
        ((!!lead.normalizedEmail &&
          !lead.normalizedEmail.endsWith("@legacy.immo-dreams83.local") &&
          candidate.normalizedEmail === lead.normalizedEmail) ||
          (!!lead.normalizedPhone &&
            candidate.normalizedPhone === lead.normalizedPhone)),
    ) ?? null
  );
}
export function contactsCsv(leads: AdminCrmLead[]) {
  const cell = (value: string) =>
    `"${(/^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  const rows = [
    [
      "Nom",
      "Email",
      "Téléphone",
      "Rôle",
      "Qualification",
      "Projet",
      "Secteur",
      "Budget EUR",
      "Archivé",
    ],
    ...leads.map((lead) => [
      lead.name,
      lead.email.endsWith("@legacy.immo-dreams83.local") ? "" : lead.email,
      lead.phone,
      lead.contactRole ?? "",
      lead.qualificationStatus ?? "",
      lead.category,
      lead.city,
      lead.estimatedBudget == null ? "" : String(lead.estimatedBudget),
      lead.archived ? "Oui" : "Non",
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
}

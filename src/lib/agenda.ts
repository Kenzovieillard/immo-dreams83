import { z } from "zod";

export const agendaTimeZone = "Europe/Paris";
export const agendaTypes = {
  CALL: "Appel",
  MEETING: "Rendez-vous",
  ESTIMATION: "Estimation",
  VISIT: "Visite",
  FOLLOW_UP: "Relance",
  SIGNATURE: "Signature",
  TASK: "Tâche interne",
} as const;
export const agendaStatuses = {
  planned: "Planifié",
  to_confirm: "À confirmer",
  confirmed: "Confirmé",
  completed: "Terminé",
  cancelled: "Annulé",
  missed: "Non honoré",
  todo: "À faire",
  in_progress: "En cours",
} as const;
export const agendaPriorities = {
  low: "Basse",
  normal: "Moyenne",
  high: "Haute",
  urgent: "Urgente",
} as const;
export const agendaTaskTypes = {
  ADMIN: "Administration",
  FOLLOW_UP: "Relance",
  CALL: "Appel",
  EMAIL: "E-mail",
  APPOINTMENT: "Rendez-vous",
} as const;
export const agendaChecklist = {
  ESTIMATION: [
    "Mandat prérempli",
    "Avis de valeur comparative",
    "Plans et diagnostics",
    "Grille d’honoraires",
  ],
  SIGNATURE: [
    "Identités",
    "Diagnostics",
    "Règlement de copropriété",
    "Plan de financement",
  ],
} as const;
export const agendaViews = ["day", "week", "month", "tasks"] as const;
export type AgendaView = (typeof agendaViews)[number];
export type AgendaType = keyof typeof agendaTypes;
export type AgendaStatus = keyof typeof agendaStatuses;
export type AgendaPriority = keyof typeof agendaPriorities;
export type AgendaTaskType = keyof typeof agendaTaskTypes;
export type AgendaSource = "appointment" | "estimation" | "task";

export const agendaDetailsSchema = z.object({
  phone: z.string().trim().max(40).optional(),
  meetingType: z
    .enum(["Découverte", "Suivi de dossier", "Rendez-vous agence", "Autre"])
    .optional(),
  channel: z.enum(["phone", "email", "sms"]).optional(),
  message: z.string().trim().max(3000).optional(),
  act: z
    .enum(["Compromis", "Promesse de vente", "Acte authentique", "Autre"])
    .optional(),
  notary: z.string().trim().max(160).optional(),
  sellerId: z.uuid().nullable().optional(),
  checklist: z.array(z.string().max(100)).max(8).optional(),
  nextDayFollowup: z.boolean().optional(),
  cancelReason: z.string().trim().max(400).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});
export type AgendaDetails = z.infer<typeof agendaDetailsSchema>;
const instant = z.iso.datetime({ offset: true });
const uuid = z.uuid();
const nullableId = uuid.nullable().optional();
export const agendaEntryInput = z
  .object({
    id: uuid.optional(),
    source: z.enum(["appointment", "estimation", "task"]),
    type: z.enum([
      "CALL",
      "MEETING",
      "ESTIMATION",
      "VISIT",
      "FOLLOW_UP",
      "SIGNATURE",
      "TASK",
    ]),
    title: z.string().trim().max(180).default(""),
    assigneeId: uuid,
    contactId: nullableId,
    propertyId: nullableId,
    appointmentId: nullableId,
    startsAt: instant.nullable().optional(),
    endsAt: instant.nullable().optional(),
    dueAt: instant.nullable().optional(),
    location: z.string().trim().max(300).default(""),
    notes: z.string().trim().max(5000).default(""),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    taskType: z
      .enum(["ADMIN", "FOLLOW_UP", "CALL", "EMAIL", "APPOINTMENT"])
      .default("ADMIN"),
    reminderMinutes: z
      .number()
      .int()
      .min(0)
      .max(10080)
      .nullable()
      .default(null),
    details: agendaDetailsSchema.default({}),
  })
  .superRefine((input, ctx) => {
    const add = (field: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [field], message });
    if (input.type === "TASK") {
      if (input.source !== "task") add("type", "Type de tâche invalide.");
      if (!input.title) add("title", "Renseignez le titre.");
      if (input.reminderMinutes !== null && !input.dueAt)
        add("dueAt", "Indiquez une échéance pour programmer le rappel.");
      return;
    }
    if (
      input.source === "task" ||
      (input.source === "estimation" && input.type !== "ESTIMATION")
    )
      add("type", "Type d’événement invalide.");
    if (input.type === "ESTIMATION" && !input.id)
      add("estimation", "Sélectionnez une estimation existante.");
    if (!input.title && !["VISIT", "ESTIMATION"].includes(input.type))
      add("title", "Renseignez l’intitulé.");
    if (
      ["CALL", "VISIT", "FOLLOW_UP", "SIGNATURE"].includes(input.type) &&
      !input.contactId
    )
      add("contactId", "Sélectionnez un contact.");
    if (["VISIT", "SIGNATURE"].includes(input.type) && !input.propertyId)
      add("propertyId", "Sélectionnez un bien.");
    if (input.type === "SIGNATURE" && !input.details.sellerId)
      add("sellerId", "Sélectionnez le vendeur.");
    if (input.type === "SIGNATURE" && !input.details.act)
      add("act", "Choisissez le type d’acte.");
    if (!input.startsAt)
      add("startsAt", "Renseignez la date et l’heure de début.");
    if (
      !input.endsAt ||
      !input.startsAt ||
      !(Date.parse(input.endsAt) > Date.parse(input.startsAt))
    ) {
      add("endsAt", "La fin doit être postérieure au début.");
    } else if (
      Date.parse(input.endsAt) - Date.parse(input.startsAt) >
      7 * 24 * 60 * 60 * 1000
    ) {
      add("endsAt", "La durée doit rester inférieure à sept jours.");
    }
    if (input.type === "FOLLOW_UP" && !input.details.channel)
      add("channel", "Choisissez un canal.");
  });
export type AgendaEntryInput = z.input<typeof agendaEntryInput>;
export const agendaMutationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("save"),
    requestId: uuid,
    expectedUpdatedAt: instant.optional(),
    entry: agendaEntryInput,
    acceptConflict: z.boolean().default(false),
  }),
  z.object({
    operation: z.enum(["complete", "reopen", "cancel", "delete", "reminder"]),
    requestId: uuid,
    expectedUpdatedAt: instant,
    id: uuid,
    source: z.enum(["appointment", "estimation", "task"]),
    reason: z.string().trim().max(400).optional(),
    confirm: z.boolean().optional(),
    reminderMinutes: z.number().int().min(0).max(10080).nullable().optional(),
  }),
]);
export type AgendaMutation = z.input<typeof agendaMutationSchema>;

type AgendaEstimationInfo = { propertyType: string; surface: number | null };
export type AgendaOption = {
  id: string;
  label: string;
  note?: string;
  phone?: string | null;
  email?: string | null;
  revision?: string;
  contactId?: string | null;
  assigneeId?: string | null;
  startsAt?: string | null;
  location?: string | null;
  duration?: number | null;
  estimation?: AgendaEstimationInfo;
};
export type AgendaEntry = {
  id: string;
  source: AgendaSource;
  type: AgendaType;
  title: string;
  status: AgendaStatus;
  assigneeId: string | null;
  assignee: string | null;
  contactId: string | null;
  contact: string | null;
  propertyId: string | null;
  appointmentId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  dueAt: string | null;
  location: string;
  notes: string;
  priority: AgendaPriority;
  taskType: AgendaTaskType;
  reminderMinutes: number | null;
  updatedAt: string;
  completedAt: string | null;
  details: AgendaDetails;
  estimation?: AgendaEstimationInfo;
};
export type AgendaReference = {
  contact:
    | (AgendaOption & {
        city: string | null;
        timeline: { id: string; label: string; date: string }[];
      })
    | null;
  seller: AgendaOption | null;
  property:
    | (AgendaOption & {
        price: number;
        surface: number;
        rooms: number | null;
        land: number | null;
        archived: boolean;
        photo: string | null;
      })
    | null;
  assignee:
    | (AgendaOption & {
        role: string;
        weekEvents: number;
        weekCompletedTasks: number;
      })
    | null;
};
export type AgendaData = {
  events: AgendaEntry[];
  tasks: AgendaEntry[];
  reminders: AgendaEntry[];
  monthCounts: Record<string, number>;
  assignees: AgendaOption[];
  viewer: {
    id: string;
    canWrite: boolean;
    canAssign: boolean;
    canDelete: boolean;
  };
};
export function agendaIsClosed(item: Pick<AgendaEntry, "status">) {
  return ["completed", "cancelled", "missed"].includes(item.status);
}

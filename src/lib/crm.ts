import type { LeadPriority, LeadStatus } from "@/types/crm";

export const leadStatuses = [
  "NEW",
  "CONTACTED",
  "APPOINTMENT",
  "MANDATE_SIGNED",
  "LOST",
] as const satisfies LeadStatus[];

export const leadStatusLabels: Record<LeadStatus, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  APPOINTMENT: "Rendez-vous",
  MANDATE_SIGNED: "Mandat signé",
  LOST: "Perdu",
};

export const leadStatusDescriptions: Record<LeadStatus, string> = {
  NEW: "Demande reçue, à qualifier rapidement.",
  CONTACTED: "Premier échange réalisé avec le prospect.",
  APPOINTMENT: "Rendez-vous agence, vendeur ou estimation planifié.",
  MANDATE_SIGNED: "Projet transformé en mandat ou accompagnement actif.",
  LOST: "Prospect non poursuivi ou projet abandonné.",
};

export const leadPriorities = ["low", "normal", "high", "urgent"] as const satisfies LeadPriority[];

export const leadPriorityLabels: Record<LeadPriority, string> = {
  low: "Faible",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

export const leadPriorityBadgeClasses: Record<LeadPriority, string> = {
  low: "border-0 bg-gray-100 text-gray-700",
  normal: "border-0 bg-orange-100 text-orange-800",
  high: "border-0 bg-yellow-100 text-yellow-800",
  urgent: "border-0 bg-red-100 text-red-800",
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && leadStatuses.includes(value as LeadStatus);
}

export function isLeadPriority(value: unknown): value is LeadPriority {
  return typeof value === "string" && leadPriorities.includes(value as LeadPriority);
}

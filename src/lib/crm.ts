import type { LeadStatus } from "@/types/crm";

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

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && leadStatuses.includes(value as LeadStatus);
}


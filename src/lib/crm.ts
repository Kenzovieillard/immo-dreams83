import type {
  CommercialOfferStatus,
  ContactQualificationStatus,
  ContactRole,
  LeadPriority,
  LeadStatus,
} from "@/types/crm";

export const assignableProfileRoles = ["ADMIN", "DIRECTOR", "AGENT"] as const;

export const commercialOfferStatuses = [
  "DRAFT",
  "TO_BE_SIGNED",
  "SIGNED_BY_BUYER",
  "SENT_TO_SELLER",
  "NEGOTIATING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
] as const satisfies CommercialOfferStatus[];

export const commercialOfferStatusLabels: Record<CommercialOfferStatus, string> = {
  DRAFT: "Brouillon",
  TO_BE_SIGNED: "À faire signer",
  SIGNED_BY_BUYER: "Signée par l'acquéreur",
  SENT_TO_SELLER: "Transmise au vendeur",
  NEGOTIATING: "En négociation",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  WITHDRAWN: "Retirée",
  EXPIRED: "Expirée",
};

export const activeCommercialOfferStatuses = [
  "DRAFT",
  "TO_BE_SIGNED",
  "SIGNED_BY_BUYER",
  "SENT_TO_SELLER",
  "NEGOTIATING",
  "ACCEPTED",
] as const satisfies CommercialOfferStatus[];

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

export const contactRoles = ["UNKNOWN", "BUYER", "SELLER", "BOTH", "OTHER"] as const satisfies ContactRole[];

export const contactRoleLabels: Record<ContactRole, string> = {
  UNKNOWN: "À déterminer",
  BUYER: "Acquéreur",
  SELLER: "Vendeur",
  BOTH: "Vendeur et acquéreur",
  OTHER: "Autre projet",
};

export const contactQualificationStatuses = [
  "TO_REVIEW",
  "QUALIFIED",
  "DUPLICATE",
  "NO_CONTACT",
  "INACTIVE",
] as const satisfies ContactQualificationStatus[];

export const contactQualificationStatusLabels: Record<ContactQualificationStatus, string> = {
  TO_REVIEW: "À qualifier",
  QUALIFIED: "Qualifié",
  DUPLICATE: "Doublon",
  NO_CONTACT: "Sans moyen de contact",
  INACTIVE: "Inactif",
};

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

export function isAssignableProfileRole(value: unknown) {
  return (
    typeof value === "string" &&
    assignableProfileRoles.includes(value as (typeof assignableProfileRoles)[number])
  );
}

export function isCommercialOfferStatus(value: unknown): value is CommercialOfferStatus {
  return (
    typeof value === "string" &&
    commercialOfferStatuses.includes(value as CommercialOfferStatus)
  );
}

export function normalizeCrmSearch(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

export function isContactRole(value: unknown): value is ContactRole {
  return typeof value === "string" && contactRoles.includes(value as ContactRole);
}

export function isContactQualificationStatus(value: unknown): value is ContactQualificationStatus {
  return (
    typeof value === "string" &&
    contactQualificationStatuses.includes(value as ContactQualificationStatus)
  );
}

export function deriveContactRole(requestType: string): ContactRole {
  const normalized = requestType.trim().toLocaleLowerCase("fr-FR");
  const isBuyer = /(acquéreur|acquereur|achat|recherche|locataire)/.test(normalized);
  const isSeller = /(vendeur|vente|estimation|bailleur)/.test(normalized);

  if (isBuyer && isSeller) return "BOTH";
  if (isBuyer) return "BUYER";
  if (isSeller) return "SELLER";
  if (normalized && normalized !== "contact lesty") return "OTHER";
  return "UNKNOWN";
}

export function hasUsableContactMethod(email: string | null | undefined, phone: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  const normalizedPhone = phone?.replace(/\D/g, "") ?? "";
  const hasRealEmail = Boolean(normalizedEmail && !normalizedEmail.endsWith("@legacy.immo-dreams83.local"));

  return hasRealEmail || Boolean(normalizedPhone);
}

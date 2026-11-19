import { isAssignableProfileRole, normalizeCrmSearch } from "@/lib/crm";
import type { CommercialOfferStatus, LeadStatus } from "@/types/crm";

type AssignableProfileLike = {
  id: string;
  role: string;
  isActive?: boolean;
  is_active?: boolean;
};

type SearchableDossier = {
  dossierReference?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  requestType?: string | null;
  projectType?: string | null;
  propertyType?: string | null;
  city?: string | null;
  postalCode?: string | null;
  linkedPropertyTitle?: string | null;
  assignedToName?: string | null;
  status?: string | null;
};

type ReminderCandidate = {
  leadId: string | null;
  assignedTo: string | null;
  title: string;
  dueAt: string | null;
  completedAt?: string | null;
  status?: string | null;
};

type PropertyOfferCandidate = {
  status?: string | null;
  commercialStatus?: string | null;
  publicationStatus?: string | null;
  archivedAt?: string | null;
};

export type PipelineColumnId = "new" | "contacted" | "appointment" | "offers";

export const commercialOfferTransitions: Record<CommercialOfferStatus, readonly CommercialOfferStatus[]> = {
  DRAFT: ["TO_BE_SIGNED", "WITHDRAWN"],
  TO_BE_SIGNED: ["SIGNED_BY_BUYER", "WITHDRAWN"],
  SIGNED_BY_BUYER: ["SENT_TO_SELLER", "WITHDRAWN"],
  SENT_TO_SELLER: ["NEGOTIATING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"],
  NEGOTIATING: ["ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: ["DRAFT"],
};

export function isAssignableActiveProfile(profile: AssignableProfileLike) {
  const isActive = profile.isActive ?? profile.is_active ?? false;
  return Boolean(profile.id && isActive && isAssignableProfileRole(profile.role));
}

export function filterAssignableProfiles<T extends AssignableProfileLike>(profiles: T[]) {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (!isAssignableActiveProfile(profile) || seen.has(profile.id)) return false;
    seen.add(profile.id);
    return true;
  });
}

export function uniquePipelineRecordsById<T extends { id: string }>(records: T[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (!record.id || seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

export function buildPipelineDossierSearchText(dossier: SearchableDossier) {
  return normalizeCrmSearch(
    [
      dossier.dossierReference,
      dossier.contactName,
      dossier.contactEmail,
      dossier.contactPhone,
      dossier.requestType,
      dossier.projectType,
      dossier.propertyType,
      dossier.city,
      dossier.postalCode,
      dossier.linkedPropertyTitle,
      dossier.assignedToName,
      dossier.status,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function matchesPipelineDossierSearch(dossier: SearchableDossier, query: string) {
  return buildPipelineDossierSearchText(dossier).includes(normalizeCrmSearch(query));
}

export function isPotentialDuplicateReminder(
  candidate: ReminderCandidate,
  requested: ReminderCandidate,
  windowMinutes = 30
) {
  if (
    !candidate.leadId ||
    candidate.leadId !== requested.leadId ||
    candidate.assignedTo !== requested.assignedTo ||
    candidate.completedAt ||
    candidate.status === "COMPLETED" ||
    candidate.status === "CANCELLED" ||
    normalizeCrmSearch(candidate.title) !== normalizeCrmSearch(requested.title) ||
    !candidate.dueAt ||
    !requested.dueAt
  ) {
    return false;
  }

  const candidateTimestamp = new Date(candidate.dueAt).getTime();
  const requestedTimestamp = new Date(requested.dueAt).getTime();
  if (!Number.isFinite(candidateTimestamp) || !Number.isFinite(requestedTimestamp)) return false;

  return Math.abs(candidateTimestamp - requestedTimestamp) <= windowMinutes * 60_000;
}

export function getPropertyOfferIneligibility(candidate: PropertyOfferCandidate | null) {
  if (!candidate) return "MISSING" as const;
  if (candidate.archivedAt) return "ARCHIVED" as const;

  const commercialStatus = String(candidate.commercialStatus ?? candidate.status ?? "").toUpperCase();
  const publicationStatus = String(candidate.publicationStatus ?? "").toUpperCase();
  if (["SOLD", "ARCHIVED", "WITHDRAWN", "RETIRED", "OFF_MARKET"].includes(commercialStatus)) {
    return "NOT_FOR_SALE" as const;
  }
  if (publicationStatus === "ARCHIVED") return "ARCHIVED" as const;

  return null;
}

export function canTransitionCommercialOfferStatus(
  currentStatus: CommercialOfferStatus,
  nextStatus: CommercialOfferStatus
) {
  return commercialOfferTransitions[currentStatus].includes(nextStatus);
}

export function isCommercialOfferExpired(validUntil: string, today = new Date()) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : "";
  if (!normalized) return true;
  return normalized < today.toISOString().slice(0, 10);
}

export function getPipelineColumnId(lead: {
  status: LeadStatus;
  hasActiveAppointment: boolean;
  hasActiveOffer: boolean;
}): PipelineColumnId | null {
  if (lead.hasActiveOffer) return "offers";
  if (lead.hasActiveAppointment || lead.status === "APPOINTMENT") return "appointment";
  if (lead.status === "CONTACTED") return "contacted";
  if (lead.status === "NEW") return "new";
  return null;
}

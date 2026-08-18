export type CommercialPipelineKind = "BUYER" | "SELLER";

export type CommercialPipelineStage =
  | "BUYER_NEW"
  | "BUYER_QUALIFIED"
  | "BUYER_VISIT"
  | "BUYER_OFFER"
  | "BUYER_COMPROMISE"
  | "BUYER_FINALIZED"
  | "SELLER_NEW"
  | "SELLER_CONTACT"
  | "SELLER_ESTIMATE_SCHEDULED"
  | "SELLER_ESTIMATE_DONE"
  | "SELLER_MANDATE_PROPOSED"
  | "SELLER_MANDATE_SIGNED"
  | "SELLER_MARKETED";

export type CommercialProfileOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type CommercialContactOption = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  role: string;
};

export type CommercialPropertyOption = {
  id: string;
  reference: string;
  title: string;
  city: string;
  price: number;
  status: string;
  slug: string;
};

export type CommercialTask = {
  id: string;
  leadId: string | null;
  appointmentId: string | null;
  offerId: string | null;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  completedAt: string | null;
};

export type CommercialHistoryEntry = {
  id: string;
  action: string;
  actorName: string;
  createdAt: string;
};

export type CommercialPipelineCard = {
  id: string;
  dossierReference: string;
  pipelineType: CommercialPipelineKind;
  stage: CommercialPipelineStage;
  status: string;
  priority: string;
  isBlocked: boolean;
  blockingReason: string | null;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  propertyId: string | null;
  propertyTitle: string | null;
  propertySlug: string | null;
  estimationId: string | null;
  estimationLabel: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  amount: number | null;
  nextAction: CommercialTask | null;
  tasks: CommercialTask[];
  visitIds: string[];
  offerIds: string[];
  negotiationIds: string[];
  history: CommercialHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
};

export type CommercialPipelineStats = {
  total: number;
  blocked: number;
  estimatedValue: number;
  byStage: Array<{
    pipelineType: string;
    stage: string;
    count: number;
    estimatedValue: number;
    blocked: number;
  }>;
};

export type CommercialTeamSummary = {
  profileId: string | null;
  name: string;
  dossierCount: number;
  blockedCount: number;
  estimatedValue: number;
};

export type CommercialPipelinePayload = {
  cards: CommercialPipelineCard[];
  stats: CommercialPipelineStats;
  team: CommercialTeamSummary[];
  options: {
    profiles: CommercialProfileOption[];
    contacts: CommercialContactOption[];
    properties: CommercialPropertyOption[];
    estimations: Array<{ id: string; label: string; contactId: string | null }>;
    sellerCases: Array<{ id: string; label: string; propertyId: string | null }>;
  };
  permissions: {
    canWrite: boolean;
    canAssign: boolean;
    canViewTeam: boolean;
  };
  generatedAt: string;
};

export type CommercialEstimationSummary = {
  id: string;
  reference: string | null;
  contactId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  postalCode: string | null;
  propertyType: string;
  surface: number;
  rooms: number | null;
  appointmentAt: string | null;
  timeSlot: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  status: string;
  estimatedValue: number | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  reportAvailable: boolean;
  convertedPropertyId: string | null;
  convertedPropertySlug: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommercialEstimationDetail = CommercialEstimationSummary & {
  constructionYear: number | null;
  propertyCondition: string | null;
  appointmentLocation: string | null;
  durationMinutes: number;
  notes: string | null;
  marketComparables: Array<{
    label: string;
    surface?: number;
    price?: number;
    soldAt?: string;
  }>;
  listingPrice: number | null;
  mandateType: string | null;
  history: CommercialHistoryEntry[];
};

export type CommercialEstimationPayload = {
  items: CommercialEstimationSummary[];
  detail: CommercialEstimationDetail | null;
  stats: {
    newRequests: number;
    toSchedule: number;
    scheduledThisWeek: number;
    completedThisMonth: number;
    mandatesThisMonth: number;
  };
  options: {
    contacts: CommercialContactOption[];
    profiles: CommercialProfileOption[];
  };
  meta: { count: number; page: number; limit: number };
  generatedAt: string;
};

export type CommercialVisitSummary = {
  id: string;
  leadId: string | null;
  propertyId: string | null;
  propertyTitle: string | null;
  propertyReference: string | null;
  propertySlug: string | null;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  visitStatus: string;
  reportSubmittedAt: string | null;
  reportNextAction: string | null;
  nextAction: string | null;
  offerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommercialVisitDetail = CommercialVisitSummary & {
  comment: string | null;
  generalImpression: string | null;
  positivePoints: string[];
  blockingPoints: string[];
  interestLevel: number | null;
  additionalComments: string | null;
  tasks: CommercialTask[];
  history: CommercialHistoryEntry[];
};

export type CommercialVisitPayload = {
  items: CommercialVisitSummary[];
  detail: CommercialVisitDetail | null;
  stats: {
    total: number;
    confirmed: number;
    toConfirm: number;
    reportsMissing: number;
  };
  options: {
    contacts: CommercialContactOption[];
    properties: CommercialPropertyOption[];
    profiles: CommercialProfileOption[];
    buyerCases: Array<{ id: string; label: string; contactId: string | null }>;
  };
  meta: { count: number; page: number; limit: number };
  generatedAt: string;
};

export type CommercialOfferDocument = {
  id: string;
  fileName: string;
  documentType: string;
  mimeType: string | null;
  createdAt: string;
};

export type CommercialOfferSummary = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyReference: string;
  propertySlug: string;
  propertyCity: string;
  propertyPrice: number;
  propertyPhotos: string[];
  buyerDossierId: string;
  buyerContactId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  visitId: string | null;
  responsibleUserId: string;
  responsibleUserName: string;
  amount: number;
  status: string;
  offerDate: string | null;
  validUntil: string | null;
  financingType: string;
  negotiationId: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CommercialOfferDetail = CommercialOfferSummary & {
  downPaymentAmount: number | null;
  loanAmount: number | null;
  suspensiveConditions: string | null;
  includedFurniture: string | null;
  negotiationComment: string | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  documents: CommercialOfferDocument[];
  history: Array<{
    id: string;
    previousStatus: string | null;
    nextStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
};

export type CommercialOfferPayload = {
  items: CommercialOfferSummary[];
  detail: CommercialOfferDetail | null;
  stats: {
    total: number;
    draft: number;
    active: number;
    negotiating: number;
    accepted: number;
  };
  options: {
    contacts: CommercialContactOption[];
    properties: CommercialPropertyOption[];
    profiles: CommercialProfileOption[];
    buyerCases: Array<{
      id: string;
      label: string;
      contactId: string | null;
      propertyId: string | null;
    }>;
  };
  prefill: {
    propertyId: string | null;
    contactId: string | null;
    visitId: string | null;
    buyerDossierId: string | null;
  };
  meta: { count: number; page: number; limit: number };
  generatedAt: string;
};

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "APPOINTMENT"
  | "MANDATE_SIGNED"
  | "LOST";

export type LeadPriority = "low" | "normal" | "high" | "urgent";

export type ContactRole = "UNKNOWN" | "BUYER" | "SELLER" | "BOTH" | "OTHER";

export type ContactQualificationStatus =
  | "TO_REVIEW"
  | "QUALIFIED"
  | "DUPLICATE"
  | "NO_CONTACT"
  | "INACTIVE";

export type ContactQualificationSource = "AUTO" | "MANUAL";

export type ContactDedupeStatus =
  | "UNREVIEWED"
  | "MATCH_CERTAIN"
  | "MATCH_PROBABLE"
  | "AMBIGUOUS"
  | "MERGED"
  | "IGNORED";

export type TaskRecurrenceRule = "NONE" | "WEEKLY" | "MONTHLY";

export type TaskReminderChannel = "NONE" | "EMAIL";

export type TaskEmailReminderStatus =
  | "NOT_SCHEDULED"
  | "PENDING"
  | "SENT"
  | "FAILED";

export type CrmOnboardingStepKey =
  | "profile"
  | "contacts"
  | "pipeline"
  | "appointment";

export type CrmOnboardingProgress = {
  profileCompleted: boolean;
  contactsCompleted: boolean;
  pipelineCompleted: boolean;
  appointmentCompleted: boolean;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type PipelineTaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type CommercialOfferStatus =
  | "DRAFT"
  | "TO_BE_SIGNED"
  | "SIGNED_BY_BUYER"
  | "SENT_TO_SELLER"
  | "NEGOTIATING"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "EXPIRED";

export type OfferFinancingType = "CASH" | "LOAN" | "MIXED" | "UNKNOWN";

export type NegotiationStatus =
  | "IN_PROGRESS"
  | "WAITING_SELLER"
  | "WAITING_BUYER"
  | "COUNTER_OFFER"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CONCLUDED";

export type NegotiationParty = {
  id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
};

export type NegotiationProperty = {
  id: string;
  slug?: string | null;
  reference: string | null;
  title: string;
  city: string;
  postalCode: string | null;
  imageUrl: string | null;
};

export type NegotiationStep = {
  id: string;
  stepNumber: number;
  label: string;
  amount: number | null;
  authorRole: "BUYER" | "SELLER" | null;
  status: "SENT" | "REVIEW" | "ACCEPTED" | "REJECTED" | "PENDING";
  isCurrent: boolean;
  comment: string | null;
  createdAt: string;
};

export type NegotiationExchange = {
  id: string;
  type: string;
  amount: number | null;
  authorName: string | null;
  comment: string | null;
  isInternalNote: boolean;
  createdAt: string;
};

export type NegotiationDocument = {
  id: string;
  fileName: string;
  documentType: string | null;
  mimeType: string | null;
  createdAt: string;
};

export type CommercialNegotiation = {
  id: string;
  offerId: string;
  property: NegotiationProperty;
  buyer: NegotiationParty;
  seller: NegotiationParty | null;
  responsible: NegotiationParty;
  status: NegotiationStatus;
  initialAmount: number;
  currentAmount: number;
  askingPrice: number;
  currentGapPercent: number;
  currentStep: number;
  totalSteps: number;
  responseDeadline: string | null;
  isUrgent: boolean;
  daysWithoutActivity: number;
  lastActivityAt: string;
  finalAmount: number | null;
  concludedAt: string | null;
  internalNotes: string | null;
  financingType: OfferFinancingType;
  downPaymentAmount: number | null;
  loanAmount: number | null;
  suspensiveConditions: string | null;
  includedFurniture: string | null;
  steps: NegotiationStep[];
  exchanges: NegotiationExchange[];
  documents: NegotiationDocument[];
  createdAt: string;
  updatedAt: string;
};

export type NegotiationKpis = {
  active: number;
  awaitingResponse: number;
  actionRequired: number;
  acceptedThisMonth: number;
  averageGap: number | null;
  totalVolume: number;
};

export type ContactLead = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  request_type: string;
  city: string | null;
  message: string;
  status: LeadStatus;
  notes: string | null;
  archived: boolean;
  contact_role: ContactRole;
  qualification_status: ContactQualificationStatus;
  qualification_source: ContactQualificationSource;
  active_prospect: boolean;
  qualified_at: string | null;
  pipeline_lead_id: string | null;
  assigned_to?: string | null;
  address?: string | null;
  postal_code?: string | null;
  contact_preference?: string | null;
  personal_situation?: string | null;
  profession?: string | null;
  current_residence?: string | null;
  interest_score?: number | null;
  estimated_budget?: number | null;
  priority?: LeadPriority;
  contact_source?: string;
  last_contacted_at?: string | null;
  normalized_email?: string | null;
  normalized_phone?: string | null;
  canonical_contact_id?: string | null;
  dedupe_status?: ContactDedupeStatus;
};

export type AdminCrmLead = {
  id: string;
  kind: "contacts" | "estimations";
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  city: string;
  message: string;
  status: LeadStatus;
  notes: string;
  archived: boolean;
  contactRole: ContactRole | null;
  qualificationStatus: ContactQualificationStatus | null;
  qualificationSource: ContactQualificationSource | null;
  activeProspect: boolean;
  qualifiedAt: string | null;
  pipelineLeadId: string | null;
  assignedTo: string | null;
  address: string;
  postalCode: string;
  contactPreference: string;
  personalSituation: string;
  profession: string;
  currentResidence: string;
  interestScore: number | null;
  estimatedBudget: number | null;
  priority: LeadPriority;
  contactSource: string;
  lastContactedAt: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  canonicalContactId: string | null;
  dedupeStatus: ContactDedupeStatus;
};

export type EstimationLead = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  property_type: string;
  city: string;
  postal_code: string | null;
  surface: number;
  rooms: number | null;
  message: string | null;
  status: LeadStatus;
  notes: string | null;
  archived: boolean;
};

export type Activity = {
  id: string;
  created_at: string;
  entity_type: string;
  entity_id: string;
  action: string;
  user_name: string;
};

export type AdminTeamMember = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
};

export type PipelineLead = {
  id: string;
  dossierReference: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  requestType: string;
  projectType: string;
  propertyType: string | null;
  city: string | null;
  postalCode: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  desiredSurface: number | null;
  desiredRooms: number | null;
  source: string;
  sourceCode: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  assignedTo: string | null;
  assignedToName: string | null;
  contactId: string | null;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedPropertyId: string | null;
  linkedPropertyTitle: string | null;
  hasActiveAppointment: boolean;
  hasActiveOffer: boolean;
  hasActiveMandate: boolean;
  offerCount: number;
  latestOfferId: string | null;
  latestOfferStatus: CommercialOfferStatus | null;
  notes: string | null;
  archived: boolean;
};

export type PipelineMetrics = {
  visits: number;
  offers: number;
  mandates: number;
  sources: {
    visits: "real" | "missing";
    offers: "real" | "missing";
    mandates: "real" | "missing";
  };
};

export type PipelineTask = {
  id: string;
  leadId: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string | null;
  title: string;
  description: string | null;
  dueAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  priority: LeadPriority;
  status?: PipelineTaskStatus;
  taskType: string;
  contactId?: string | null;
  propertyId?: string | null;
  offerId?: string | null;
  appointmentId?: string | null;
  recurrenceRule: TaskRecurrenceRule;
  reminderChannel: TaskReminderChannel;
  emailReminderEnabled: boolean;
  emailReminderStatus: TaskEmailReminderStatus;
  emailReminderScheduledAt: string | null;
  emailReminderSentAt: string | null;
  emailReminderLastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommercialOffer = {
  id: string;
  leadId: string;
  buyerDossierId: string;
  buyerContactId: string;
  buyerContactName: string;
  propertyId: string;
  propertyReference: string | null;
  propertyTitle: string;
  propertyCommercialStatus: string | null;
  responsibleUserId: string;
  responsibleUserName: string;
  amount: number;
  status: CommercialOfferStatus;
  offerDate: string;
  validUntil: string;
  nextAction: string;
  nextActionDueAt: string;
  financingType: OfferFinancingType;
  downPaymentAmount: number | null;
  loanAmount: number | null;
  suspensiveConditions: string | null;
  includedFurniture: string | null;
  negotiationComment: string | null;
  signedDocumentId: string | null;
  submittedToSellerAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  withdrawnAt: string | null;
  rejectionReason: string | null;
  withdrawalReason: string | null;
  createdFromVisitId: string | null;
  isTest: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PipelinePermissions = {
  canAssignDossiers: boolean;
  canCreateOffers: boolean;
  canDecideOffers: boolean;
};

export type CrmOverviewMetricSource = "real" | "derived" | "missing";

export type CrmOverviewSnapshot = {
  generatedAt: string;
  metrics: {
    totalLeads: number;
    newLeads: number;
    visits: number;
    offers: number;
    availableProperties: number;
    propertiesWithoutPhotos: number;
    contactsToQualify: number;
    openTasks: number;
    todayTasks: number;
  };
  sources: {
    leads: CrmOverviewMetricSource;
    visits: CrmOverviewMetricSource;
    offers: CrmOverviewMetricSource;
    properties: CrmOverviewMetricSource;
  };
};

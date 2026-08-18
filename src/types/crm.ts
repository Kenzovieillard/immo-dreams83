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

export type TaskRecurrenceRule = "NONE" | "WEEKLY" | "MONTHLY";

export type TaskReminderChannel = "NONE" | "EMAIL";

export type TaskEmailReminderStatus =
  | "NOT_SCHEDULED"
  | "PENDING"
  | "SENT"
  | "FAILED";

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
};

export type PipelineLead = {
  id: string;
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
  taskType: string;
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

export type LeadStatus = "NEW" | "CONTACTED" | "APPOINTMENT" | "MANDATE_SIGNED" | "LOST";

export type LeadPriority = "low" | "normal" | "high" | "urgent";

export type TaskRecurrenceRule = "NONE" | "WEEKLY" | "MONTHLY";

export type TaskReminderChannel = "NONE" | "EMAIL";

export type TaskEmailReminderStatus = "NOT_SCHEDULED" | "PENDING" | "SENT" | "FAILED";

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
  notes: string | null;
  archived: boolean;
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

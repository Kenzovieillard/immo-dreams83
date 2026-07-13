export type LeadStatus = "NEW" | "CONTACTED" | "APPOINTMENT" | "MANDATE_SIGNED" | "LOST";

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

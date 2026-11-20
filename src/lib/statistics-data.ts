import type { Tables } from "@/types/supabase";

export type StatisticsData = {
  contacts: Pick<Tables<"contacts">, "id" | "created_at" | "assigned_to" | "archived" | "canonical_contact_id" | "city" | "contact_source" | "qualification_status" | "qualified_at" | "last_contacted_at" | "status">[];
  estimates: Pick<Tables<"estimations">, "id" | "created_at" | "assigned_to" | "archived" | "city" | "commercial_status" | "status" | "contact_id" | "requested_at" | "appointment_at" | "updated_at" | "estimated_value" | "estimate_low" | "estimate_high" | "report_generated_at" | "property_type" | "surface" | "converted_property_id">[];
  properties: Pick<Tables<"properties">, "id" | "title" | "reference" | "created_at" | "advisor_id" | "city" | "commercial_status" | "status" | "publication_status" | "published_at" | "unpublished_at" | "archived_at" | "transaction_type" | "price" | "type">[];
  leads: Pick<Tables<"leads">, "id" | "contact_id" | "estimation_id" | "linked_property_id" | "created_at" | "assigned_to" | "city" | "archived" | "is_blocked" | "stage_entered_at" | "pipeline_type" | "pipeline_stage" | "status" | "project_type">[];
  visits: Pick<Tables<"appointments">, "id" | "assigned_to" | "contact_id" | "property_id" | "lead_id" | "starts_at" | "visit_status" | "title">[];
  offers: Pick<Tables<"offers">, "id" | "responsible_user_id" | "created_from_visit_id" | "property_id" | "buyer_contact_id" | "created_at" | "offered_at" | "accepted_at" | "status">[];
  mandates: Pick<Tables<"mandates">, "id" | "lead_id" | "property_id" | "signed_at" | "expires_at" | "status" | "mandate_type">[];
  tasks: Pick<Tables<"tasks">, "id" | "assigned_to" | "contact_id" | "property_id" | "due_at" | "completed_at" | "status">[];
  interactions: Pick<Tables<"communications">, "contact_id" | "created_at">[];
  searches: Pick<Tables<"buyer_searches">, "id" | "contact_id" | "assigned_to" | "cities" | "created_at" | "status">[];
  sales: Pick<Tables<"crm_sales">, "property_id" | "advisor_id" | "signed_on" | "sale_price" | "fee_excl_tax">[] | null;
  profiles: Pick<Tables<"profiles">, "id" | "full_name" | "role" | "is_active">[];
};

export const sellerRoles = ["ADMIN", "DIRECTOR", "AGENT"] as const;
export const canSeeSales = (role: string) => sellerRoles.some((value) => value === role);
export const canRecordSales = (role: string) => role === "ADMIN" || role === "DIRECTOR";

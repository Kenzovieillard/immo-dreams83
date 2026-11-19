import type { Tables } from "./supabase";
export type ContactWorkspace = {
  tasks: Pick<
    Tables<"tasks">,
    "id" | "title" | "due_at" | "status" | "completed_at" | "assigned_to"
  >[];
  activities: Pick<
    Tables<"activities">,
    "id" | "action" | "created_at" | "user_name" | "metadata"
  >[];
  visits: Pick<
    Tables<"appointments">,
    | "id"
    | "title"
    | "starts_at"
    | "visit_status"
    | "property_id"
    | "interest_level"
    | "assigned_to"
  >[];
  properties: Pick<
    Tables<"properties">,
    "id" | "title" | "city" | "price" | "reference" | "status"
  >[];
  projects: Pick<
    Tables<"leads">,
    | "id"
    | "title"
    | "project_type"
    | "budget_min"
    | "budget_max"
    | "financing_approved"
    | "city"
    | "notes"
  >[];
  documents: {
    id: string;
    fileName: string;
    kind: "offer" | "negotiation";
    parentId: string;
    createdAt: string;
  }[];
};

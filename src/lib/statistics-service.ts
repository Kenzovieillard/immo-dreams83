import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { AdminSession } from "@/types/admin";
import { canSeeSales, type StatisticsData } from "./statistics-data";

type Page<T> = PromiseLike<{ data: T[] | null; error: { code: string; message: string } | null }>;
const pageSize = 500;

async function readAll<T>(label: string, read: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await read(from, from + pageSize - 1);
    if (page.error) throw new Error(`${label} (${page.error.code})`);
    const batch = page.data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}

export async function loadStatisticsData(db: NonNullable<ReturnType<typeof getSupabaseAdminClient>>, session: AdminSession): Promise<StatisticsData> {
  const owner = session.profile.role === "AGENT" ? session.user.id : null;
  const profiles = db.from("profiles").select("id,full_name,role,is_active").in("role", ["ADMIN", "DIRECTOR", "AGENT"]);
  const contacts = db.from("contacts").select("id,created_at,assigned_to,archived,canonical_contact_id,city,contact_source,qualification_status,qualified_at,last_contacted_at,status").is("canonical_contact_id", null);
  const estimates = db.from("estimations").select("id,created_at,assigned_to,archived,city,commercial_status,status,contact_id,requested_at,appointment_at,updated_at,estimated_value,estimate_low,estimate_high,report_generated_at,property_type,surface,converted_property_id");
  const properties = db.from("properties").select("id,title,reference,created_at,advisor_id,city,commercial_status,status,publication_status,published_at,unpublished_at,archived_at,transaction_type,price,type").eq("transaction_type", "sale");
  const leads = db.from("leads").select("id,contact_id,estimation_id,linked_property_id,created_at,assigned_to,city,archived,is_blocked,stage_entered_at,pipeline_type,pipeline_stage,status,project_type");
  const visits = db.from("appointments").select("id,assigned_to,contact_id,property_id,lead_id,starts_at,visit_status,title").eq("appointment_type", "VISIT");
  const offers = db.from("offers").select("id,responsible_user_id,created_from_visit_id,property_id,buyer_contact_id,created_at,offered_at,accepted_at,status").eq("is_test", false).neq("status", "DRAFT");
  const mandates = db.from("mandates").select("id,lead_id,property_id,signed_at,expires_at,status,mandate_type");
  const tasks = db.from("tasks").select("id,assigned_to,contact_id,property_id,due_at,completed_at,status");
  const communications = db.from("communications").select("id,contact_id,created_at").in("direction", ["outbound", "OUTBOUND"]).not("contact_id", "is", null);
  const activities = db.from("activities").select("id,entity_id,created_at").eq("entity_type", "contact").in("metadata->>kind", ["CALL", "EMAIL", "MEETING"]);
  const searches = db.from("buyer_searches").select("id,contact_id,assigned_to,cities,created_at,status");
  const sales = db.from("crm_sales").select("property_id,advisor_id,signed_on,sale_price,fee_excl_tax");

  const [people, contactRows, estimationRows, propertyRows, leadRows, visitRows, offerRows, mandateRows, taskRows, communicationRows, activityRows, searchRows, saleRows] = await Promise.all([
    readAll("Conseillers", (from, to) => (owner ? profiles.eq("id", owner) : profiles).order("id").range(from, to)),
    readAll("Contacts", (from, to) => (owner ? contacts.eq("assigned_to", owner) : contacts).order("id").range(from, to)),
    readAll("Estimations", (from, to) => (owner ? estimates.eq("assigned_to", owner) : estimates).order("id").range(from, to)),
    readAll("Biens", (from, to) => (owner ? properties.eq("advisor_id", owner) : properties).order("id").range(from, to)),
    readAll("Dossiers", (from, to) => (owner ? leads.eq("assigned_to", owner) : leads).order("id").range(from, to)),
    readAll("Visites", (from, to) => (owner ? visits.eq("assigned_to", owner) : visits).order("id").range(from, to)),
    canSeeSales(session.profile.role)
      ? readAll("Offres", (from, to) => (owner ? offers.eq("responsible_user_id", owner) : offers).order("id").range(from, to))
      : Promise.resolve([]),
    readAll("Mandats", (from, to) => mandates.order("id").range(from, to)),
    readAll("Tâches", (from, to) => (owner ? tasks.eq("assigned_to", owner) : tasks).order("id").range(from, to)),
    readAll("Communications", (from, to) => communications.order("id").range(from, to)),
    readAll("Interactions contacts", (from, to) => activities.order("id").range(from, to)),
    readAll("Recherches", (from, to) => (owner ? searches.eq("assigned_to", owner) : searches).order("id").range(from, to)),
    canSeeSales(session.profile.role)
      ? readAll("Ventes actées", (from, to) => (owner ? sales.eq("advisor_id", owner) : sales).order("property_id").range(from, to))
      : Promise.resolve(null),
  ]);
  const contactIds = new Set(contactRows.map(({ id }) => id));
  const leadIds = new Set(leadRows.map(({ id }) => id));
  const propertyIds = new Set(propertyRows.map(({ id }) => id));
  return {
    profiles: people,
    contacts: contactRows,
    estimates: estimationRows,
    properties: propertyRows,
    leads: leadRows,
    visits: visitRows,
    offers: offerRows,
    mandates: mandateRows.filter(({ lead_id, property_id }) => lead_id ? leadIds.has(lead_id) : property_id ? propertyIds.has(property_id) : !owner),
    tasks: taskRows,
    interactions: [
      ...communicationRows.filter(({ contact_id }) => contact_id !== null && contactIds.has(contact_id)),
      ...activityRows.filter(({ entity_id }) => contactIds.has(entity_id)).map(({ entity_id, created_at }) => ({ contact_id: entity_id, created_at })),
    ],
    searches: searchRows,
    sales: saleRows,
  };
}

import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { isLeadStatus } from "@/lib/crm";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { CrmOverviewSnapshot, LeadStatus } from "@/types/crm";

type ContactRow = {
  id: string;
  status: string | null;
  archived: boolean | null;
  qualification_status: string | null;
};

type EstimationRow = {
  id: string;
  status: string | null;
  archived: boolean | null;
};

type LeadRow = {
  id: string;
  status: string | null;
  archived: boolean | null;
};

type TaskRow = {
  id: string;
  due_at: string | null;
  completed_at: string | null;
  task_type: string | null;
};

type PropertyRow = {
  id: string;
  status: string | null;
  commercial_status: string | null;
  photos: unknown;
};

function safeStatus(value: unknown): LeadStatus {
  return isLeadStatus(value) ? value : "NEW";
}

function isSameDay(value: string | null, now: Date) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function hasNoPhotos(value: unknown) {
  return !Array.isArray(value) || value.length === 0;
}

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const [contactsResult, estimationsResult, leadsResult, tasksResult, propertiesResult] = await Promise.all([
    supabase.from("contacts").select("id,status,archived,qualification_status").limit(1000),
    supabase.from("estimations").select("id,status,archived").limit(1000),
    supabase.from("leads").select("id,status,archived").limit(1000),
    supabase.from("tasks").select("id,due_at,completed_at,task_type").limit(1000),
    supabase.from("properties").select("id,status,commercial_status,photos").limit(1000),
  ]);

  const error =
    contactsResult.error ??
    estimationsResult.error ??
    leadsResult.error ??
    tasksResult.error ??
    propertiesResult.error;

  if (error) {
    console.error("[IMMO-DREAMS83] Overview load failed", error.message);
    return NextResponse.json({ success: false, message: "La vue d'ensemble CRM n'a pas pu etre chargee." }, { status: 500 });
  }

  const now = new Date();
  const contacts = (contactsResult.data ?? []) as ContactRow[];
  const estimations = (estimationsResult.data ?? []) as EstimationRow[];
  const leads = (leadsResult.data ?? []) as LeadRow[];
  const tasks = (tasksResult.data ?? []) as TaskRow[];
  const properties = (propertiesResult.data ?? []) as PropertyRow[];

  const activeContacts = contacts.filter((contact) => !contact.archived);
  const activeEstimations = estimations.filter((estimation) => !estimation.archived);
  const activeLeads = leads.filter((lead) => !lead.archived);
  const legacyDemandes = [...activeContacts, ...activeEstimations];
  const openTasks = tasks.filter((task) => !task.completed_at);
  const visitTasks = openTasks.filter((task) => task.task_type === "APPOINTMENT" && isSameDay(task.due_at, now));
  const appointmentLeads = activeLeads.filter((lead) => safeStatus(lead.status) === "APPOINTMENT");
  const availableProperties = properties.filter((property) => property.status === "available");
  const offerProperties = properties.filter(
    (property) => property.status === "under_offer" || property.commercial_status === "UNDER_OFFER"
  );

  const snapshot: CrmOverviewSnapshot = {
    generatedAt: now.toISOString(),
    metrics: {
      totalLeads: activeLeads.length || legacyDemandes.length,
      newLeads: activeLeads.filter((lead) => safeStatus(lead.status) === "NEW").length ||
        legacyDemandes.filter((lead) => safeStatus(lead.status) === "NEW").length,
      visits: Math.max(visitTasks.length, appointmentLeads.length),
      offers: offerProperties.length,
      availableProperties: availableProperties.length,
      propertiesWithoutPhotos: properties.filter((property) => hasNoPhotos(property.photos)).length,
      contactsToQualify: activeContacts.filter((contact) => contact.qualification_status === "TO_REVIEW").length,
      openTasks: openTasks.length,
      todayTasks: openTasks.filter((task) => isSameDay(task.due_at, now)).length,
    },
    sources: {
      leads: activeLeads.length ? "real" : "derived",
      visits: visitTasks.length ? "real" : appointmentLeads.length ? "derived" : "missing",
      offers: offerProperties.length ? "derived" : "missing",
      properties: "real",
    },
  };

  return NextResponse.json({ success: true, overview: snapshot });
}

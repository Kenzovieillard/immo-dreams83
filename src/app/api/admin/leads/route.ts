import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import { isLeadStatus, leadStatusLabels } from "@/lib/crm";
import {
  FieldErrors,
  getStringField,
  hasRequiredValue,
  isValidEmail,
} from "@/lib/lead-validation";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { LeadStatus } from "@/types/crm";

const requestTypes = ["Achat", "Vente", "Estimation", "Terrain", "Autre"] as const;

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const [contacts, estimations, activities] = await Promise.all([
    supabase.from("contacts").select("*").order("created_at", { ascending: false }),
    supabase.from("estimations").select("*").order("created_at", { ascending: false }),
    supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const error = contacts.error ?? estimations.error ?? activities.error;
  if (error) {
    console.error("[IMMO-DREAMS83] Admin data load failed", error.message);
    return NextResponse.json({ success: false, message: "Les donnees CRM n'ont pas pu etre chargees." }, { status: 500 });
  }

  return NextResponse.json({ success: true, contacts: contacts.data, estimations: estimations.data, activities: activities.data });
}

function validateManualContactPayload(payload: unknown) {
  const fullName = getStringField(payload, "fullName");
  const email = getStringField(payload, "email");
  const phone = getStringField(payload, "phone");
  const requestType = getStringField(payload, "requestType");
  const city = getStringField(payload, "city");
  const message = getStringField(payload, "message");
  const fieldErrors: FieldErrors = {};

  if (!hasRequiredValue(fullName)) fieldErrors.fullName = "Le nom complet est obligatoire.";
  if (!hasRequiredValue(email)) fieldErrors.email = "L'email est obligatoire.";
  else if (!isValidEmail(email)) fieldErrors.email = "L'email n'est pas valide.";
  if (!requestTypes.includes(requestType as (typeof requestTypes)[number])) {
    fieldErrors.requestType = "Le type de demande est obligatoire.";
  }
  if (!hasRequiredValue(message)) fieldErrors.message = "Le message est obligatoire.";

  return { data: { fullName, email, phone, requestType, city, message }, fieldErrors };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;

  const payload = await request.json().catch(() => null);
  const { data, fieldErrors } = validateManualContactPayload(payload);

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { success: false, message: "Certains champs doivent etre corriges.", fieldErrors },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      name: data.fullName,
      email: data.email,
      phone: data.phone || null,
      request_type: data.requestType,
      city: data.city || null,
      message: data.message,
      status: "NEW",
      archived: false,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[IMMO-DREAMS83] Admin contact creation failed", error.message);
    return NextResponse.json({ success: false, message: "Le contact n'a pas pu etre cree." }, { status: 500 });
  }

  const actorName = auth.session.profile.full_name ?? auth.session.user.email;
  await supabase.from("activities").insert({
    entity_type: "contact",
    entity_id: contact.id,
    action: "Contact cree manuellement",
    user_name: actorName,
  });
  await writeAdminAuditLog(auth.session, "contact.create", "contact", contact.id);

  return NextResponse.json({ success: true, message: "Contact cree.", contact });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as {
    table?: "contacts" | "estimations";
    id?: string;
    status?: LeadStatus;
    notes?: string;
    archived?: boolean;
  } | null;

  if (!payload?.id || !payload.table || !["contacts", "estimations"].includes(payload.table)) {
    return NextResponse.json({ success: false, message: "Demande invalide." }, { status: 400 });
  }
  if (payload.status && !isLeadStatus(payload.status)) {
    return NextResponse.json({ success: false, message: "Statut invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const updates = {
    ...(payload.status ? { status: payload.status } : {}),
    ...(typeof payload.notes === "string" ? { notes: payload.notes } : {}),
    ...(typeof payload.archived === "boolean" ? { archived: payload.archived } : {}),
  };
  const { error } = await supabase.from(payload.table).update(updates).eq("id", payload.id);
  if (error) {
    console.error("[IMMO-DREAMS83] Admin lead update failed", error.message);
    return NextResponse.json({ success: false, message: "La mise a jour a echoue." }, { status: 500 });
  }

  const actorName = auth.session.profile.full_name ?? auth.session.user.email;
  await supabase.from("activities").insert({
    entity_type: payload.table === "contacts" ? "contact" : "estimation",
    entity_id: payload.id,
    action: payload.archived
      ? "Prospect archive"
      : payload.status
        ? `Statut change : ${leadStatusLabels[payload.status]}`
        : "Notes mises a jour",
    user_name: actorName,
  });
  await writeAdminAuditLog(auth.session, "lead.update", payload.table, payload.id, {
    status: payload.status,
    archived: payload.archived,
  });

  return NextResponse.json({ success: true, message: "Mise a jour enregistree." });
}

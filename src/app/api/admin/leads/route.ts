import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import {
  contactQualificationStatusLabels,
  contactRoleLabels,
  deriveContactRole,
  hasUsableContactMethod,
  isContactQualificationStatus,
  isContactRole,
  isLeadStatus,
  leadStatusLabels,
} from "@/lib/crm";
import {
  FieldErrors,
  getStringField,
  hasRequiredValue,
  isValidEmail,
} from "@/lib/lead-validation";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  ContactQualificationStatus,
  ContactRole,
  LeadStatus,
} from "@/types/crm";

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
      contact_role: deriveContactRole(data.requestType),
      qualification_status: hasUsableContactMethod(data.email, data.phone) ? "TO_REVIEW" : "NO_CONTACT",
      qualification_source: "AUTO",
      active_prospect: hasUsableContactMethod(data.email, data.phone),
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
    contactRole?: ContactRole;
    qualificationStatus?: ContactQualificationStatus;
    activeProspect?: boolean;
  } | null;

  if (!payload?.id || !payload.table || !["contacts", "estimations"].includes(payload.table)) {
    return NextResponse.json({ success: false, message: "Demande invalide." }, { status: 400 });
  }
  if (payload.status && !isLeadStatus(payload.status)) {
    return NextResponse.json({ success: false, message: "Statut invalide." }, { status: 400 });
  }
  const includesQualification =
    "contactRole" in payload ||
    "qualificationStatus" in payload ||
    "activeProspect" in payload;
  if (includesQualification && payload.table !== "contacts") {
    return NextResponse.json({ success: false, message: "La qualification concerne uniquement les contacts." }, { status: 400 });
  }
  if ("contactRole" in payload && !isContactRole(payload.contactRole)) {
    return NextResponse.json({ success: false, message: "Rôle commercial invalide." }, { status: 400 });
  }
  if ("qualificationStatus" in payload && !isContactQualificationStatus(payload.qualificationStatus)) {
    return NextResponse.json({ success: false, message: "État de qualification invalide." }, { status: 400 });
  }
  if ("activeProspect" in payload && typeof payload.activeProspect !== "boolean") {
    return NextResponse.json({ success: false, message: "État du prospect invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const updates: Record<string, unknown> = {
    ...(payload.status ? { status: payload.status } : {}),
    ...(typeof payload.notes === "string" ? { notes: payload.notes } : {}),
    ...(typeof payload.archived === "boolean" ? { archived: payload.archived } : {}),
  };

  let qualificationAction: string | null = null;
  if (includesQualification && payload.table === "contacts") {
    const { data: currentContact, error: currentContactError } = await supabase
      .from("contacts")
      .select("contact_role,qualification_status,active_prospect")
      .eq("id", payload.id)
      .single();

    if (currentContactError || !currentContact) {
      console.error("[IMMO-DREAMS83] Contact qualification read failed", currentContactError?.message);
      return NextResponse.json({ success: false, message: "Le contact n'a pas pu être relu." }, { status: 500 });
    }

    const nextRole = payload.contactRole ?? (currentContact.contact_role as ContactRole);
    const nextQualification =
      payload.qualificationStatus ??
      (currentContact.qualification_status as ContactQualificationStatus);
    const qualificationDisablesProspect = ["DUPLICATE", "NO_CONTACT", "INACTIVE"].includes(nextQualification);
    const nextActiveProspect = qualificationDisablesProspect
      ? false
      : payload.activeProspect ?? Boolean(currentContact.active_prospect);

    if (nextQualification === "QUALIFIED" && nextRole === "UNKNOWN") {
      return NextResponse.json(
        { success: false, message: "Choisissez Acquéreur, Vendeur, Mixte ou Autre avant de valider." },
        { status: 400 }
      );
    }

    updates.contact_role = nextRole;
    updates.qualification_status = nextQualification;
    updates.qualification_source = "MANUAL";
    updates.active_prospect = nextActiveProspect;
    updates.qualified_at = nextQualification === "QUALIFIED" ? new Date().toISOString() : null;
    updates.qualified_by = nextQualification === "QUALIFIED" ? auth.session.user.id : null;
    qualificationAction = `Qualification : ${contactRoleLabels[nextRole]} · ${contactQualificationStatusLabels[nextQualification]}`;
  }

  const { data: updatedLead, error } = await supabase
    .from(payload.table)
    .update(updates)
    .eq("id", payload.id)
    .select("*")
    .single();
  if (error) {
    console.error("[IMMO-DREAMS83] Admin lead update failed", error.message);
    return NextResponse.json({ success: false, message: "La mise a jour a echoue." }, { status: 500 });
  }

  const actorName = auth.session.profile.full_name ?? auth.session.user.email;
  await supabase.from("activities").insert({
    entity_type: payload.table === "contacts" ? "contact" : "estimation",
    entity_id: payload.id,
    action: qualificationAction ??
      (payload.archived
      ? "Prospect archive"
      : payload.status
        ? `Statut change : ${leadStatusLabels[payload.status]}`
        : "Notes mises a jour"),
    user_name: actorName,
  });
  await writeAdminAuditLog(auth.session, "lead.update", payload.table, payload.id, {
    status: payload.status,
    archived: payload.archived,
    contactRole: payload.contactRole,
    qualificationStatus: payload.qualificationStatus,
    activeProspect: payload.activeProspect,
  });

  return NextResponse.json({
    success: true,
    message: qualificationAction ? "Qualification enregistrée." : "Mise a jour enregistree.",
    lead: updatedLead,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkContactAccess } from "@/lib/contact-access";
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
import type { TablesUpdate } from "@/types/supabase";

const requestTypes = ["Achat", "Vente", "Estimation", "Terrain", "Autre"] as const;
const optionalText = z.string().max(4000).optional();
const contactPatchShape = z.object({
  id: z.string().uuid(), table: z.enum(["contacts", "estimations"]),
  action: z.enum(["merge-contacts", "ignore-duplicate"]).optional(),
  secondaryContactId: z.string().uuid().optional(), assignedTo: z.string().uuid().nullable().optional(),
  archived: z.boolean().optional(), activeProspect: z.boolean().optional(),
  notes: optionalText, assignmentReason: optionalText, name: optionalText, email: optionalText,
  phone: optionalText, category: optionalText, city: optionalText, message: optionalText,
  address: optionalText, postalCode: optionalText, contactPreference: optionalText,
  personalSituation: optionalText, profession: optionalText, currentResidence: optionalText, contactSource: optionalText,
}).passthrough();

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const [contacts, estimations, activities] = await Promise.all([
    auth.session.profile.role === "AGENT"
      ? supabase.from("contacts").select("*").eq("assigned_to", auth.session.user.id).order("created_at", { ascending: false })
      : supabase.from("contacts").select("*").order("created_at", { ascending: false }),
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
  const firstName = getStringField(payload, "firstName");
  const lastName = getStringField(payload, "lastName");
  const fullName = `${firstName} ${lastName}`.trim();
  const email = getStringField(payload, "email");
  const phone = getStringField(payload, "phone");
  const requestType = getStringField(payload, "requestType");
  const city = getStringField(payload, "city");
  const estimatedBudgetValue = getStringField(payload, "estimatedBudget");
  const source = getStringField(payload, "source");
  const assignedTo = getStringField(payload, "assignedTo");
  const message = getStringField(payload, "message");
  const fieldErrors: FieldErrors = {};

  if (!hasRequiredValue(lastName)) fieldErrors.lastName = "Le nom est obligatoire.";
  if (email && !isValidEmail(email)) fieldErrors.email = "L'email n'est pas valide.";
  if (!hasRequiredValue(phone) || phone.replace(/\D/g, "").length < 8 || phone.length > 40) fieldErrors.phone = "Renseignez un numéro de téléphone valide.";
  if (!requestTypes.includes(requestType as (typeof requestTypes)[number])) {
    fieldErrors.requestType = "Le type de demande est obligatoire.";
  }
  if (!hasRequiredValue(message)) fieldErrors.message = "Le message est obligatoire.";
  const estimatedBudget = estimatedBudgetValue ? Number(estimatedBudgetValue) : null;
  if (estimatedBudget != null && (!Number.isFinite(estimatedBudget) || estimatedBudget < 0)) {
    fieldErrors.estimatedBudget = "Le budget estimé doit être positif.";
  }

  return { data: { fullName, email, phone, requestType, city, estimatedBudget, source, assignedTo, message }, fieldErrors };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;

  const payload = await request.json().catch(() => null);
  const { data, fieldErrors } = validateManualContactPayload(payload);
  if (auth.session.profile.role === "AGENT") data.assignedTo = auth.session.user.id;
  if (data.assignedTo && data.assignedTo !== "UNASSIGNED" && !z.string().uuid().safeParse(data.assignedTo).success) fieldErrors.assignedTo = "Responsable invalide.";

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

  if (data.assignedTo && data.assignedTo !== "UNASSIGNED") {
    const { data: owner } = await supabase.from("profiles").select("id,is_active,role").eq("id", data.assignedTo).maybeSingle();
    if (!owner?.is_active || !["ADMIN", "DIRECTOR", "AGENT", "ASSISTANT"].includes(owner.role)) {
      return NextResponse.json({ success: false, message: "Choisissez un conseiller actif." }, { status: 400 });
    }
  }

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      name: data.fullName,
      email: data.email || `manual-${Date.now()}@legacy.immo-dreams83.local`,
      phone: data.phone || null,
      request_type: data.requestType,
      city: data.city || null,
      estimated_budget: data.estimatedBudget,
      contact_source: data.source || "AGENCY",
      assigned_to: data.assignedTo && data.assignedTo !== "UNASSIGNED" ? data.assignedTo : null,
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
    action?: "merge-contacts" | "ignore-duplicate";
    secondaryContactId?: string;
    mergeNote?: string;
    assignedTo?: string | null;
    assignmentReason?: string;
    address?: string;
    postalCode?: string;
    contactPreference?: string;
    personalSituation?: string;
    profession?: string;
    currentResidence?: string;
    interestScore?: number | null;
    estimatedBudget?: number | null;
    priority?: "low" | "normal" | "high" | "urgent";
    name?: string;
    email?: string;
    phone?: string;
    category?: string;
    city?: string;
    message?: string;
    contactSource?: string;
  } | null;

  if (!payload?.id || !contactPatchShape.safeParse(payload).success || !payload.table || !["contacts", "estimations"].includes(payload.table)) {
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

  if (payload.table === "contacts") {
    const denied = await checkContactAccess(supabase, auth.session, payload.id);
    if (denied) return NextResponse.json({ success: false, message: denied.message }, { status: denied.status });
    if (payload.archived === false) {
      const current = await supabase.from("contacts").select("dedupe_status").eq("id", payload.id).single();
      if (current.error) return NextResponse.json({ success: false, message: "État du contact indisponible." }, { status: 500 });
      if (current.data.dedupe_status === "MERGED") return NextResponse.json({ success: false, message: "Un contact fusionné ne peut pas être restauré. Utilisez sa fiche principale." }, { status: 409 });
    }
    if ("assignedTo" in payload && auth.session.profile.role === "AGENT") return NextResponse.json({ success: false, message: "Le changement de responsable nécessite un responsable d'équipe." }, { status: 403 });
    if (payload.secondaryContactId) {
      if (!z.string().uuid().safeParse(payload.secondaryContactId).success) return NextResponse.json({ success: false, message: "Contact secondaire invalide." }, { status: 400 });
      const secondaryDenied = await checkContactAccess(supabase, auth.session, payload.secondaryContactId);
      if (secondaryDenied) return NextResponse.json({ success: false, message: secondaryDenied.message }, { status: secondaryDenied.status });
    }
  }

  if (payload.table === "contacts" && payload.action === "merge-contacts") {
    if (!payload.secondaryContactId || payload.secondaryContactId === payload.id) {
      return NextResponse.json({ success: false, message: "Choisissez deux contacts distincts." }, { status: 400 });
    }
    const { error: mergeError } = await supabase.rpc("merge_contact_workspace", {
      p_primary: payload.id,
      p_secondary: payload.secondaryContactId,
      p_actor: auth.session.user.id,
    });
    if (mergeError) {
      console.error("[IMMO-DREAMS83] Contact merge failed", mergeError.message);
      return NextResponse.json({ success: false, message: "La fusion des contacts a échoué." }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: "Les contacts ont été fusionnés." });
  }

  if (payload.table === "contacts" && payload.action === "ignore-duplicate") {
    const ids = [payload.id, payload.secondaryContactId].filter((value): value is string => Boolean(value));
    const { error: ignoreError } = await supabase.from("contacts").update({ dedupe_status: "IGNORED" }).in("id", ids);
    if (ignoreError) {
      console.error("[IMMO-DREAMS83] Duplicate ignore failed", ignoreError.message);
      return NextResponse.json({ success: false, message: "Le doublon n'a pas pu être ignoré." }, { status: 500 });
    }
    await writeAdminAuditLog(auth.session, "contact.duplicate.ignore", "contact", payload.id, {
      secondaryContactId: payload.secondaryContactId,
    });
    return NextResponse.json({ success: true, message: "Les deux contacts sont conservés séparément." });
  }

  if (payload.table === "contacts" && "assignedTo" in payload && payload.assignedTo) {
    const { data: owner } = await supabase
      .from("profiles")
      .select("id,is_active,role")
      .eq("id", payload.assignedTo)
      .maybeSingle();
    if (!owner?.is_active || !["ADMIN", "DIRECTOR", "AGENT", "ASSISTANT"].includes(owner.role)) {
      return NextResponse.json({ success: false, message: "Choisissez un conseiller actif." }, { status: 400 });
    }
  }

  if (payload.interestScore != null && (!Number.isInteger(payload.interestScore) || payload.interestScore < 0 || payload.interestScore > 100)) {
    return NextResponse.json({ success: false, message: "Le score d'intérêt doit être compris entre 0 et 100." }, { status: 400 });
  }
  if (payload.estimatedBudget != null && (!Number.isFinite(payload.estimatedBudget) || payload.estimatedBudget < 0)) {
    return NextResponse.json({ success: false, message: "Le budget estimé doit être positif." }, { status: 400 });
  }
  if (payload.priority && !["low", "normal", "high", "urgent"].includes(payload.priority)) {
    return NextResponse.json({ success: false, message: "La priorité est invalide." }, { status: 400 });
  }
  if (typeof payload.name === "string" && !payload.name.trim()) {
    return NextResponse.json({ success: false, message: "Le nom du contact est obligatoire." }, { status: 400 });
  }
  if (typeof payload.phone === "string" && (payload.phone.replace(/\D/g, "").length < 8 || payload.phone.length > 40)) {
    return NextResponse.json({ success: false, message: "Le téléphone est obligatoire." }, { status: 400 });
  }
  if (typeof payload.email === "string" && payload.email.trim() && !isValidEmail(payload.email.trim())) {
    return NextResponse.json({ success: false, message: "L'email n'est pas valide." }, { status: 400 });
  }

  const baseUpdates = {
    ...(payload.status ? { status: payload.status } : {}),
    ...(typeof payload.notes === "string" ? { notes: payload.notes } : {}),
    ...(typeof payload.archived === "boolean" ? { archived: payload.archived } : {}),
  } satisfies TablesUpdate<"contacts"> & TablesUpdate<"estimations">;

  let qualificationAction: string | null = null;
  const contactUpdates: TablesUpdate<"contacts"> = { ...baseUpdates };
  if (payload.table === "contacts") {
    if ("assignedTo" in payload) contactUpdates.assigned_to = payload.assignedTo || null;
    if (typeof payload.address === "string") contactUpdates.address = payload.address.trim() || null;
    if (typeof payload.postalCode === "string") contactUpdates.postal_code = payload.postalCode.trim() || null;
    if (typeof payload.contactPreference === "string") contactUpdates.contact_preference = payload.contactPreference.trim() || null;
    if (typeof payload.personalSituation === "string") contactUpdates.personal_situation = payload.personalSituation.trim() || null;
    if (typeof payload.profession === "string") contactUpdates.profession = payload.profession.trim() || null;
    if (typeof payload.currentResidence === "string") contactUpdates.current_residence = payload.currentResidence.trim() || null;
    if ("interestScore" in payload) contactUpdates.interest_score = payload.interestScore ?? null;
    if ("estimatedBudget" in payload) contactUpdates.estimated_budget = payload.estimatedBudget ?? null;
    if (payload.priority) contactUpdates.priority = payload.priority;
    if (typeof payload.name === "string") contactUpdates.name = payload.name.trim();
    if (typeof payload.email === "string") contactUpdates.email = payload.email.trim() || `manual-${payload.id}@legacy.immo-dreams83.local`;
    if (typeof payload.phone === "string") contactUpdates.phone = payload.phone.trim();
    if (typeof payload.category === "string") contactUpdates.request_type = payload.category.trim();
    if (typeof payload.city === "string") contactUpdates.city = payload.city.trim() || null;
    if (typeof payload.message === "string") contactUpdates.message = payload.message.trim();
    if (typeof payload.contactSource === "string") contactUpdates.contact_source = payload.contactSource.trim() || "AGENCY";
  }
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

    contactUpdates.contact_role = nextRole;
    contactUpdates.qualification_status = nextQualification;
    contactUpdates.qualification_source = "MANUAL";
    contactUpdates.active_prospect = nextActiveProspect;
    contactUpdates.qualified_at = nextQualification === "QUALIFIED" ? new Date().toISOString() : null;
    contactUpdates.qualified_by = nextQualification === "QUALIFIED" ? auth.session.user.id : null;
    qualificationAction = `Qualification : ${contactRoleLabels[nextRole]} · ${contactQualificationStatusLabels[nextQualification]}`;
  }

  const result = payload.table === "contacts"
    ? await supabase.from("contacts").update(contactUpdates).eq("id", payload.id).select("*").single()
    : await supabase
      .from("estimations")
      .update(baseUpdates satisfies TablesUpdate<"estimations">)
      .eq("id", payload.id)
      .select("*")
      .single();
  const { data: updatedLead, error } = result;
  if (error) {
    console.error("[IMMO-DREAMS83] Admin lead update failed", error.message);
    return NextResponse.json({ success: false, message: "La mise a jour a echoue." }, { status: 500 });
  }

  const actorName = auth.session.profile.full_name ?? auth.session.user.email;
  await supabase.from("activities").insert({
    entity_type: payload.table === "contacts" ? "contact" : "estimation",
    entity_id: payload.id,
    action: qualificationAction ??
      ("assignedTo" in payload
        ? `Responsable modifié${payload.assignmentReason?.trim() ? ` · ${payload.assignmentReason.trim()}` : ""}`
        : payload.archived
          ? "Prospect archive"
          : payload.status
            ? `Statut change : ${leadStatusLabels[payload.status]}`
            : "Fiche contact mise à jour"),
    user_name: actorName,
  });
  await writeAdminAuditLog(auth.session, "lead.update", payload.table, payload.id, {
    status: payload.status,
    archived: payload.archived,
    contactRole: payload.contactRole,
    qualificationStatus: payload.qualificationStatus,
    activeProspect: payload.activeProspect,
    assignedTo: payload.assignedTo,
    assignmentReason: payload.assignmentReason,
  });

  return NextResponse.json({
    success: true,
    message: qualificationAction ? "Qualification enregistrée." : "Mise a jour enregistree.",
    lead: updatedLead,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminSession("lead.delete");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as { id?: string; confirmation?: boolean } | null;
  if (!payload?.id || !z.string().uuid().safeParse(payload.id).success || payload.confirmation !== true) {
    return NextResponse.json({ success: false, message: "La confirmation de suppression est obligatoire." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const denied = await checkContactAccess(supabase, auth.session, payload.id);
  if (denied) return NextResponse.json({ success: false, message: denied.message }, { status: denied.status });
  const dependencies = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("contact_id", payload.id),
    supabase.from("offers").select("id", { count: "exact", head: true }).or(`contact_id.eq.${payload.id},buyer_contact_id.eq.${payload.id}`),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("contact_id", payload.id),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("contact_id", payload.id),
    supabase.from("buyer_searches").select("id", { count: "exact", head: true }).eq("contact_id", payload.id),
    supabase.from("negotiations").select("id", { count: "exact", head: true }).or(`buyer_contact_id.eq.${payload.id},seller_contact_id.eq.${payload.id}`),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("canonical_contact_id", payload.id),
  ]);
  if (dependencies.some(result => result.error)) {
    return NextResponse.json({ success: false, message: "Les dépendances du contact n'ont pas pu être vérifiées." }, { status: 500 });
  }
  if (dependencies.some(result => (result.count ?? 0) > 0)) {
    return NextResponse.json(
      { success: false, message: "Ce contact possède des données liées (dossier, tâche, visite, recherche ou offre). Archivez-le afin de conserver l'historique." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("contacts").delete().eq("id", payload.id);
  if (error) {
    console.error("[IMMO-DREAMS83] Contact deletion failed", error.message);
    return NextResponse.json({ success: false, message: "Le contact n'a pas pu être supprimé." }, { status: 500 });
  }
  await supabase.from("activities").delete().eq("entity_type", "contact").eq("entity_id", payload.id);
  await writeAdminAuditLog(auth.session, "contact.delete", "contact", payload.id);

  return NextResponse.json({ success: true, message: "Contact supprimé définitivement." });
}

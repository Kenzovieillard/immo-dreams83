import { NextRequest, NextResponse } from "next/server";
import { isLeadStatus } from "@/lib/crm";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { LeadStatus } from "@/types/crm";

function isAuthorized(request: NextRequest) {
  const expectedCode = process.env.NEXT_PUBLIC_ADMIN_LOCAL_CODE;
  return Boolean(expectedCode && request.headers.get("x-admin-code") === expectedCode);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const [contacts, estimations, activities] = await Promise.all([
    supabase.from("contacts").select("*").order("created_at", { ascending: false }),
    supabase.from("estimations").select("*").order("created_at", { ascending: false }),
    supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const error = contacts.error ?? estimations.error ?? activities.error;
  if (error) {
    console.error("[IMMO-DREAMS83] Admin data load failed", error.message);
    return NextResponse.json({ success: false, message: "Les données CRM n'ont pas pu être chargées." }, { status: 500 });
  }

  return NextResponse.json({ success: true, contacts: contacts.data, estimations: estimations.data, activities: activities.data });
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 401 });
  }

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
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const updates = {
    ...(payload.status ? { status: payload.status } : {}),
    ...(typeof payload.notes === "string" ? { notes: payload.notes } : {}),
    ...(typeof payload.archived === "boolean" ? { archived: payload.archived } : {}),
  };
  const { error } = await supabase.from(payload.table).update(updates).eq("id", payload.id);
  if (error) {
    console.error("[IMMO-DREAMS83] Admin lead update failed", error.message);
    return NextResponse.json({ success: false, message: "La mise à jour a échoué." }, { status: 500 });
  }

  await supabase.from("activities").insert({
    entity_type: payload.table === "contacts" ? "contact" : "estimation",
    entity_id: payload.id,
    action: payload.archived ? "Prospect archivé" : payload.status ? `Statut changé : ${payload.status}` : "Notes mises à jour",
    user_name: "Administration locale",
  });

  return NextResponse.json({ success: true, message: "Mise à jour enregistrée." });
}

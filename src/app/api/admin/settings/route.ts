import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, hasAdminPermission } from "@/lib/admin-auth";
import { isAgencyManager, parseSettingsContactsCsv, settingsContactsTemplate, settingsSection, settingsSections, userSettingsSchema } from "@/lib/crm-settings";
import { loadCrmSettings } from "@/lib/crm-settings-service";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { TablesInsert } from "@/types/supabase";

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const fail = (message: string, status: number) => json({ success: false, message }, status);

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const selection = request.nextUrl.searchParams.get("section") ?? "agency";
  if (!settingsSections.some(row => row.id === selection)) return fail("Rubrique inconnue.", 400);
  const section = settingsSection(selection);
  if (section === "users" && !isAgencyManager(auth.session.profile.role)) return fail("L’annuaire d’équipe est réservé à la direction.", 403);
  if (section === "data" && request.nextUrl.searchParams.get("template") === "contacts") {
    return new NextResponse(settingsContactsTemplate, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="modele-contacts.csv"' } });
  }
  const db = getSupabaseAdminClient();
  if (!db) return fail("Connexion CRM indisponible.", 503);
  try {
    return json({ success: true, data: await loadCrmSettings(db, auth.session, section) });
  } catch (error) {
    console.error("[Paramètres CRM]", error instanceof Error ? error.message : "Erreur de lecture");
    return fail("Les paramètres sont indisponibles. Réessayez dans un instant.", 503);
  }
}

const mutationReplies: Record<string, { message: string; status: number }> = {
  forbidden: { message: "Droits insuffisants.", status: 403 },
  conflict: { message: "Ce réglage a changé depuis son ouverture. Actualisez avant de réessayer.", status: 409 },
  self: { message: "Votre propre rôle et accès sont protégés.", status: 409 },
  last_admin: { message: "Conservez au moins un administrateur actif.", status: 409 },
  missing: { message: "Utilisateur introuvable.", status: 404 },
};

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return fail("Format JSON requis.", 415);
  const parsed = userSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Vérifiez les champs saisis.", 400);
  const db = getSupabaseAdminClient();
  if (!db) return fail("Connexion CRM indisponible.", 503);
  const actor = auth.session.user.id;
  const input = parsed.data;
  if (input.action === "agency" || input.action === "member") {
    if (input.action === "agency" && !isAgencyManager(auth.session.profile.role)
      || input.action === "member" && !hasAdminPermission(auth.session.profile.role, "users.manage")) return fail("Droits insuffisants.", 403);
    const result = input.action === "agency"
      ? await db.rpc("save_crm_agency", { p_actor: actor, p_information: input.information, p_expected: input.expected })
      : await db.rpc("update_crm_team_member", { p_actor: actor, p_member: input.id, p_name: input.name, p_role: input.role, p_active: input.active, p_expected: input.expected });
    if (result.error) return fail("Enregistrement indisponible.", 503);
    if (result.data === "ok") return json({ success: true });
    const outcome = mutationReplies[result.data ?? ""];
    return fail(outcome?.message ?? "Enregistrement refusé.", outcome?.status ?? 409);
  }

  const values: TablesInsert<"crm_user_settings"> = input.action === "notifications"
    ? { user_id: actor, preferences: input.preferences }
    : { user_id: actor, inbox_seen_at: new Date().toISOString() };
  const { error } = await db.from("crm_user_settings").upsert(values);
  if (error) return fail("Les préférences n’ont pas pu être enregistrées.", 503);
  return json({ success: true });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  if (!isAgencyManager(auth.session.profile.role)) return fail("L’import est réservé à la direction.", 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return fail("Format JSON requis.", 415);
  const input = await request.json().catch(() => null) as { csv?: unknown; confirm?: unknown } | null;
  if (typeof input?.csv !== "string" || input.confirm !== true) return fail("Confirmez l’import d’un fichier CSV.", 400);
  const { rows, errors } = parseSettingsContactsCsv(input.csv);
  if (errors.length) return fail(errors[0], 400);
  const db = getSupabaseAdminClient();
  if (!db) return fail("Connexion CRM indisponible.", 503);
  const result = await db.rpc("import_crm_contacts", { p_actor: auth.session.user.id, p_rows: rows });
  if (result.error || typeof result.data !== "number" || result.data < 0) return fail("L’import a échoué.", 503);
  return json({ success: true, inserted: result.data, skipped: rows.length - result.data });
}

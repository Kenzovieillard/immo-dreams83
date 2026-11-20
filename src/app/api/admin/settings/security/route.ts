import { NextResponse } from "next/server";
import { getCrmUserAuthClient, requireAdminSession, setAdminSessionCookies, writeAdminAuditLog } from "@/lib/admin-auth";
import { settingsSecuritySchema } from "@/lib/crm-settings";
import { createCrmAuthClient, getSupabaseAdminClient } from "@/lib/supabase";

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const fail = (message: string, status: number) => json({ success: false, message }, status);

async function matchesPassword(email: string, userId: string, password: string) {
  const check = createCrmAuthClient();
  if (!check) return false;
  const { data, error } = await check.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await check.auth.signOut({ scope: "local" });
  return data.user.id === userId;
}

export async function POST(request: Request) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return fail("Format JSON requis.", 415);
  const result = settingsSecuritySchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return fail("Vérifiez les champs de sécurité.", 400);
  const input = result.data;
  const { session } = auth;
  const user = session.user;
  const audit = (action: string) => writeAdminAuditLog(session, action, "auth", user.id);
  if (input.action === "profile") {
    const db = getSupabaseAdminClient();
    if (!db) return fail("Connexion CRM indisponible.", 503);
    const { error } = await db.from("profiles").update({ full_name: input.name, updated_at: new Date().toISOString() })
      .eq("id", user.id).eq("is_active", true).select("id").single();
    if (error) return fail("Le profil n’a pas pu être mis à jour.", 503);
    await audit("settings.profile.updated");
    return json({ success: true });
  }

  const client = await getCrmUserAuthClient();
  if (!client) return fail("Reconnectez-vous avant de modifier la sécurité.", 401);
  if (input.action === "password") {
    if (!(await matchesPassword(user.email, user.id, input.current))) return fail("Le mot de passe actuel est incorrect.", 403);
    const { error } = await client.auth.updateUser({ password: input.next, current_password: input.current });
    if (error) return fail("Le mot de passe a été refusé par le service d’authentification. Réessayez après une connexion récente.", 400);
    await audit("settings.password.updated");
    return json({ success: true });
  }
  if (input.action === "revoke-other-sessions") {
    const { error } = await client.auth.signOut({ scope: "others" });
    if (error) return fail("Les autres sessions n’ont pas pu être déconnectées.", 503);
    await audit("settings.sessions.revoked");
    return json({ success: true });
  }

  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  if (factorError || !factors) return fail("Les facteurs d’authentification sont indisponibles.", 503);
  const verified = factors.totp.find(row => row.status === "verified");

  if (input.action === "start-mfa") {
    if (verified) return fail("Un facteur est déjà actif.", 409);
    if (!(await matchesPassword(user.email, user.id, input.current))) return fail("Le mot de passe actuel est incorrect.", 403);
    for (const stale of factors.all.filter(row => row.factor_type === "totp" && row.status === "unverified" && row.friendly_name === "CRM Riviera")) {
      const { error } = await client.auth.mfa.unenroll({ factorId: stale.id });
      if (error) return fail("La précédente configuration doit être terminée ou supprimée.", 409);
    }
    const start = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "CRM Riviera", issuer: "IMMO DREAMS83" });
    if (start.error || !start.data) return fail("L’activation TOTP est indisponible dans Supabase Auth.", 503);
    return json({ success: true, factorId: start.data.id, qr: start.data.totp.qr_code, secret: start.data.totp.secret });
  }

  if (input.action === "confirm-mfa") {
    const factor = factors.all.find(row => row.id === input.factorId && row.factor_type === "totp" && row.status === "unverified");
    if (!factor) return fail("Activez d’abord un facteur depuis ce compte.", 400);
    const proof = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: input.code });
    if (proof.error || !proof.data) return fail("Code invalide ou expiré.", 400);
    const response = json({ success: true });
    setAdminSessionCookies(response, proof.data);
    await audit("settings.mfa.enabled");
    return response;
  }

  if (!verified) return fail("Aucun facteur TOTP actif.", 409);
  if (!(await matchesPassword(user.email, user.id, input.current))) return fail("Le mot de passe actuel est incorrect.", 403);
  const proof = await client.auth.mfa.challengeAndVerify({ factorId: verified.id, code: input.code });
  if (proof.error || !proof.data) return fail("Code invalide ou expiré.", 400);
  const { error } = await client.auth.mfa.unenroll({ factorId: verified.id });
  if (error) return fail("Le facteur n’a pas pu être retiré.", 503);
  const response = json({ success: true });
  setAdminSessionCookies(response, proof.data);
  await audit("settings.mfa.disabled");
  return response;
}

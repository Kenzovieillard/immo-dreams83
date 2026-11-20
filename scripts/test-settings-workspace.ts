import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, type BrowserContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultNotificationPrefs, settingsHref, settingsSections, type SettingsData } from "../src/lib/crm-settings";
import type { Database } from "../src/types/supabase";

const api = "/api/admin/settings";

function totp(secret: string, now = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let value = 0, bits = 0;
  const key: number[] = [];
  for (const character of secret.toUpperCase().replace(/=+$/, "")) {
    const index = alphabet.indexOf(character);
    assert(index >= 0, "Format de la clé TOTP de recette");
    value = value << 5 | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      key.push(value >>> bits & 0xff);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const digest = createHmac("sha1", Buffer.from(key)).update(counter).digest();
  return String((digest.readUInt32BE(digest.at(-1)! & 0xf) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

export async function verifySettingsWorkspace({
  writer, reader, supabase, baseUrl, runId, adminId, readerId, contactId, adminEmail, password, record,
}: {
  writer: BrowserContext; reader: BrowserContext; supabase: SupabaseClient<Database>; baseUrl: string;
  runId: string; adminId: string; readerId: string; contactId: string; adminEmail: string; password: string;
  record: (check: string, evidence: string) => void;
}) {
  const endpoint = baseUrl + api;
  const loginUrl = baseUrl + "/api/admin/auth/login";
  const authPath = baseUrl + "/api/admin/settings/security";
  const agencyName = `${runId} Agence`;
  const original = await supabase.from("crm_agency_settings").select("*").eq("id", true).maybeSingle();
  assert.ifError(original.error);

  async function read(section: string, browserContext = writer) {
    const response = await browserContext.request.get(`${endpoint}?section=${section}`);
    assert.equal(response.status(), 200, `Lecture ${section}`);
    return (await response.json() as { data: SettingsData }).data;
  }
  const security = (body: unknown) => writer.request.post(authPath, { data: body });
  const login = (credentials: { password: string; code?: string }) => fetch(loginUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, redirect: settingsHref("security"), ...credentials }),
  });

  try {
    assert.equal((await fetch(endpoint)).status, 401);
    assert.equal((await reader.request.get(`${endpoint}?section=users`)).status(), 403);
    assert.equal((await reader.request.post(endpoint, { data: { csv: "", confirm: true } })).status(), 403);
    const valid = await read("agency");
    assert(valid.agency);
    const edit = { action: "agency", information: { ...valid.agency, name: agencyName }, expected: valid.revision };
    assert.equal((await reader.request.patch(endpoint, { data: edit })).status(), 403);
    const team = (await read("users")).team ?? [];
    const originalViewer = team.find(row => row.id === readerId);
    assert(originalViewer?.last_sign_in_at);
    assert(!("team" in await read("agency", reader)));
    record("Paramètres · Droits", "Lecture privée, annuaire de direction et actions d’administration protégées");

    const page = await writer.newPage();
    const errors: string[] = [];
    page.on("pageerror", cause => errors.push(cause.message));
    await page.goto(`${baseUrl}${settingsHref()}`);
    await expect(page.getByRole("heading", { name: "Informations de l’agence" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Modifier Nom de l’agence" }).click();
    await page.getByLabel("Nom de l’agence").fill(agencyName);
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Les informations de l’agence ont été enregistrées.")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("aside").getByText(agencyName, { exact: true })).toBeVisible({ timeout: 60_000 });
    assert.equal((await read("agency")).agency?.name, agencyName);
    assert.equal((await writer.request.patch(endpoint, { data: edit })).status(), 409);
    record("Paramètres · Agence", "Fiche persistée, nom répercuté dans la navigation et révision concurrente refusée");

    const member = (await read("users")).team?.find(row => row.id === adminId);
    assert(member);
    assert.equal((await writer.request.patch(endpoint, { data: { action: "member", id: adminId, name: "Test", role: "ADMIN", active: false, expected: member.updated_at } })).status(), 409);
    const memberBody = { action: "member", id: readerId, name: `${runId} Conseiller`, role: "AGENT", active: false, expected: originalViewer.updated_at };
    assert.equal((await writer.request.patch(endpoint, { data: memberBody })).status(), 200);
    assert.equal((await reader.request.get(endpoint)).status(), 401);
    const disabled = (await read("users")).team?.find(row => row.id === readerId);
    assert.equal(disabled?.is_active, false);
    assert.equal((await writer.request.patch(endpoint, { data: { ...memberBody, active: true, expected: disabled?.updated_at } })).status(), 200);
    assert.equal((await reader.request.get(endpoint)).status(), 200);
    record("Paramètres · Utilisateurs", "Rôle, désactivation et réactivation vérifiés sur le CRM, y compris l’auto-désactivation refusée");

    const assignment = await supabase.from("contacts").update({ assigned_to: adminId }).eq("id", contactId);
    assert.ifError(assignment.error);
    const setup = { ...defaultNotificationPrefs, weekly: false };
    assert.equal((await writer.request.patch(endpoint, { data: { action: "notifications", preferences: setup } })).status(), 200);
    const inbox = async () => {
      const response = await writer.request.get(`${endpoint}/inbox`);
      assert.equal(response.status(), 200);
      return response.json() as Promise<{ items: { id: string }[]; unread: number }>;
    };
    assert((await inbox()).items.some(item => item.id === `contact:${contactId}`));
    const bell = page.locator("header").getByRole("button", { name: /^Notifications/ });
    await bell.click();
    const drawer = page.getByRole("dialog", { name: "Notifications" });
    await expect(drawer.getByText("Contact dans votre portefeuille")).toBeVisible();
    await drawer.getByRole("button", { name: "Tout marquer comme lu" }).click();
    await expect.poll(async () => (await inbox()).unread).toBe(0);
    await drawer.getByRole("button", { name: "Fermer", exact: true }).click();
    assert.equal((await writer.request.patch(endpoint, { data: { action: "notifications", preferences: { ...setup, contact: false } } })).status(), 200);
    assert(!(await inbox()).items.some(item => item.id === `contact:${contactId}`));
    assert.equal((await read("notifications", reader)).preferences?.contact, true);
    record("Paramètres · Notifications", "Cloche, lecture et préférences privées contrôlées sur un vrai contact attribué");

    const nav = page.getByRole("navigation", { name: "Rubriques des paramètres" });
    await nav.getByRole("button", { name: "Import / Export", exact: true }).click();
    const csv = `Nom;Email;Téléphone;Ville\n${runId} Import;${runId.toLowerCase()}-csv@example.test;;Fréjus`;
    await page.getByLabel("Fichier CSV").setInputFiles({ name: "contacts.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: "Importer 1 contact(s)", exact: true }).click();
    await expect(page.getByText("1 contact(s) créé(s), 0 doublon(s) ignoré(s).")).toBeVisible({ timeout: 30_000 });
    const retry = await writer.request.post(endpoint, { data: { csv, confirm: true } });
    assert.equal(retry.status(), 200);
    assert.equal((await retry.json()).skipped, 1);
    assert((await read("sources")).references?.some(row => row.code === "IMPORT_CSV" && row.count >= 1));
    record("Paramètres · Import", "Prévisualisation CSV, insertion réelle, déduplication au second import et source CRM visible");

    for (const item of settingsSections) {
      await nav.getByRole("button", { name: item.label, exact: true }).click();
      await expect(nav.getByRole("button", { name: item.label, exact: true })).toHaveAttribute("aria-current", "page");
      assert.equal((await read(item.id)).viewerId, adminId);
    }
    const root = page.getByRole("region", { name: "Paramètres" });
    await expect(root.getByRole("heading", { name: "Authentification", exact: true })).toBeVisible();
    const output = join(process.cwd(), "work", "settings-qa");
    mkdirSync(output, { recursive: true });
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(root).toBeVisible();
      assert(await root.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Débordement à ${width}px`);
      if (width === 390 || width === 1440) await page.screenshot({ path: join(output, `${runId}-${width}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    await page.close();
    record("Paramètres · Navigation et responsive", "Dix rubriques réelles à sept largeurs, sans débordement ni erreur d’exécution");

    const separate = await login({ password });
    assert.equal(separate.status, 200, "Connexion de recette sur un deuxième appareil");
    assert((await read("security")).sessions?.some(row => row.current));
    assert.equal((await security({ action: "revoke-other-sessions" })).status(), 200);
    assert.equal((await read("security")).sessions?.filter(row => !row.current).length, 0);
    assert.equal((await security({ action: "password", current: "Incorrect!123", next: "Nouveau!2026-Test" })).status(), 403);
    const next = "Riviera!2026-" + crypto.randomUUID();
    assert.equal((await security({ action: "password", current: password, next })).status(), 200, "Modification réelle du mot de passe");
    const afterPassword = await writer.request.post(loginUrl, { data: { email: adminEmail, password: next } });
    assert.equal(afterPassword.status(), 200);
    const priorCookies = (await writer.cookies()).map(row => `${row.name}=${row.value}`).join("; ");
    const enrollment = await security({ action: "start-mfa", current: next });
    assert.equal(enrollment.status(), 200, "Démarrage de l’enrôlement MFA");
    const setupData = await enrollment.json() as { factorId: string; secret: string; qr: string };
    assert(setupData.qr.startsWith("data:image/svg+xml"));
    const confirmed = await security({ action: "confirm-mfa", factorId: setupData.factorId, code: totp(setupData.secret) });
    assert.equal(confirmed.status(), 200, "Vérification du facteur et changement de niveau de session");
    assert.equal((await read("security")).mfaEnabled, true);
    assert.equal((await fetch(endpoint, { headers: { Cookie: priorCookies } })).status, 401, "Refus de l’ancien jeton de premier niveau");
    const required = await login({ password: next });
    assert.equal(required.status, 401);
    assert.equal((await required.json()).mfaRequired, true);
    await delay(31_000 - Date.now() % 30_000);
    const withCode = await login({ password: next, code: totp(setupData.secret) });
    assert.equal(withCode.status, 200, "Connexion avec un code valide");
    assert.equal((await withCode.json()).redirectTo, settingsHref("security"));
    record("Paramètres · Sécurité", "Mot de passe modifié, sessions réelles, révocation des autres appareils, MFA activée et code requis après reconnexion");
  } finally {
    const current = await supabase.from("crm_agency_settings").select("information,updated_at").eq("id", true).maybeSingle();
    assert.ifError(current.error);
    if (current.data && (current.data.information as { name?: string }).name === agencyName) {
      const restore = original.data
        ? await supabase.from("crm_agency_settings").update({ information: original.data.information, updated_at: original.data.updated_at }).eq("id", true).eq("updated_at", current.data.updated_at)
        : await supabase.from("crm_agency_settings").delete().eq("id", true).eq("updated_at", current.data.updated_at);
      assert.ifError(restore.error);
    }
  }
}

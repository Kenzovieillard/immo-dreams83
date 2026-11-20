import assert from "node:assert/strict";
import test from "node:test";
import { agencySettingsSchema, defaultNotificationPrefs, parseSettingsContactsCsv, settingsHref, settingsSection, settingsSecuritySchema } from "../src/lib/crm-settings";

test("l’import reconnaît le modèle français, les guillemets et le BOM", () => {
  const file = '\uFEFFNom;Email;Téléphone;Ville\r\n"Test; AZ ""équipe""";Contact@example.test;;Fréjus\r\n';
  const result = parseSettingsContactsCsv(file);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows, [{ name: 'Test; AZ "équipe"', email: "contact@example.test", phone: "", city: "Fréjus" }]);
});

test("l’import refuse un en-tête invalide, un fichier incohérent et plus de 200 lignes", () => {
  assert(parseSettingsContactsCsv("Nom;Mauvaise colonne\nTest;example.test").errors.length);
  assert(parseSettingsContactsCsv('Nom;Email;Téléphone;Ville\n"Alice;a@example.test;;').errors.length);
  const many = "Nom;Email;Téléphone;Ville\n" + "Alice;a@example.test;;\n".repeat(201);
  assert(parseSettingsContactsCsv(many).errors.length);
});

test("les actions sensibles valident un mot de passe distinct et un code TOTP à six chiffres", () => {
  assert.equal(settingsSecuritySchema.safeParse({ action: "password", current: "Identique1", next: "Identique1" }).success, false);
  assert.equal(settingsSecuritySchema.safeParse({ action: "password", current: "ancien", next: "nouveau123" }).success, false);
  assert.equal(settingsSecuritySchema.safeParse({ action: "password", current: "ancien", next: "Nouveau123" }).success, true);
  assert.equal(settingsSecuritySchema.safeParse({ action: "disable-mfa", current: "ancien", code: "12345" }).success, false);
});

test("les paramètres valident les coordonnées internes et retrouvent les liens canoniques", () => {
  const values = { name: "Agence", address: "", phone: "", email: "", website: "", siret: "", professionalCard: "" };
  assert(agencySettingsSchema.safeParse(values).success);
  assert(!agencySettingsSchema.safeParse({ ...values, website: "javascript:alert(1)" }).success);
  assert(!agencySettingsSchema.safeParse({ ...values, siret: "123" }).success);
  assert.equal(settingsHref("security"), "/admin?tab=settings&section=security");
  assert.equal(settingsSection("invalide"), "agency");
  assert.equal(defaultNotificationPrefs.reminderMinutes, 30);
});

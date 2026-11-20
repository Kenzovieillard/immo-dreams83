import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, type BrowserContext } from "@playwright/test";
import { parisDay, shiftAgendaDay } from "../src/lib/agenda-time";
import { statisticsHref, statisticsPeriod, statisticsViews, type StatisticsReport } from "../src/lib/statistics";
import type { Database } from "../src/types/supabase";

const reports = "/api/admin/statistics";
const sales = `${reports}/sales`;
const viewportWidths = [320, 375, 390, 768, 1024, 1280, 1440];

export async function verifyStatisticsWorkspace({
  writer, reader, supabase, baseUrl, runId, adminId, readerId, contactId, onPropertyCreated, record,
}: {
  writer: BrowserContext;
  reader: BrowserContext;
  supabase: SupabaseClient<Database>;
  baseUrl: string;
  runId: string;
  adminId: string;
  readerId: string;
  contactId: string;
  onPropertyCreated: (id: string) => void;
  record: (check: string, evidence: string) => void;
}) {
  const today = parisDay();
  const title = `${runId} Bien vendu`;
  const period = { from: today, to: today };
  const property = await supabase.from("properties").insert({
    slug: `${runId.toLowerCase()}-vente`, title, reference: runId,
    status: "sold", commercial_status: "SOLD", publication_status: "UNPUBLISHED", type: "house",
    city: "Toulon", price: 400_000, surface: 100, advisor_id: adminId, created_by: adminId,
    postal_code: "83000", published_at: `${shiftAgendaDay(today, -40)}T08:00:00Z`,
  }).select("id").single();
  assert.ifError(property.error);
  assert(property.data);
  const propertyId = property.data.id;
  onPropertyCreated(propertyId);
  const assigned = await supabase.from("contacts").update({ assigned_to: adminId, qualified_at: new Date().toISOString(), qualification_status: "QUALIFIED" }).eq("id", contactId);
  assert.ifError(assigned.error);
  const interaction = await writer.request.post(`${baseUrl}/api/admin/contacts/${contactId}/actions`, {
    data: { action: "log-activity", kind: "CALL", description: "Appel de recette pour contrôler le temps de réponse." },
  });
  assert.equal(interaction.status(), 200);

  const qs = new URLSearchParams({ view: "commercial", ...period, advisor: adminId });
  const url = `${baseUrl}${reports}?${qs}`;
  async function readReport(view: string, client = writer) {
    const query = new URLSearchParams({ ...period, view });
    const response = await client.request.get(`${baseUrl}${reports}?${query}`);
    assert.equal(response.status(), 200, `Chargement de ${view}`);
    return (await response.json() as { report: StatisticsReport }).report;
  }

  const anonymous = await fetch(url);
  assert.equal(anonymous.status, 401);
  assert.equal((await reader.request.get(`${baseUrl}${sales}`)).status(), 403);
  assert.equal((await reader.request.post(`${baseUrl}${sales}`, { data: {} })).status(), 403);
  assert.equal((await writer.request.get(`${baseUrl}${reports}?view=overview&from=2026-02-30&to=${today}`)).status(), 400);
  const privateData = await readReport("commercial", reader);
  assert.equal(privateData.metrics.find(metric => metric.label === "CA total")?.value, null);
  assert.equal(privateData.canRecordSales, false);
  const found = await writer.request.get(`${baseUrl}${sales}?q=${encodeURIComponent(runId)}`);
  assert.equal(found.status(), 200);
  const matches = await found.json() as { properties: { id: string }[] };
  assert(matches.properties.some(row => row.id === propertyId), "Recherche du bien vendu par référence de recette");
  const contactReport = await readReport("contacts");
  assert.equal(typeof contactReport.metrics.find(row => row.label === "Temps moyen de réponse")?.value, "number");
  record("Statistiques · Droits", "API sans session refusée, registre protégé, montant masqué en lecture seule et date invalide rejetée");

  const page = await writer.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${baseUrl}${statisticsHref("commercial", period, adminId)}`);
  await expect(page.getByRole("heading", { name: "Performance commerciale", exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Saisir une vente", exact: true }).click({ timeout: 60_000 });
  const dialog = page.getByRole("dialog", { name: "Saisir une vente actée" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Rechercher un bien vendu").fill(runId);
  await dialog.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(dialog.getByRole("option", { name: new RegExp(title) })).toBeAttached();
  await dialog.getByRole("combobox", { name: "Bien vendu", exact: true }).selectOption(propertyId);
  await dialog.getByLabel("Prix signé (€)").fill("380000");
  await dialog.getByLabel("Honoraires HT (€)").fill("15000");
  await dialog.getByRole("button", { name: "Enregistrer la vente" }).click();
  await expect(page.getByText("Vente enregistrée.", { exact: false })).toBeVisible({ timeout: 60_000 });
  const after = await writer.request.get(url);
  assert.equal(after.status(), 200);
  const finance = (await after.json() as { report: StatisticsReport }).report;
  assert.equal(finance.metrics.find(row => row.label === "CA total")?.value, 15_000);
  assert.equal(finance.metrics.find(row => row.label === "Délai moyen de vente")?.value, 40);
  const exportResponse = await writer.request.get(`${url}&format=csv`);
  assert.equal(exportResponse.status(), 200);
  assert(exportResponse.headers()["content-type"]?.includes("text/csv"));
  const csv = await exportResponse.text();
  assert(csv.includes("15000") && csv.includes(title));
  const body = { propertyId, advisorId: adminId, signedOn: today, price: 380_000, fee: 15_000, expected: null };
  const post = (data: typeof body) => writer.request.post(`${baseUrl}${sales}`, { data });
  assert.equal((await post(body)).status(), 200);
  assert.equal((await post({ ...body, fee: 16_000 })).status(), 409);
  record("Statistiques · Vente et export", "Acte saisi depuis le formulaire, honoraires et délai recalculés, CSV filtré, répétition acceptée et écriture concurrente refusée");

  const navigation = page.getByRole("navigation", { name: "Rapports statistiques" });
  await expect(navigation.getByRole("link")).toHaveCount(10);
  for (const { id, title: label } of statisticsViews) {
    const tab = navigation.getByRole("link", { name: id === "web" ? "Analyse site (GA4)" : label, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-current", "page", { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: id === "overview" ? "Statistiques" : label, exact: true })).toBeVisible();
    const result = await readReport(id);
    assert.equal(result.view, id);
    assert(result.blocks.length > 0);
  }
  await expect(page.getByText("Google Analytics à connecter")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Search Console à connecter")).toBeVisible();
  await page.getByRole("button", { name: "Conversions", exact: true }).click();
  await expect(page.getByRole("button", { name: "Conversions", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Semaine", exact: true }).click();
  await expect(page.getByRole("button", { name: "Semaine", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("from")).toBe(statisticsPeriod("week", today).from);
  await navigation.getByRole("link", { name: "Vue générale", exact: true }).click();
  await expect(page.getByText("Évolution des contacts", { exact: true })).toBeVisible({ timeout: 60_000 });
  const donut = await page.locator('[data-stat-chart="donut"]').boundingBox();
  assert(donut && Math.abs(donut.width - donut.height) < 1, "Le graphique circulaire garde son format");
  assert(await page.locator('[data-stat-chart="bar"]').evaluateAll(bars =>
    bars.some(bar => bar.getBoundingClientRect().height > 0 && bar.getBoundingClientRect().width > 20)), "Les valeurs positives affichent une barre");
  const screenshotDir = join(process.cwd(), "work", "statistics-qa");
  mkdirSync(screenshotDir, { recursive: true });
  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    const root = page.getByRole("region", { name: "Statistiques", exact: true });
    await expect(root).toBeVisible();
    if (width < 768) await expect(root.getByLabel("Rapport", { exact: true })).toBeVisible();
    assert(await root.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `Débordement du rapport à ${width} px`);
    if (width === 390 || width === 1440) await page.screenshot({ path: join(screenshotDir, `${runId}-${width}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []);
  await page.close();
  record("Statistiques · Interface", "Dix rapports, filtres, états GA4 et Search Console, navigation et sept largeurs sans débordement");

  const agent = await supabase.from("profiles").update({ role: "AGENT" }).eq("id", readerId);
  assert.ifError(agent.error);
  assert.equal((await reader.request.get(url)).status(), 403);
  const personal = await readReport("overview", reader);
  assert.equal(personal.selectedAdvisor, readerId);
  assert.equal(personal.metrics.find(row => row.label === "Nouveaux contacts")?.value, 0);
  assert.equal(personal.metrics.find(row => row.label === "Ventes")?.value, 0);
  record("Statistiques · Périmètre agent", "Les contacts et ventes de l’administrateur restent hors du rapport de l’agent");
}

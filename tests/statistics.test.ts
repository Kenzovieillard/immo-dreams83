import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { buildCrmStatistics } from "../src/lib/statistics-crm";
import type { StatisticsData } from "../src/lib/statistics-data";
import {
  comparisonPeriod, inStatisticsPeriod, rate, statisticsCsv, statisticsPeriod, validStatisticsPeriod,
  type StatisticsReport, type StatisticsView,
} from "../src/lib/statistics";
import { loadWebStatistics } from "../src/lib/statistics-web";

const owner = "agent-a";
const second = "agent-b";
const period = { from: "2026-11-01", to: "2026-11-20" };
const now = new Date("2026-11-20T13:00:00Z");
const advisors = [{ id: owner, label: "Claire", active: true }, { id: second, label: "Nicolas", active: true }];
const empty: StatisticsData = {
  contacts: [], estimates: [], properties: [], leads: [], visits: [], offers: [], mandates: [], tasks: [], interactions: [], searches: [], profiles: [], sales: [],
};
const primary: StatisticsData["contacts"][number] = {
  id: "a", created_at: "2026-11-03T08:00:00Z", assigned_to: owner, archived: false, canonical_contact_id: null, city: "Fréjus",
  contact_source: "WEBSITE", qualification_status: "QUALIFIED", qualified_at: "2026-11-03T10:00:00Z", last_contacted_at: "2026-11-15T10:00:00Z", status: "CONTACTED",
};
const property: StatisticsData["properties"][number] = {
  id: "p", title: "=Bien", reference: "101", created_at: "2026-10-01T10:00:00Z", advisor_id: owner, city: "Fréjus",
  commercial_status: "SOLD", status: "sold", publication_status: "UNPUBLISHED", published_at: "2026-10-01T10:00:00Z",
  unpublished_at: "2026-11-10T14:00:00Z", archived_at: null, transaction_type: "sale", price: 700_000, type: "house",
};
const visit: StatisticsData["visits"][number] = {
  id: "first", assigned_to: owner, contact_id: primary.id, property_id: property.id, lead_id: null,
  starts_at: "2026-10-22T12:00:00Z", visit_status: "COMPLETED", title: "Visite",
};
const data: StatisticsData = {
  ...empty,
  contacts: [primary, { ...primary, id: "b", assigned_to: second, qualified_at: null, last_contacted_at: null, contact_source: "LEGACY_IMPORT" }],
  properties: [property, { ...property, id: "p2", advisor_id: second }],
  sales: [{ advisor_id: owner, property_id: property.id, signed_on: "2026-11-10", sale_price: 680_000, fee_excl_tax: 32_000 },
    { advisor_id: second, property_id: "p2", signed_on: "2026-10-25", sale_price: 400_000, fee_excl_tax: 18_000 }],
  visits: [visit, { ...visit, id: "second", starts_at: "2026-11-08T10:00:00Z" }, { ...visit, id: "cancelled", starts_at: "2026-11-12T10:00:00Z", visit_status: "CANCELLED" }],
  offers: [{
    id: "offer", responsible_user_id: owner, created_from_visit_id: "second", property_id: property.id, buyer_contact_id: primary.id,
    created_at: "2026-11-09T09:00:00Z", offered_at: "2026-11-09T09:00:00Z", accepted_at: "2026-11-10T09:00:00Z", status: "ACCEPTED",
  }],
  interactions: [
    { contact_id: primary.id, created_at: "2026-11-04T09:00:00Z" },
    { contact_id: primary.id, created_at: "2026-11-03T09:30:00Z" },
    { contact_id: primary.id, created_at: "2026-11-02T09:00:00Z" },
  ],
};

function report(view: Exclude<StatisticsView, "web">, rows = data, selectedAdvisor: string | null = null, offersVisible = true) {
  return buildCrmStatistics(rows, { view, period, now, advisors, selectedAdvisor, team: true, canRecordSales: true, offersVisible });
}
function value(report: StatisticsReport, label: string) {
  const metric = report.metrics.find(row => row.label === label);
  assert(metric, `Indicateur absent : ${label}`);
  return metric.value;
}

test("dates inclusives en heure de Paris, périodes calendaires et comparaison", () => {
  const month = statisticsPeriod("month", "2026-11-20");
  assert.deepEqual(month, period);
  assert.deepEqual(statisticsPeriod("quarter", "2026-11-20"), { from: "2026-10-01", to: "2026-11-20" });
  assert.deepEqual(statisticsPeriod("week", "2026-11-22"), { from: "2026-11-16", to: "2026-11-22" });
  assert.deepEqual(comparisonPeriod(period), { from: "2026-10-12", to: "2026-10-31" });
  assert.equal(inStatisticsPeriod("2026-10-31T23:00:00Z", period), true);
  assert.equal(inStatisticsPeriod("2026-11-20T23:00:00Z", period), false);
  assert.equal(validStatisticsPeriod({ from: "2026-02-30", to: period.to }, period.to), false);
  assert.equal(validStatisticsPeriod({ from: "2025-11-01", to: period.to }, period.to), false);
  assert.equal(rate(0, 0), null);
  assert.equal(rate(0, 2), 0);
});

test("les ventes et honoraires suivent l’acte signé et le périmètre du conseiller", () => {
  assert.equal(value(report("overview"), "Ventes"), 1);
  assert.equal(value(report("commercial"), "CA total"), 32_000);
  assert.equal(value(report("commercial"), "Délai moyen de vente"), 40);
  assert.equal(value(report("commercial", data, second), "CA total"), 0);
  assert.equal(value(report("commercial", { ...data, sales: null }, null, false), "CA total"), null);
  assert.equal(value(report("overview", data, owner), "Nouveaux contacts"), 1);
  assert.equal(value(report("contacts"), "Taux de qualification"), 50);
  assert.equal(value(report("contacts"), "Temps moyen de réponse"), 1.5);
  assert.equal(value(report("visits"), "Visites sur la période"), 1);
  assert.equal(value(report("visits"), "Taux de 2e visite"), 100);
  assert.equal(value(report("visits"), "Visites → offre"), 100);
});

test("les neuf rapports CRM expliquent les données absentes et le CSV neutralise les formules", () => {
  for (const view of ["overview", "commercial", "advisors", "contacts", "pipeline", "estimates", "visits", "properties", "alerts"] as const) {
    const result = report(view, empty);
    assert(result.metrics.length >= 4);
    assert(result.blocks.length > 0);
    assert(result.metrics.every(row => row.value === null || Number.isFinite(row.value)));
  }
  assert.equal(value(report("contacts", empty), "Taux de qualification"), null);
  assert.equal(value(report("properties", empty), "Prix moyen"), null);
  const csv = statisticsCsv(report("commercial"));
  assert(csv.startsWith("\uFEFF"));
  assert(csv.includes('"\'=Bien"'));
});

test("GA4 et Search Console fournissent leurs métriques et peuvent tomber en panne séparément", async (t) => {
  for (const key of ["CRM_GA4_PROPERTY_ID", "CRM_SEARCH_CONSOLE_SITE", "CRM_GOOGLE_SERVICE_ACCOUNT_EMAIL", "CRM_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"]) {
    const previous = process.env[key];
    delete process.env[key];
    t.after(() => { if (previous !== undefined) process.env[key] = previous; else delete process.env[key]; });
  }
  const disconnected = await loadWebStatistics(period, "all", now);
  assert.deepEqual(disconnected.blocks.map(block => block.title), ["Google Analytics à connecter", "Search Console à connecter"]);
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  process.env.CRM_GA4_PROPERTY_ID = "123";
  process.env.CRM_SEARCH_CONSOLE_SITE = "sc-domain:example.test";
  process.env.CRM_GOOGLE_SERVICE_ACCOUNT_EMAIL = "test@example.test";
  process.env.CRM_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
  let searchFails = false;
  const json = (body: unknown) => Response.json(body);
  t.mock.method(globalThis, "fetch", async (url: string, request: RequestInit) => {
    if (url.includes("oauth2.googleapis.com")) return json({ access_token: "test-token" });
    assert.equal(new Headers(request.headers).get("authorization"), "Bearer test-token");
    if (url.includes("searchAnalytics")) return searchFails ? new Response(null, { status: 403 }) : json({ rows: [{ keys: ["agence"], clicks: 3, impressions: 15, ctr: 0.2, position: 4.5 }] });
    const input = JSON.parse(String(request.body)) as { requests: { dimensions: { name: string }[]; metrics: { name: string }[]; dateRanges: { startDate: string }[] }[] };
    assert(input.requests.length <= 5);
    return json({ reports: input.requests.map(({ dimensions, metrics, dateRanges }) => {
      const values = dimensions.length ? metrics.map(() => "5") : [dateRanges[0].startDate === period.from ? "50" : "25", "25", "3.4", "0.42", "155", "6"];
      return { rows: [{ dimensionValues: [{ value: dimensions[0]?.name === "date" ? "20261103" : "exemple" }], metricValues: values.map(value => ({ value })) }] };
    }) });
  });
  const web = await loadWebStatistics(period, "all", now);
  assert.equal(value(web, "Sessions"), 50);
  assert.equal(value(web, "Taux de rebond"), 42);
  assert(web.blocks.some(block => block.title === "Mots-clés organiques (SEO)" && block.kind === "table" && block.rows.length === 1));
  searchFails = true;
  const partial = await loadWebStatistics(period, "acquisition", now);
  assert.equal(value(partial, "Sessions"), 50);
  assert(partial.blocks.some(block => block.title === "Search Console indisponible"));
  assert(!partial.blocks.some(block => block.title === "Conversions par type"));
});

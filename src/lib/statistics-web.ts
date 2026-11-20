import "server-only";

import { sign } from "node:crypto";
import {
  comparisonPeriod, formatStatistic, periodLength, relativeChange,
  type Figure, type StatisticsBlock, type StatisticsMetric, type StatisticsPeriod, type StatisticsReport, type Unit, type WebSegment,
} from "./statistics";

const tokenUrl = "https://oauth2.googleapis.com/token";
const analyticsScope = "https://www.googleapis.com/auth/analytics.readonly";
const searchScope = "https://www.googleapis.com/auth/webmasters.readonly";

type GoogleReport = {
  rows?: {
    dimensionValues?: { value?: string }[];
    metricValues?: { value?: string }[];
  }[];
  metadata?: { subjectToThresholding?: boolean; dataLossFromOtherRow?: boolean };
};
type GoogleSearchReport = {
  rows?: { keys: string[]; impressions: number; clicks: number; position: number; ctr: number }[];
};
type GoogleAccount = { email: string; key: string };

function credentials(): GoogleAccount | null {
  const email = process.env.CRM_GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.CRM_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  return email && key ? { email, key: key.replaceAll("\\n", "\n") } : null;
}

const encode = (data: unknown) => Buffer.from(JSON.stringify(data), "utf8").toString("base64url");

async function accessToken(account: GoogleAccount, scope: string) {
  const iat = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "RS256", typ: "JWT" });
  const claims = encode({ iss: account.email, scope, aud: tokenUrl, iat, exp: iat + 300 });
  const payload = `${header}.${claims}`;
  const signature = sign("RSA-SHA256", Buffer.from(payload), account.key).toString("base64url");
  const response = await fetch(tokenUrl, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(6_000),
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${payload}.${signature}` }),
  });
  if (!response.ok) throw new Error(`OAuth Google (${response.status})`);
  const { access_token: token } = await response.json() as { access_token?: string };
  if (!token) throw new Error("Jeton Google absent");
  return token;
}

async function googlePost<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`API Google (${response.status})`);
  return response.json() as Promise<T>;
}

const range = ({ from, to }: StatisticsPeriod) => ({ startDate: from, endDate: to });
const dimension = (name: string) => ({ name });
const numeric = (value: string | undefined): Figure => value && Number.isFinite(Number(value)) ? Number(value) : null;
const metricValue = (row: NonNullable<GoogleReport["rows"]>[number] | undefined, index: number) => numeric(row?.metricValues?.[index]?.value);
const channels: Record<string, string> = { "Organic Search": "Recherche organique", Direct: "Accès direct", Referral: "Sites référents", "Organic Social": "Réseaux sociaux", Email: "E-mail", "Paid Search": "Recherche payante", Unassigned: "Non attribué" };
const devices: Record<string, string> = { desktop: "Ordinateur", mobile: "Mobile", tablet: "Tablette" };

function webChart(report: GoogleReport, title: string, kind: "line" | "bar" | "donut" | "columns", series: string[], transform = (value: string) => value): StatisticsBlock {
  return {
    kind, title, series,
    points: (report.rows ?? []).map(row => ({
      label: transform(row.dimensionValues?.[0]?.value || "Non renseigné"),
      values: series.map((_, i) => metricValue(row, i)),
    })),
    note: report.metadata?.subjectToThresholding || report.metadata?.dataLossFromOtherRow ? "Les seuils de confidentialité ou de cardinalité de GA4 limitent le détail." : undefined,
  };
}

function axisLabel(value: string) {
  if (/^\d{8}$/.test(value)) return `${value.slice(6, 8)}/${value.slice(4, 6)}`;
  if (/^\d{6}$/.test(value)) return `${value.slice(4)}/${value.slice(0, 4)}`;
  return value;
}

async function analytics(account: GoogleAccount, property: string, period: StatisticsPeriod, segment: WebSegment) {
  const token = await accessToken(account, analyticsScope);
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${property}:batchRunReports`;
  const timeframe = periodLength(period) <= 31 ? "date" : "yearMonth";
  const summary = ["sessions", "totalUsers", "screenPageViewsPerSession", "bounceRate", "averageSessionDuration", "keyEvents"];
  const schema = (dimensions: string[], metrics: string[], limit: number, byCount = false) => ({
    dateRanges: [range(period)],
    dimensions: dimensions.map(dimension), metrics: metrics.map(dimension), limit: String(limit),
    ...(dimensions[0] ? { orderBys: [byCount ? { metric: { metricName: metrics[0] }, desc: true } : { dimension: { dimensionName: dimensions[0] } }] } : {}),
  });
  const batch = async (requests: unknown[]) => {
    const { reports } = await googlePost<{ reports: GoogleReport[] }>(endpoint, token, { requests });
    if (!Array.isArray(reports) || reports.length !== requests.length) throw new Error("Réponse Analytics incomplète");
    return reports;
  };
  const total = schema([], summary, 1);
  const [[current, previous, traffic, sources, pages], [events, deviceRows]] = await Promise.all([
    batch([total, { ...total, dateRanges: [range(comparisonPeriod(period))] },
      schema([timeframe], ["sessions", "totalUsers"], 40),
      schema(["sessionDefaultChannelGroup"], ["sessions"], 24, true),
      schema(["pagePath"], ["screenPageViews"], 10, true)]),
    batch([schema(["eventName"], ["keyEvents"], 50, true), schema(["deviceCategory"], ["sessions", "bounceRate", "keyEvents"], 10, true)]),
  ]);
  const units: Unit[] = ["count", "count", "decimal", "percent", "seconds", "count"];
  const labels = ["Sessions", "Utilisateurs uniques", "Pages par session", "Taux de rebond", "Durée moy. session", "Conversions"];
  const labelsWithNotes: Record<number, string> = { 1: "Utilisateurs distincts selon GA4.", 5: "Événements clés configurés dans GA4." };
  const metrics = labels.map((label, index): StatisticsMetric => {
    const hasData = Boolean(current.rows?.length);
    const hasBefore = Boolean(previous.rows?.length);
    const val = metricValue(current.rows?.[0], index), old = metricValue(previous.rows?.[0], index);
    const value = index === 3 && val !== null ? val * 100 : val ?? (!hasData && [0, 1, 5].includes(index) ? 0 : null);
    const before = index === 3 && old !== null ? old * 100 : old ?? (!hasBefore && [0, 1, 5].includes(index) ? 0 : null);
    return { label, value, unit: units[index], change: relativeChange(value, before, index === 3), note: labelsWithNotes[index] };
  });
  const acquisition = [
    webChart(traffic, "Trafic du site", "line", ["Sessions", "Utilisateurs"], axisLabel),
    webChart(sources, "Sources de trafic", "donut", ["Sessions"], label => channels[label] ?? label),
    webChart(pages, "Pages les plus visitées", "bar", ["Pages vues"]),
  ];
  const conversion = webChart({ ...events, rows: events.rows?.filter(row => (metricValue(row, 0) ?? 0) > 0) }, "Conversions par type", "columns", ["Événements clés"]);
  const performance: StatisticsBlock = {
    kind: "table", title: "Performance mobile vs desktop", columns: ["Appareil", "Sessions", "Taux de rebond", "Conversions"],
    rows: (deviceRows.rows ?? []).map(row => {
      const label = row.dimensionValues?.[0]?.value ?? "Non renseigné";
      const bounce = metricValue(row, 1);
      return { cells: [devices[label] ?? label, metricValue(row, 0), formatStatistic(bounce === null ? null : bounce * 100, "percent"), metricValue(row, 2)] };
    }),
  };
  return { metrics, blocks: segment === "acquisition" ? [...acquisition, performance] : segment === "conversions" ? [conversion, performance] : [...acquisition, conversion, performance] };
}

async function organicSearch(account: GoogleAccount, property: string, period: StatisticsPeriod): Promise<StatisticsBlock> {
  const token = await accessToken(account, searchScope);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const data = await googlePost<GoogleSearchReport>(endpoint, token, { ...range(period), dimensions: ["query"], rowLimit: 20, type: "web", dataState: "final" });
  return {
    kind: "table", title: "Mots-clés organiques (SEO)", columns: ["Mot-clé", "Impressions", "Clics", "Pos. moy.", "CTR"],
    rows: (data.rows ?? []).map(row => ({ cells: [row.keys[0], row.impressions, row.clicks, formatStatistic(row.position, "decimal"), formatStatistic(row.ctr * 100, "percent")] })),
    note: "Requêtes principales · données finalisées par Google Search Console.",
  };
}

export async function loadWebStatistics(period: StatisticsPeriod, segment: WebSegment, now: Date): Promise<StatisticsReport> {
  const account = credentials();
  const property = process.env.CRM_GA4_PROPERTY_ID?.trim() ?? "";
  const searchProperty = process.env.CRM_SEARCH_CONSOLE_SITE?.trim();
  const canLoadAnalytics = account && /^\d+$/.test(property);
  const canLoadSearch = account && searchProperty;
  const [ga4, seo] = await Promise.allSettled([
    canLoadAnalytics ? analytics(account, property, period, segment) : Promise.resolve(null),
    canLoadSearch && segment !== "conversions" ? organicSearch(account, searchProperty, period) : Promise.resolve(null),
  ]);
  const metrics = ga4.status === "fulfilled" && ga4.value ? ga4.value.metrics : [];
  const blocks: StatisticsBlock[] = ga4.status === "fulfilled" && ga4.value ? [...ga4.value.blocks] : [{
    kind: "notice", title: ga4.status === "rejected" ? "Google Analytics indisponible" : "Google Analytics à connecter", wide: true,
    note: ga4.status === "rejected" ? "Vérifiez la propriété GA4, l’activation de l’API et le droit de lecture du compte de service." : "Configurez la propriété GA4 et le compte de service pour afficher les données d’audience.",
  }];
  if (segment !== "conversions") {
    if (seo.status === "fulfilled" && seo.value) blocks.splice(Math.max(0, blocks.length - 1), 0, seo.value);
    else blocks.push({
      kind: "notice", title: seo.status === "rejected" ? "Search Console indisponible" : "Search Console à connecter",
      note: seo.status === "rejected" ? "Vérifiez le site déclaré et les droits de lecture du compte de service." : "Reliez la propriété Search Console pour afficher les requêtes, clics et impressions.",
    });
  }
  return {
    view: "web", period, comparison: comparisonPeriod(period), generatedAt: now.toISOString(), source: "Google Analytics 4 · Google Search Console",
    metrics, blocks, advisors: [], selectedAdvisor: null, team: false, canRecordSales: false,
  };
}

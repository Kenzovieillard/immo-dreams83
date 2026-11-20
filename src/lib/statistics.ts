import { dayDate, parisDay, shiftAgendaDay, validAgendaDay, weekStart } from "./agenda-time";

export const statisticsViews = [
  { id: "overview", title: "Vue générale", subtitle: "Performance de l’agence" },
  { id: "commercial", title: "Performance commerciale", subtitle: "Résultats des ventes et honoraires déclarés" },
  { id: "advisors", title: "Performance vendeurs", subtitle: "Comparatif et répartition de l’équipe commerciale" },
  { id: "contacts", title: "Analyse contacts", subtitle: "Acquisition, sources et qualification des prospects" },
  { id: "pipeline", title: "Analyse pipeline", subtitle: "Portefeuille de biens et rotation des mandats" },
  { id: "estimates", title: "Analyse estimations", subtitle: "Suivi des demandes, évaluations et mandats" },
  { id: "visits", title: "Analyse visites", subtitle: "Activité terrain de l’équipe" },
  { id: "properties", title: "Analyse biens", subtitle: "Portefeuille immobilier et durée de commercialisation" },
  { id: "alerts", title: "Points à surveiller", subtitle: "Alertes, relances et opportunités" },
  { id: "web", title: "Analyse site web", subtitle: "Audience Google Analytics 4 et recherche Google" },
] as const;

export type StatisticsView = (typeof statisticsViews)[number]["id"];
export type StatisticsPeriod = { from: string; to: string };
export const statisticsPresets = [
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "quarter", label: "Trimestre" },
  { id: "year", label: "Année" },
  { id: "custom", label: "Personnalisé" },
] as const;
export type StatisticsPreset = (typeof statisticsPresets)[number]["id"];
export const webSegments = ["all", "acquisition", "conversions"] as const;
export type WebSegment = (typeof webSegments)[number];

export type Figure = number | null;
export type Unit = "count" | "currency" | "percent" | "days" | "hours" | "seconds" | "decimal";
export type StatisticsMetric = { label: string; value: Figure; unit?: Unit; note?: string; change?: string };
export type StatisticsCell = string | number | null;
export type StatisticsRow = { cells: StatisticsCell[]; href?: string };
export type StatisticAction = { label: string; href: string };
export type StatisticAlert = { label: string; detail: string; level: "critical" | "moderate" | "opportunity"; action: StatisticAction };
export type ChartPoint = { label: string; values: Figure[] };
export type ChartBlock = {
  kind: "bar" | "columns" | "donut" | "line" | "heatmap";
  title: string;
  points: ChartPoint[];
  series: string[];
  unit?: Unit;
  note?: string;
  wide?: boolean;
};
export type StatisticsBlock = ChartBlock | {
  kind: "table";
  title: string;
  columns: string[];
  rows: StatisticsRow[];
  note?: string;
  wide?: boolean;
} | {
  kind: "alerts";
  title: string;
  alerts: StatisticAlert[];
  note?: string;
  wide?: boolean;
} | {
  kind: "notice";
  title: string;
  note: string;
  wide?: boolean;
};
export type StatisticsAdvisor = { id: string; label: string; active: boolean };
export type StatisticsReport = {
  view: StatisticsView;
  period: StatisticsPeriod;
  comparison: StatisticsPeriod;
  generatedAt: string;
  source: string;
  metrics: StatisticsMetric[];
  blocks: StatisticsBlock[];
  advisors: StatisticsAdvisor[];
  selectedAdvisor: string | null;
  team: boolean;
  canRecordSales: boolean;
  action?: StatisticAction;
};

export function statisticsView(value: string | null | undefined): StatisticsView {
  return statisticsViews.find(({ id }) => id === value)?.id ?? "overview";
}

export function statisticsPeriod(preset: StatisticsPreset, today = parisDay()): StatisticsPeriod {
  const year = today.slice(0, 4);
  const month = Number(today.slice(5, 7));
  const quarterStart = String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0");
  const from = {
    week: weekStart(today),
    month: `${today.slice(0, 7)}-01`,
    quarter: `${year}-${quarterStart}-01`,
    year: `${year}-01-01`,
    custom: `${today.slice(0, 7)}-01`,
  }[preset];
  return { from, to: today };
}

export const dayDifference = (from: string, to: string) => (+dayDate(to) - +dayDate(from)) / 86_400_000;
export const periodLength = ({ from, to }: StatisticsPeriod) => dayDifference(from, to) + 1;
export const reportDay = (date: string) => date.length === 10 ? date : parisDay(date);

export function validStatisticsPeriod(period: StatisticsPeriod, today = parisDay()) {
  return validAgendaDay(period.from) && validAgendaDay(period.to)
    && period.from >= "2000-01-01" && period.from <= period.to
    && period.to <= today && periodLength(period) <= 366;
}

export function comparisonPeriod(period: StatisticsPeriod): StatisticsPeriod {
  return { from: shiftAgendaDay(period.from, -periodLength(period)), to: shiftAgendaDay(period.from, -1) };
}

export function inStatisticsPeriod(date: string | null, period: StatisticsPeriod) {
  if (!date) return false;
  const day = reportDay(date);
  return day >= period.from && day <= period.to;
}

export const rate = (count: number, total: number) => total ? count * 100 / total : null;
export const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const countFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const currencyFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatStatistic(value: Figure, unit: Unit = "count"): string {
  if (value === null) return "—";
  const decimal = numberFormat.format(value);
  if (unit === "currency") return currencyFormat.format(value);
  if (unit === "percent") return `${decimal} %`;
  if (unit === "days") return `${decimal} j`;
  if (unit === "hours") return value < 1 ? `${countFormat.format(value * 60)} min` : `${decimal} h`;
  if (unit === "seconds") return `${Math.floor(value / 60)} min ${Math.floor(value % 60)} s`;
  return unit === "decimal" ? decimal : countFormat.format(value);
}

export const formatStatisticsDate = (date: string) => dateFormat.format(dayDate(reportDay(date)));

export function relativeChange(current: Figure, previous: Figure, points = false) {
  if (current === null || previous === null || (!points && !previous)) return undefined;
  const difference = points ? current - previous : (current - previous) / previous * 100;
  const rounded = Math.round(difference * 10) / 10;
  if (!rounded) return "Stable vs période précédente";
  return `${rounded > 0 ? "+" : "−"}${numberFormat.format(Math.abs(rounded))} ${points ? "pts" : "%"} vs période précédente`;
}

export function statisticsHref(view: StatisticsView, period?: StatisticsPeriod, advisor?: string | null, segment?: WebSegment) {
  const query = new URLSearchParams({ tab: "statistics", report: view });
  if (period) { query.set("from", period.from); query.set("to", period.to); }
  if (advisor && view !== "web") query.set("advisor", advisor);
  if (segment && segment !== "all") query.set("segment", segment);
  return `/admin?${query}`;
}

export function statisticsCsv(report: StatisticsReport) {
  const rows: StatisticsCell[][] = [
    ["Rapport", statisticsViews.find(({ id }) => id === report.view)?.title ?? report.view],
    ["Période", report.period.from, report.period.to],
    ["Période de comparaison", report.comparison.from, report.comparison.to],
    ["Source", report.source],
    ["Généré le", report.generatedAt],
    ["Périmètre", report.advisors.find(({ id }) => id === report.selectedAdvisor)?.label ?? (report.view === "web" ? "Site" : "Agence")],
    [],
    ["Indicateur", "Valeur", "Unité", "Évolution", "Définition"],
    ...report.metrics.map((metric) => [metric.label, metric.value, metric.unit ?? "count", metric.change ?? "", metric.note ?? ""]),
  ];
  for (const block of report.blocks) {
    rows.push([], [block.title, block.note ?? ""]);
    if ("points" in block) rows.push(["Libellé", ...block.series], ...block.points.map(({ label, values }) => [label, ...values]));
    if ("rows" in block) rows.push(block.columns, ...block.rows.map(({ cells }) => cells));
    if ("alerts" in block) rows.push(["Alerte", "Détail", "Niveau", "Action"], ...block.alerts.map((alert) => [alert.label, alert.detail, alert.level, alert.action.label]));
  }
  return "\uFEFF" + rows.map((row) => row.map((value) => {
    if (typeof value === "number") return String(value).replace(".", ",");
    const cell = value ?? "";
    const safe = /^\s*[=+\-@\t\r\n]/.test(cell) ? "'" + cell : cell;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(";")).join("\r\n");
}

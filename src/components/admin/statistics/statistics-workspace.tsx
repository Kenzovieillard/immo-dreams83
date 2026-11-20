"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BarChart3, CalendarDays, Download, Plus, UsersRound, Wallet } from "lucide-react";
import { BentoGrid } from "@/components/admin/bento/bento-grid";
import { BentoKpiCard } from "@/components/admin/bento/bento-kpi-card";
import { BentoCardSkeleton, BentoErrorState } from "@/components/admin/bento/bento-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parisDay } from "@/lib/agenda-time";
import {
  formatStatistic, formatStatisticsDate, statisticsHref, statisticsPeriod, statisticsPresets, statisticsView, statisticsViews,
  validStatisticsPeriod, webSegments, type StatisticsPeriod, type StatisticsPreset, type StatisticsReport, type WebSegment,
} from "@/lib/statistics";
import { StatisticsPanel } from "./statistics-charts";
import { StatisticsSaleDialog } from "./statistics-sale-dialog";
import styles from "./statistics.module.css";

const endpoint = "/api/admin/statistics";
const field = "min-h-10 w-full rounded-lg border border-[#dedfd4] bg-[#fbfaf7] px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#2f493a]";
const actions = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#dedfd4] bg-[#fbfaf7] px-3 py-2 text-sm font-semibold text-[#2f493a] hover:bg-[#e8ebe2] focus-visible:outline-2";
const segmentLabels: Record<WebSegment, string> = { all: "Tout le site", acquisition: "Acquisition", conversions: "Conversions" };

function useStatisticsFilters() {
  const q = useSearchParams();
  const view = statisticsView(q.get("report"));
  const advisor = q.get("advisor");
  const initial = statisticsPeriod("month");
  const draft = { from: q.get("from") ?? initial.from, to: q.get("to") ?? initial.to };
  const period = validStatisticsPeriod(draft) ? draft : initial;
  const segment = webSegments.find(key => key === q.get("segment")) ?? "all";
  return { view, period, advisor, segment };
}

export function StatisticsSidebarLinks() {
  const { view, period, advisor, segment } = useStatisticsFilters();
  return <nav aria-label="Rapports statistiques" className="grid gap-0.5 pb-2 pl-5">
    {statisticsViews.map(({ id, title }) => <Link key={id} href={statisticsHref(id, period, advisor, segment)} scroll={false}
      aria-current={view === id ? "page" : undefined}
      className={cn("rounded-md px-2.5 py-1.5 text-xs leading-5 focus-visible:outline-2 focus-visible:outline-white", view === id ? "bg-[#2f493a] font-semibold text-white" : "text-[#cbd5e1] hover:bg-white/8 hover:text-white")}>
      {id === "web" ? "Analyse site (GA4)" : title}
    </Link>)}
  </nav>;
}

function PeriodControls({ period, onApply }: { period: StatisticsPeriod; onApply: (period: StatisticsPeriod) => void }) {
  const matched = statisticsPresets.find(({ id }) => id !== "custom" && (() => {
    const candidate = statisticsPeriod(id);
    return period.from === candidate.from && period.to === candidate.to;
  })())?.id;
  const [preset, setPreset] = useState<StatisticsPreset>(matched ?? "custom");
  const [draft, setDraft] = useState(period);
  const [error, setError] = useState("");
  const today = parisDay();

  function changePeriod(id: StatisticsPreset) {
    setPreset(id);
    setError("");
    if (id === "custom") return;
    const selection = statisticsPeriod(id);
    setDraft(selection);
    onApply(selection);
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validStatisticsPeriod(draft)) {
      setError("Choisissez une période valide de 366 jours maximum, jusqu’à aujourd’hui.");
      return;
    }
    setError("");
    onApply(draft);
  }

  return <div className="grid min-w-0 gap-3">
    <div role="group" aria-label="Préréglages de période" className="flex flex-wrap gap-x-4 gap-y-1">
      {statisticsPresets.map(({ id, label }) => <button type="button" key={id} aria-pressed={preset === id} onClick={() => changePeriod(id)}
        className={cn("min-h-9 border-b-2 px-0.5 text-sm focus-visible:rounded-sm focus-visible:outline-2", preset === id ? "border-[#2f493a] font-bold text-[#233d2f]" : "border-transparent text-[#58675e] hover:text-[#233d2f]")}>{label}</button>)}
    </div>
    <form onSubmit={apply} className="flex flex-wrap items-end gap-2">
      <label className="grid min-w-0 gap-1 text-xs font-medium text-[#546259]">Date de début
        <Input className="h-10 min-w-0 border-[#dedfd4] bg-[#fbfaf7]" type="date" value={draft.from} min="2000-01-01" max={today} onChange={event => { setDraft({ ...draft, from: event.target.value }); setPreset("custom"); }} required />
      </label>
      <label className="grid min-w-0 gap-1 text-xs font-medium text-[#546259]">Date de fin
        <Input className="h-10 min-w-0 border-[#dedfd4] bg-[#fbfaf7]" type="date" value={draft.to} min="2000-01-01" max={today} onChange={event => { setDraft({ ...draft, to: event.target.value }); setPreset("custom"); }} required />
      </label>
      <Button type="submit" className="h-10 rounded-lg bg-[#2f493a] text-white hover:bg-[#243b2e]">Appliquer</Button>
      {error ? <p role="alert" className="w-full text-sm text-[#a2473e]">{error}</p> : null}
    </form>
  </div>;
}

const icons = [UsersRound, UsersRound, CalendarDays, Wallet, CalendarDays, BarChart3];
const reportDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

export function StatisticsWorkspace() {
  const router = useRouter();
  const { view, period, advisor, segment } = useStatisticsFilters();
  const selectedView = statisticsViews.find(({ id }) => id === view)!;
  const [attempt, setAttempt] = useState(0);
  const params = new URLSearchParams({ view, from: period.from, to: period.to });
  if (advisor && view !== "web") params.set("advisor", advisor);
  if (view === "web") params.set("segment", segment);
  const key = params.toString();
  const [result, setResult] = useState<{ key: string; attempt: number; report?: StatisticsReport; error?: string } | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const data = result?.key === key && result.attempt === attempt ? result : null;
  const report = data?.report;
  const advisorContext = report ?? result?.report;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${endpoint}?${key}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json() as { success?: boolean; report?: StatisticsReport; message?: string };
        if (!response.ok || !payload.success || !payload.report) throw new Error(payload.message ?? "Les statistiques sont indisponibles.");
        if (!controller.signal.aborted) setResult({ key, attempt, report: payload.report });
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, attempt, error: error instanceof Error ? error.message : "Les statistiques sont indisponibles." });
      });
    return () => controller.abort();
  }, [attempt, key]);

  const selectAdvisor = (id: string) => window.history.replaceState(null, "", statisticsHref(view, period, id, segment));
  const applyPeriod = (next: StatisticsPeriod) => window.history.replaceState(null, "", statisticsHref(view, next, advisor, segment));
  return <section className="grid min-w-0 gap-5 text-[var(--crm-riviera-text-primary)] sm:gap-7" aria-label="Statistiques">
    <div className="grid gap-2 md:hidden">
      <label htmlFor="statistics-view" className="text-xs font-medium text-[#546259]">Rapport</label>
      <select id="statistics-view" value={view} className={field} onChange={event => router.push(statisticsHref(statisticsView(event.target.value), period, advisor, segment), { scroll: false })}>
        {statisticsViews.map(({ id, title }) => <option value={id} key={id}>{title}</option>)}
      </select>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{view === "overview" ? "Statistiques" : selectedView.title}</h1>
        <p className="mt-1 text-sm text-[#58675e]">{selectedView.subtitle}</p>
      </div>
      {report ? <div className="flex flex-wrap gap-2">
        {report.action ? <Link href={report.action.href} className={actions}>{report.action.label}</Link> : null}
        {view === "commercial" && report.canRecordSales ? <Button type="button" variant="outline" className={actions} onClick={() => { setSaleOpen(true); setSaved(false); }}><Plus className="size-4" aria-hidden="true" />Saisir une vente</Button> : null}
        <a href={`${endpoint}?${key}&format=csv`} className={actions}>
          <Download className="size-4" aria-hidden="true" />
          {view === "web" ? "Exporter le rapport GA4" : view === "contacts" ? "Rapport démographique" : "Exporter le rapport"}
        </a>
      </div> : null}
    </div>
    {saved && view === "commercial" ? <p role="status" className="rounded-lg bg-[#e1eadd] px-3 py-2 text-sm text-[#2f493a]">Vente enregistrée. Les indicateurs ont été actualisés.</p> : null}
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dedfd4] pb-4">
      <PeriodControls key={`${period.from}:${period.to}`} period={period} onApply={applyPeriod} />
      <div className="grid min-w-0 gap-2">
        {view === "web" ? <div role="group" aria-label="Périmètre du site" className="flex flex-wrap gap-1">
          {webSegments.map(id => <button type="button" key={id} aria-pressed={segment === id} onClick={() => window.history.replaceState(null, "", statisticsHref("web", period, null, id))}
            className={cn("min-h-9 rounded-full px-3 text-xs font-medium focus-visible:outline-2", id === segment ? "bg-[#e3ebdf] font-semibold text-[#2f493a]" : "hover:bg-[#eceae2]")}>{segmentLabels[id]}</button>)}
        </div> : advisorContext?.team ? <div className="grid gap-1 text-xs font-medium text-[#546259]">
          <label htmlFor="statistics-advisor">Conseiller</label>
          <select id="statistics-advisor" className={field} value={advisor ?? ""} onChange={event => selectAdvisor(event.target.value)}>
            <option value="">{view === "advisors" ? "Équipe" : "Agence"}</option>
            {advisorContext.advisors.map(row => <option key={row.id} value={row.id}>{row.label}{row.active ? "" : " · inactif"}</option>)}
          </select>
        </div> : advisorContext?.selectedAdvisor ? <p className="text-xs font-semibold text-[#546259]">Mon portefeuille</p> : null}
        <div className="text-xs text-[#546259]">
          <p>Période affichée</p>
          <p className="mt-1 font-medium text-[#18211f]">{formatStatisticsDate(period.from)} – {formatStatisticsDate(period.to)}</p>
        </div>
      </div>
    </div>
    {!data ? <div role="status" className="grid gap-2"><p className="text-sm">Chargement des statistiques…</p><BentoCardSkeleton lines={4} /></div> : data.error ? (
      <div role="alert" className="grid justify-items-start gap-3">
        <BentoErrorState message={data.error} />
        <Button type="button" variant="outline" onClick={() => setAttempt(value => value + 1)}>Réessayer</Button>
      </div>
    ) : null}
    {report ? <>
      {report.metrics.length ? <div className={cn("grid grid-cols-1 gap-3 min-[375px]:grid-cols-2", report.metrics.length > 4 ? "xl:grid-cols-6" : "xl:grid-cols-4")}>
        {report.metrics.map((metric, index) => {
          const Icon = icons[index % icons.length];
          return <div key={metric.label} className="grid min-w-0 content-start gap-2 rounded-(--bento-card-radius) border border-[var(--bento-card-border)] bg-[var(--bento-card-background)] p-3 shadow-(--bento-card-shadow) sm:p-4">
            <div className="flex min-w-0 items-start justify-between gap-1.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#dce5d7] text-[#2f493a]"><Icon className="size-4" aria-hidden="true" /></span>
              {metric.change ? <span className="text-right text-[10px] leading-4 text-[#456453]">{metric.change}</span> : null}
            </div>
            <BentoKpiCard label={metric.label} value={formatStatistic(metric.value, metric.unit)} description={metric.note}
              className={styles.kpiValue} />
          </div>;
        })}
      </div> : null}
      <BentoGrid>
        {report.blocks.map((block, index) => <StatisticsPanel key={`${index}:${block.title}`} block={block} />)}
      </BentoGrid>
      <p className="text-xs text-[#58675e]">
        Source · {report.source} · Actualisé le {reportDate.format(new Date(report.generatedAt))} · Comparaison du {formatStatisticsDate(report.comparison.from)} au {formatStatisticsDate(report.comparison.to)}
      </p>
    </> : null}
    {saleOpen && report?.canRecordSales ? <StatisticsSaleDialog open={saleOpen} onOpenChange={setSaleOpen} advisors={report.advisors} onSaved={() => { setSaved(true); setAttempt(value => value + 1); }} /> : null}
  </section>;
}

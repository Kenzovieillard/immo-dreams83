import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BentoCard } from "@/components/admin/bento/bento-card";
import { cn } from "@/lib/utils";
import { formatStatistic, formatStatisticsDate, type ChartBlock, type StatisticsBlock, type StatisticsRow } from "@/lib/statistics";
import styles from "./statistics.module.css";

const palette = ["#2f493a", "#77cfc4", "#c28b2c", "#90a3b7", "#4e765e", "#abb9a6", "#a2473e", "#746d8d"];
const color = (index: number) => palette[index % palette.length];
const formatCell = (value: string | number | null) => typeof value === "number" ? formatStatistic(value, "decimal") : value ?? "—";
const empty = <p className="rounded-lg bg-[#f2f0ea] px-4 py-3 text-sm text-[#626e66]">Aucune donnée pour ce périmètre.</p>;

function ChartLegend({ labels }: { labels: string[] }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#58675e]">
    {labels.map((label, i) => <li key={i} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ backgroundColor: color(i) }} aria-hidden="true" />{label}</li>)}
  </ul>;
}

function ChartValues({ block }: { block: ChartBlock }) {
  return <details className="text-xs text-[#58675e]">
    <summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-2">Voir les valeurs</summary>
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-left">
        <thead><tr className="border-b border-[#e3e0d8]"><th scope="col" className="p-2">Période ou catégorie</th>{block.series.map((name, index) => <th scope="col" className="p-2" key={index}>{name}</th>)}</tr></thead>
        <tbody>{block.points.map(({ label, values }, row) => <tr key={row} className="border-b border-[#e3e0d8]"><th scope="row" className="p-2 font-medium">{block.kind === "heatmap" ? formatStatisticsDate(label) : label}</th>{values.map((value, i) => <td key={i} className="p-2">{formatStatistic(value, block.unit)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </details>;
}

function HorizontalBars({ block }: { block: ChartBlock }) {
  const max = Math.max(1, ...(block.unit === "percent" ? [100] : []), ...block.points.flatMap(row => row.values.map(value => value ?? 0)));
  const manySeries = block.series.length > 1;
  return <div className="grid gap-2.5">
    {block.points.map(({ label, values }, row) => <div key={row} className={styles.barRow}>
      <p className="break-words text-xs font-medium">{label}</p>
      <div className={styles.barSeries}>
        {values.map((value, index) => <div key={index} className={styles.barLine} title={manySeries ? block.series[index] : undefined}>
          <div className={styles.barTrack} aria-hidden="true">
            <div className={styles.barFill} data-stat-chart="bar" style={{ width: `${(value ?? 0) / max * 100}%`, backgroundColor: color(manySeries ? index : row) }} />
          </div>
          <span className="min-w-8 whitespace-nowrap text-right text-xs tabular-nums">{formatStatistic(value, block.unit)}</span>
        </div>)}
      </div>
    </div>)}
    {manySeries ? <ChartLegend labels={block.series} /> : null}
  </div>;
}

function ChartColumns({ block }: { block: ChartBlock }) {
  const max = Math.max(1, ...block.points.flatMap(row => row.values.map(value => value ?? 0)));
  return <div className="grid min-w-0 gap-3">
    <div className="min-w-0 overflow-x-auto pb-2" aria-hidden="true">
      <div className={styles.columnsGrid} style={{ minWidth: `${block.points.length * Math.max(38, block.series.length * 12 + 12)}px` }}>
        {block.points.map(({ label, values }, row) => <div key={row} className="grid min-w-0 gap-1.5">
          <div className={cn(styles.columnPlot, "min-w-0 border-b border-[#e1e2d9]")}>
            {values.map((value, i) => <div key={i} className={cn(styles.column, "rounded-t-sm")} title={`${block.series[i]} · ${formatStatistic(value, block.unit)}`} style={{ height: `${(value ?? 0) * 100 / max}%`, backgroundColor: color(block.series.length > 1 ? i : row) }} />)}
          </div>
          <span className="truncate text-center text-[10px] text-[#58675e]" title={label}>{label}</span>
        </div>)}
      </div>
    </div>
    {block.series.length > 1 ? <ChartLegend labels={block.series} /> : null}
  </div>;
}

function Donut({ block }: { block: ChartBlock }) {
  const total = block.points.reduce((sum, row) => sum + (row.values[0] ?? 0), 0);
  if (!total) return empty;
  let offset = 0;
  const slices: { label: string; start: number; end: number; share: number; swatch: string; value: number | null }[] = [];
  for (const [index, { label, values }] of block.points.entries()) {
    const start = offset;
    const share = (values[0] ?? 0) * 100 / total;
    offset += share;
    slices.push({ label, start, end: offset, share, swatch: color(index), value: values[0] });
  }
  return <div className={styles.donutLayout}>
    <div className={styles.donutRing} data-stat-chart="donut" style={{ background: `conic-gradient(${slices.map(slice => `${slice.swatch} ${slice.start}% ${slice.end}%`).join(",")})` }} aria-hidden="true">
      <div className={cn(styles.donutCenter, "bg-[var(--bento-card-background)] text-center text-xs font-bold")}>{block.unit === "currency" ? "CA" : "100 %"}</div>
    </div>
    <ul className="grid gap-1.5 text-xs">
      {slices.map(({ label, swatch, share, value }, i) => <li key={i} className={styles.donutItem} title={formatStatistic(value, block.unit)}>
        <span className="size-2.5 rounded-full" style={{ backgroundColor: swatch }} aria-hidden="true" /><span className="break-words">{label}</span><strong className="tabular-nums">{formatStatistic(share, "percent")}</strong>
      </li>)}
    </ul>
  </div>;
}

function Lines({ block }: { block: ChartBlock }) {
  const max = Math.max(1, ...block.points.flatMap(row => row.values.map(value => value ?? 0)));
  const x = (i: number) => block.points.length === 1 ? 216 : 64 + i * 342 / (block.points.length - 1);
  const y = (value: number) => 125 - value * 100 / max;
  return <div className="grid gap-2">
    <svg className="h-auto w-full" viewBox="0 0 424 154" aria-hidden="true">
      {[0, 1, 2, 3].map(i => <g key={i}>
        <line x1={61} x2={407} y1={y(max * i / 3)} y2={y(max * i / 3)} stroke="#e2e3da" strokeDasharray="3 3" />
        <text x={54} y={y(max * i / 3) + 3} textAnchor="end" fontSize={10} fill="#546259">{formatStatistic(max * i / 3, block.unit === "currency" ? "decimal" : block.unit)}</text>
      </g>)}
      {block.series.map((series, i) => <g key={i}>
        {block.points.map(({ values, label }, j) => {
          const value = values[i];
          const next = block.points[j + 1]?.values[i];
          if (value == null) return null;
          return <g key={j}>
            {next != null ? <line x1={x(j)} x2={x(j + 1)} y1={y(value)} y2={y(next)} stroke={color(i)} strokeWidth={2} /> : null}
            <circle cx={x(j)} cy={y(value)} r={3} fill={color(i)}><title>{label} · {series} · {formatStatistic(value, block.unit)}</title></circle>
          </g>;
        })}
      </g>)}
      {block.points.map(({ label }, i) => i % Math.ceil(block.points.length / 6) === 0 || i === block.points.length - 1
        ? <text key={i} x={x(i)} y={146} textAnchor="middle" fontSize={10} fill="#546259">{label}</text> : null)}
    </svg>
    {block.series.length > 1 ? <ChartLegend labels={block.series} /> : null}
  </div>;
}

const heat = ["#eeede7", "#dce5d7", "#a6c3b5", "#4e765e", "#2f493a"];

function Heatmap({ block }: { block: ChartBlock }) {
  const maximum = Math.max(1, ...block.points.map(point => point.values[0] ?? 0));
  const n = block.points.slice(0, 366 + 12);
  return <>
    <div className={styles.heatmap} aria-hidden="true">
      {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(label => <span key={label} className="text-center text-[10px] text-[#58675e]">{label}</span>)}
      {n.map(({ label, values }) => {
        const n = values[0];
        const index = n ? Math.ceil(n * (heat.length - 1) / maximum) : 0;
        return <div key={label} className={cn(styles.heatCell, "rounded border border-[#e3e0d8]")} title={`${formatStatisticsDate(label)} · ${formatStatistic(n)}`} style={{ backgroundColor: n === null ? "transparent" : heat[index] }} />;
      })}
    </div>
    <p className="flex items-center gap-2 text-[10px] text-[#58675e]">Moins {heat.map(value => <span key={value} className="size-3 rounded-sm border border-[#e3e0d8]" style={{ backgroundColor: value }} aria-hidden="true" />)} Plus</p>
  </>;
}

function DataTable({ columns, rows }: { columns: string[]; rows: StatisticsRow[] }) {
  if (!rows.length) return empty;
  return <div className="overflow-x-auto">
    <table className="w-full border-collapse text-left text-xs">
      <thead className="bg-[#f2f0ea] text-[#55645b]"><tr>{columns.map(column => <th key={column} scope="col" className="p-2.5 font-semibold">{column}</th>)}</tr></thead>
      <tbody>{rows.map(({ cells, href }, index) => <tr key={index} className="border-b border-[#e6e3da]">
        {cells.map((value, i) => <td key={i} className="p-2.5 align-top tabular-nums">
          {i === 0 && href ? <Link href={href} className="font-semibold text-[#2f493a] underline decoration-[#a6b9a9] underline-offset-2 hover:decoration-current">{formatCell(value)}</Link> : formatCell(value)}
        </td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function StatisticsPanel({ block }: { block: StatisticsBlock }) {
  let content;
  if (block.kind === "notice") content = null;
  else if (block.kind === "table") content = <DataTable columns={block.columns} rows={block.rows} />;
  else if (block.kind === "alerts") content = block.alerts.length ? (
    <ul className="grid gap-2">{block.alerts.map(({ label, detail, level, action }, i) => <li key={i} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border-l-[3px] bg-[#f4f2ec] px-3 py-2.5", level === "critical" ? "border-[#a2473e]" : level === "moderate" ? "border-[#c28b2c]" : "border-[#90a3b7]")}>
      <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-[#58675e]">{detail}</p></div>
      <Link href={action.href} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-[#2f493a] hover:underline">{action.label}<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
    </li>)}</ul>
  ) : <p className="text-sm text-[#58675e]">Aucun signal pour ce périmètre.</p>;
  else if (!block.points.some(row => row.values.some(value => value !== null))) content = empty;
  else {
    const Chart = { bar: HorizontalBars, columns: ChartColumns, donut: Donut, heatmap: Heatmap, line: Lines }[block.kind];
    content = <><Chart block={block} /><ChartValues block={block} /></>;
  }
  return (
    <BentoCard span={block.wide ? "full" : "large"} title={block.title} description={block.note}
      variant={block.kind === "notice" ? "muted" : "default"}
      className={cn("min-w-0", "points" in block && styles.chartCard)}
      contentClassName="content-start">
      {content}
    </BentoCard>
  );
}

"use client";

import Link from "next/link";
import { OfferNegotiationTimeline } from "./offer-negotiation-timeline";
import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { BentoEmptyState } from "@/components/admin/bento/bento-states";
import {
  CommercialPageHeader,
  CommercialPanel,
  CommercialPagination,
  DataSourceNotice,
  commercialPrimaryButton,
  commercialSecondaryButton,
} from "./commercial-ui";
import {
  Person,
  PropertyPhoto,
  SearchFilters,
  StatCards,
  StatusBadge,
  StatusTabs,
} from "./commercial-design-ui";
import {
  calendarDays,
  commercialTone,
  money,
  parisDay,
  priceGap,
  shortDate,
} from "@/lib/commercial-presentation";
import type {
  CommercialEstimationPayload,
  CommercialOfferPayload,
  CommercialVisitPayload,
  CommercialVisitSummary,
} from "@/types/commercial";
import { cn } from "@/lib/utils";
import { commercialListEndpoint, useCommercialResourceSync } from "./use-commercial-resource-sync";

type Filters = { query: string; status: string };
const estimationStatuses = [
  "NEW_REQUEST",
  "TO_CONTACT",
  "SCHEDULED",
  "COMPLETED",
  "REPORT_SENT",
  "FINISHED",
  "NO_FOLLOW_UP",
];
const offerStatuses = [
  "DRAFT",
  "TO_BE_SIGNED",
  "SIGNED_BY_BUYER",
  "SENT_TO_SELLER",
  "NEGOTIATING",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "WITHDRAWN",
];
const stripe = {
  success: "border-l-[#4f7d5e]",
  warning: "border-l-[#cb8f22]",
  danger: "border-l-[#b34d40]",
  neutral: "border-l-[#69736e]",
};
function SourceFooter({ count, shown }: { count: number; shown: number }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#66716c]">
      <span>
        {shown} résultat(s) affiché(s) sur {count}
      </span>
      <DataSourceNotice demo={false} />
    </footer>
  );
}

export function EstimationsListConnected({
  data: initialData,
  filters,
}: {
  data: CommercialEstimationPayload;
  filters: Filters;
}) {
  const { data, status: syncStatus } = useCommercialResourceSync({ initialData, endpoint: commercialListEndpoint("estimations", initialData.meta, filters) });
  const [agent, setAgent] = useState("");
  const [sector, setSector] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const rows = data.items.filter(
    (row) =>
      (!agent || row.assignedTo === agent) &&
      (!sector || row.city === sector) &&
      (!propertyType || row.propertyType === propertyType),
  );
  const week = calendarDays(parisDay(data.generatedAt), "week");
  const action = (status: string) =>
    ({
      NEW_REQUEST: "Attribuer",
      TO_CONTACT: "Contacter",
      SCHEDULED: "Préparer dossier",
      COMPLETED: "Rédiger / envoyer rapport",
      REPORT_SENT: "Suivre le mandat",
      FINISHED: "Voir le bien",
      NO_FOLLOW_UP: "Voir la fiche",
    })[status] ?? "Voir la fiche";
  const selectClass =
    "h-9 max-w-full rounded-lg border border-[#dfddd4] bg-[#fbfaf7] px-3 text-xs";
  return (
    <div className="grid min-w-0 gap-7">
      {syncStatus}
      <CommercialPageHeader
        title="Estimations"
        description="Demandes, rendez-vous et rapports d’estimation"
        action={
          <Link
            href="/commercial/estimations/nouvelle"
            className={commercialPrimaryButton}
          >
            <Plus className="size-4" />
            Nouvelle estimation
          </Link>
        }
      />
      <StatCards
        items={[
          {
            label: "Nouvelles demandes",
            value: data.stats.newRequests,
            tone: "success",
          },
          {
            label: "À planifier",
            value: data.stats.toSchedule,
            tone: "warning",
          },
          {
            label: "Planifiées cette semaine",
            value: data.stats.scheduledThisWeek,
          },
          { label: "Réalisées ce mois", value: data.stats.completedThisMonth },
          {
            label: "Mandats obtenus ce mois",
            value: data.stats.mandatesThisMonth,
            tone: "success",
          },
        ]}
      />
      <StatusTabs
        basePath="/commercial/estimations"
        values={estimationStatuses}
        active={filters.status}
        query={filters.query}
        total={data.meta.count}
      />
      <div className="grid gap-2">
        <SearchFilters
          {...filters}
          placeholder="Rechercher un propriétaire, une adresse…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[#66716c]">
            Affiner cette page :
          </span>
          <select
            aria-label="Conseiller"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className={selectClass}
          >
            <option value="">Conseiller : tous</option>
            {data.options.profiles.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Secteur"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className={selectClass}
          >
            <option value="">Secteur : tous</option>
            {[...new Set(data.items.map((r) => r.city))].sort().map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
          <select
            aria-label="Type de bien"
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className={selectClass}
          >
            <option value="">Type de bien : tous</option>
            {[...new Set(data.items.map((r) => r.propertyType))]
              .sort()
              .map((type) => (
                <option key={type}>{type}</option>
              ))}
          </select>
        </div>
      </div>
      {!rows.length ? (
        <BentoEmptyState
          title="Aucune estimation"
          description="Aucune estimation ne correspond aux filtres sélectionnés."
        />
      ) : (
        <CommercialPanel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead className="bg-[#f6f4ef] text-[10px] uppercase text-[#66716c]">
                <tr>
                  {[
                    "Propriétaire",
                    "Adresse",
                    "Type de bien",
                    "Date demande",
                    "Date RDV",
                    "Conseiller",
                    "Statut",
                    "Estimation",
                    "Prochaine action",
                  ].map((label) => (
                    <th key={label} className="px-4 py-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[#dfddd4] hover:bg-[#f6f4ef]"
                  >
                    <td className="max-w-44 px-4 py-4">
                      <Link
                        href={`/commercial/estimations/${row.id}`}
                        className="hover:underline"
                      >
                        <Person name={row.contactName} />
                        <p className="mt-1 truncate pl-9 text-[10px] text-[#66716c]">
                          {row.contactEmail}
                        </p>
                      </Link>
                    </td>
                    <td className="max-w-44 px-4 py-4">
                      {row.address}
                      <p className="mt-1 text-[#66716c]">{row.city}</p>
                    </td>
                    <td className="px-4 py-4">
                      {row.propertyType}
                      <p className="text-[#66716c]">{row.surface} m²</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {shortDate(row.createdAt)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-4",
                        !row.appointmentAt && "text-[#ad7416]",
                      )}
                    >
                      {shortDate(row.appointmentAt, true)}
                    </td>
                    <td className="px-4 py-4">
                      <Person name={row.assignedToName} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-4 font-semibold">
                      {row.estimateLow != null && row.estimateHigh != null
                        ? `${money(row.estimateLow)} — ${money(row.estimateHigh)}`
                        : money(row.estimatedValue)}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/commercial/estimations/${row.id}`}
                        className="inline-flex rounded-md bg-[#dce5d7] px-3 py-2 font-medium text-[#2f493a] hover:bg-[#c7d8c2]"
                      >
                        {action(row.status)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#dfddd4] p-4">
            <CommercialPagination
              basePath="/commercial/estimations"
              {...data.meta}
              query={filters.query}
              status={filters.status}
            />
          </div>
        </CommercialPanel>
      )}
      <CommercialPanel className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Calendrier des rendez-vous cette semaine
          </h2>
          <CalendarDays className="size-4 text-[#66716c]" />
        </div>
        <p className="mt-1 text-xs text-[#66716c]">
          Rendez-vous des estimations chargées sur cette page · heure de Paris
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {week.slice(0, 5).map((day) => (
            <section key={day} className="min-h-40 rounded-xl bg-[#f6f4ef] p-3">
              <h3 className="text-[11px] font-bold uppercase">
                {new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", {
                  weekday: "long",
                })}
              </h3>
              <div className="mt-3 grid gap-2">
                {data.items
                  .filter(
                    (r) => r.appointmentAt && parisDay(r.appointmentAt) === day,
                  )
                  .map((row) => (
                    <Link
                      href={`/commercial/estimations/${row.id}`}
                      key={row.id}
                      className="rounded-lg border border-[#dfddd4] bg-[#dce5d7] p-3 text-xs"
                    >
                      <p className="font-medium">
                        {shortDate(row.appointmentAt, true)}
                      </p>
                      <p className="mt-2 font-semibold">
                        {row.propertyType} · {row.city}
                      </p>
                      <p className="mt-1 text-[10px] text-[#66716c]">
                        {row.contactName}
                      </p>
                    </Link>
                  ))}
                {!data.items.some(
                  (r) => r.appointmentAt && parisDay(r.appointmentAt) === day,
                ) && (
                  <p className="py-7 text-center text-[11px] text-[#66716c]">
                    Aucun RDV chargé
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </CommercialPanel>
      <SourceFooter count={data.meta.count} shown={rows.length} />
    </div>
  );
}

export function OffersListConnected({
  data: initialData,
  filters,
}: {
  data: CommercialOfferPayload;
  filters: Filters;
}) {
  const { data, status: syncStatus } = useCommercialResourceSync({ initialData, endpoint: commercialListEndpoint("offres", initialData.meta, filters) });
  return (
    <div className="grid min-w-0 gap-7">
      {syncStatus}
      <CommercialPageHeader
        title="Offres"
        description="Suivi des offres, négociations et décisions"
        action={
          <Link
            className={commercialPrimaryButton}
            href="/commercial/offres/nouvelle"
          >
            <Plus className="size-4" />
            Nouvelle offre
          </Link>
        }
      />
      <StatCards
        items={[
          { label: "Offres en cours", value: data.stats.active },
          {
            label: "En négociation",
            value: data.stats.negotiating,
            tone: "warning",
          },
          {
            label: "Acceptées ce mois",
            value: data.stats.acceptedThisMonth,
            tone: "success",
          },
          { label: "Refusées / Expirées", value: data.stats.rejectedOrExpired },
        ]}
      />
      <StatusTabs
        basePath="/commercial/offres"
        values={offerStatuses}
        active={filters.status}
        query={filters.query}
        total={data.meta.count}
      />
      <SearchFilters
        {...filters}
        placeholder="Rechercher une offre, un acquéreur, un bien…"
      />
      <div className="grid gap-4">
        {data.items.map((row) => {
          const gap = priceGap(row.amount, row.propertyPrice);
          return (
            <CommercialPanel
              key={row.id}
              className={cn(
                "border-l-4 p-4",
                stripe[commercialTone(row.status)],
              )}
            >
              <div className="grid items-center gap-5 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_minmax(230px,1.3fr)_minmax(160px,1fr)_auto]">
                <Link
                  href={`/commercial/offres/${row.id}`}
                  className="flex min-w-0 items-center gap-4 hover:underline"
                >
                  <PropertyPhoto
                    key={row.propertyPhotos[0]}
                    src={row.propertyPhotos[0]}
                    title={row.propertyTitle}
                  />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold">
                      {row.propertyTitle}
                    </h2>
                    <p className="mt-1 text-xs text-[#66716c]">
                      {row.propertyCity}
                    </p>
                    <p className="mt-1 text-[10px] text-[#66716c]">
                      {row.propertyReference}
                    </p>
                  </div>
                </Link>
                <dl className="grid grid-cols-[1fr_1fr_auto] gap-3 text-xs">
                  <div>
                    <dt className="text-[10px] text-[#66716c]">Prix demandé</dt>
                    <dd className="mt-1 font-medium">
                      {money(row.propertyPrice)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#66716c]">
                      Montant offre
                    </dt>
                    <dd className="mt-1 font-bold text-[#2f493a]">
                      {money(row.amount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#66716c]">Écart</dt>
                    <dd
                      className={cn(
                        "mt-1",
                        gap != null && gap < 0
                          ? "text-[#b34d40]"
                          : "text-[#2f493a]",
                      )}
                    >
                      {gap == null ? "—" : `${gap.toFixed(1)} %`}
                    </dd>
                  </div>
                </dl>
                <div className="grid gap-3">
                  <Person name={row.buyerName} label="Acquéreur" />
                  <Person name={row.responsibleUserName} label="Négociateur" />
                </div>
                <div className="flex flex-wrap items-center gap-2 xl:flex-col xl:items-end">
                  <StatusBadge status={row.status} />
                  {row.validUntil && (
                    <p className="text-[10px] text-[#66716c]">
                      Val. {shortDate(row.validUntil)}
                    </p>
                  )}
                  <Link
                    href={
                      row.negotiationId
                        ? `/commercial/negociations/${row.negotiationId}`
                        : `/commercial/offres/${row.id}`
                    }
                    className={cn(commercialPrimaryButton, "text-xs")}
                  >
                    {row.negotiationId ? "Voir négociation" : "Voir l’offre"}
                  </Link>
                </div>
              </div>
            </CommercialPanel>
          );
        })}
      </div>
      {!data.items.length && (
        <BentoEmptyState
          title="Aucune offre"
          description="Créez une offre à partir d’un bien et d’un dossier acquéreur."
        />
      )}
      <CommercialPagination
        basePath="/commercial/offres"
        {...data.meta}
        query={filters.query}
        status={filters.status}
      />
      <SourceFooter count={data.meta.count} shown={data.items.length} />
      <OfferNegotiationTimeline offers={data.items} />
    </div>
  );
}

function VisitRow({ row }: { row: CommercialVisitSummary }) {
  const missing = row.visitStatus === "COMPLETED" && !row.reportSubmittedAt;
  const detailHref = `/commercial/visites/${row.id}`;
  return (
    <CommercialPanel
      className={cn(
        "border-l-4 p-4 sm:p-5",
        stripe[commercialTone(row.visitStatus)],
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <PropertyPhoto
          title={row.propertyTitle ?? row.title}
          className="hidden sm:grid"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold">
            <CalendarDays className="size-4 text-[#66716c]" />
            {shortDate(row.startsAt, true)}
            {row.endsAt &&
              ` — ${new Date(row.endsAt).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}`}
          </p>
          <Link
            href={detailHref}
            className="mt-2 block text-sm font-semibold hover:underline"
          >
            {row.propertyTitle ?? row.title}
          </Link>
          <p className="mt-1 text-xs text-[#66716c]">
            {row.location ?? "Lieu non renseigné"}
          </p>
          <div className="mt-3 flex flex-wrap gap-5">
            <Person name={row.contactName} label="Acquéreur" />
            <Person name={row.assignedToName} label="Conseiller" />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-col sm:items-end">
          <StatusBadge status={row.visitStatus} />
          {missing && (
            <span className="text-xs text-[#b34d40]">
              Compte rendu manquant
            </span>
          )}
          <Link
            href={
              missing
                ? `${detailHref}/compte-rendu`
                : row.reportSubmittedAt
                  ? `${detailHref}#compte-rendu`
                  : detailHref
            }
            className={cn(
              commercialPrimaryButton,
              "text-xs",
              missing && "bg-[#b34d40]",
            )}
          >
            {missing
              ? "Saisir CR"
              : row.reportSubmittedAt
                ? "Voir CR"
                : row.visitStatus === "TO_CONFIRM"
                  ? "Confirmer la visite"
                  : row.visitStatus === "CANCELLED"
                    ? "Reprogrammer"
                    : "Voir détail"}
          </Link>
        </div>
      </div>
    </CommercialPanel>
  );
}
export function VisitsListConnected({
  data: initialData,
  filters,
}: {
  data: CommercialVisitPayload;
  filters: Filters;
}) {
  const { data, status: syncStatus } = useCommercialResourceSync({ initialData, endpoint: commercialListEndpoint("visites", initialData.meta, filters) });
  const today = parisDay(data.generatedAt);
  const [period, setPeriod] = useState("all");
  const filtered = data.items.filter(
    (r) =>
      period === "all" ||
      (period === "today"
        ? parisDay(r.startsAt) === today
        : period === "upcoming"
          ? parisDay(r.startsAt) > today
          : r.visitStatus === "COMPLETED" && !r.reportSubmittedAt),
  );
  const groups = [
    {
      label: "Aujourd’hui",
      rows: filtered.filter((r) => parisDay(r.startsAt) === today),
    },
    {
      label: "À venir",
      rows: filtered.filter((r) => parisDay(r.startsAt) > today),
    },
    {
      label: "Passées",
      rows: filtered.filter((r) => parisDay(r.startsAt) < today),
    },
  ];
  return (
    <div className="grid min-w-0 gap-7">
      <CommercialPageHeader
        title="Visites"
        description="Planification, suivi et comptes rendus des visites"
        action={
          <Link
            href="/commercial/visites/nouvelle"
            className={commercialPrimaryButton}
          >
            <Plus className="size-4" />
            Nouvelle visite
          </Link>
        }
      />
      {syncStatus}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <StatusTabs
          basePath="/commercial/visites"
          values={["TO_CONFIRM", "CONFIRMED", "COMPLETED", "CANCELLED"]}
          active={filters.status}
          query={filters.query}
          total={data.meta.count}
        />
        <Link
          href="/commercial/visites/calendrier"
          className={commercialSecondaryButton}
        >
          <CalendarDays className="size-4" />
          Calendrier
        </Link>
      </div>
      <SearchFilters
        {...filters}
        placeholder="Rechercher un bien, un contact…"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[#66716c]">Sur cette page :</span>
        {[
          ["all", "Toutes"],
          ["today", "Aujourd’hui"],
          ["upcoming", "À venir"],
          ["missing", "CR manquant"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
            className={cn(
              "rounded-full px-3 py-2 text-xs",
              period === value ? "bg-[#2f493a] text-white" : "bg-[#dce5d7]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {groups
        .filter((g) => g.rows.length)
        .map((group) => (
          <section key={group.label}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#66716c]">
              {group.label}
            </h2>
            <div className="grid gap-4">
              {group.rows
                .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                .map((row) => (
                  <VisitRow key={row.id} row={row} />
                ))}
            </div>
          </section>
        ))}
      {!filtered.length && (
        <BentoEmptyState
          title="Aucune visite dans cette vue"
          description="Modifiez les filtres ou planifiez un rendez-vous."
        />
      )}
      <section>
        <h2 className="mb-4 text-base font-semibold">Résumé de la semaine</h2>
        <StatCards
          items={[
            { label: "Visites cette semaine", value: data.stats.total },
            {
              label: "Confirmées",
              value: data.stats.confirmed,
              tone: "success",
            },
            {
              label: "À confirmer",
              value: data.stats.toConfirm,
              tone: "warning",
            },
            {
              label: "CR à rédiger",
              value: data.stats.reportsMissing,
              tone: "danger",
            },
          ]}
        />
      </section>
      <CommercialPagination
        basePath="/commercial/visites"
        {...data.meta}
        query={filters.query}
        status={filters.status}
      />
      <SourceFooter count={data.meta.count} shown={filtered.length} />
    </div>
  );
}

export function VisitCalendarConnected({
  data: initialData,
}: {
  data: CommercialVisitPayload;
}) {
  const { data, status: syncStatus } = useCommercialResourceSync({ initialData, endpoint: commercialListEndpoint("visites", initialData.meta) });
  const today = parisDay(data.generatedAt);
  const [anchor, setAnchor] = useState(today);
  const [mode, setMode] = useState<"week" | "month">("week");
  const days = calendarDays(anchor, mode);
  const visible = data.items.filter((r) => days.includes(parisDay(r.startsAt)));
  // Keep weekend appointments visible even though the Figma example contains weekdays only.
  const columns =
    mode === "week" &&
    !visible.some((r) => days.slice(5).includes(parisDay(r.startsAt)))
      ? days.slice(0, 5)
      : days;
  const move = (direction: number) => {
    const d = new Date(`${anchor}T12:00:00Z`);
    if (mode === "week") d.setUTCDate(d.getUTCDate() + direction * 7);
    else {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + direction);
    }
    setAnchor(d.toISOString().slice(0, 10));
  };
  return (
    <div className="grid min-w-0 gap-6">
      <CommercialPageHeader
        eyebrow="Commercial / Visites / Calendrier"
        title="Calendrier des visites"
        description="Planification et gestion des visites immobilières · heure de Paris"
        action={
          <Link
            href="/commercial/visites/nouvelle"
            className={commercialPrimaryButton}
          >
            <Plus className="size-4" />
            Planifier une visite
          </Link>
        }
      />
      {syncStatus}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => move(-1)}
            className={commercialSecondaryButton}
            aria-label="Période précédente"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h2 className="text-sm font-semibold">
            {mode === "week"
              ? `${shortDate(days[0])} — ${shortDate(days[6])}`
              : new Date(`${anchor}T12:00:00Z`).toLocaleDateString("fr-FR", {
                  month: "long",
                  year: "numeric",
                })}
          </h2>
          <button
            onClick={() => move(1)}
            className={commercialSecondaryButton}
            aria-label="Période suivante"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => setAnchor(today)}
            className="text-xs underline"
          >
            Aujourd’hui
          </button>
        </div>
        <div className="inline-flex rounded-lg bg-[#dce5d7] p-1">
          {(["week", "month"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "rounded-md px-4 py-2 text-xs",
                mode === value && "bg-[#fbfaf7] font-semibold shadow-sm",
              )}
            >
              {value === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 overflow-x-auto">
          <div
            className={cn(
              "grid gap-3",
              mode === "week" ? "min-w-[680px]" : "min-w-[700px]",
            )}
            style={{
              gridTemplateColumns: `repeat(${mode === "month" || columns.length === 7 ? 7 : 5}, minmax(0, 1fr))`,
            }}
          >
            {columns.map((day) => (
              <section
                key={day}
                className={cn(
                  "rounded-xl border bg-[#fbfaf7] p-3",
                  day === today ? "border-[#4f7d5e]" : "border-[#dfddd4]",
                  mode === "week" ? "min-h-[650px]" : "min-h-36",
                )}
              >
                <h3 className="border-b border-[#dfddd4] pb-3 text-xs font-semibold">
                  {new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", {
                    weekday: "long",
                  })}
                  <span className="mt-1 block font-normal text-[#66716c]">
                    {shortDate(day)}
                  </span>
                </h3>
                <div className="mt-3 grid gap-2">
                  {visible
                    .filter((r) => parisDay(r.startsAt) === day)
                    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                    .map((row) => (
                      <Link
                        key={row.id}
                        href={`/commercial/visites/${row.id}`}
                        className="grid gap-2 rounded-lg border border-[#dfddd4] p-2 text-[11px] shadow-sm transition hover:border-[#4f7d5e]"
                      >
                        <span className="font-semibold">
                          {new Date(row.startsAt).toLocaleTimeString("fr-FR", {
                            timeZone: "Europe/Paris",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="overflow-hidden">
                          <StatusBadge status={row.visitStatus} />
                        </span>
                        <span className="line-clamp-2 font-semibold">
                          {row.propertyTitle ?? row.title}
                        </span>
                        <span className="text-[#66716c]">
                          {row.contactName ?? "Contact non relié"}
                        </span>
                      </Link>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        <aside className="grid gap-4">
          <CommercialPanel className="p-5">
            <h2 className="font-semibold">Statistiques de la période</h2>
            <dl className="mt-4 grid gap-3 text-xs">
              {[
                ["Total visites", visible.length],
                [
                  "Confirmées",
                  visible.filter((r) => r.visitStatus === "CONFIRMED").length,
                ],
                [
                  "À confirmer",
                  visible.filter((r) => r.visitStatus === "TO_CONFIRM").length,
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-[#66716c]">{label}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </CommercialPanel>
          <div className="rounded-xl bg-[#dce5d7] p-5 text-xs leading-5">
            <h2 className="mb-2 font-semibold">Rappel important</h2>Enregistrez
            le compte rendu après chaque visite pour garder le pipeline à jour.
          </div>
          {data.meta.count > data.items.length && (
            <p role="status" className="rounded-lg bg-[#f7edd7] p-3 text-xs">
              Calendrier partiel : {data.items.length} visites chargées sur{" "}
              {data.meta.count}.
            </p>
          )}
        </aside>
      </div>
      <SourceFooter count={data.meta.count} shown={data.items.length} />
    </div>
  );
}

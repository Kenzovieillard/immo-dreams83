"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CommercialSyncStatus, useCommercialLiveSync } from "./use-commercial-live-sync";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  Handshake,
  History,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  Upload,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { StatCards } from "./commercial-design-ui";
import {
  BentoCardSkeleton,
  BentoEmptyState,
  BentoErrorState,
} from "@/components/admin/bento/bento-states";
import { cn } from "@/lib/utils";
import type {
  CommercialNegotiation,
  NegotiationKpis,
  NegotiationStatus,
} from "@/types/crm";
import { formatCommercialPrice as formatPrice } from "@/lib/commercial-format";
import {
  calculateNegotiationKpis,
  negotiationReminderRecipient,
} from "@/lib/crm-negotiation-rules";
import {
  AgentAvatar,
  CommercialBadge,
  CommercialFeedback,
  CommercialPageHeader,
  CommercialPanel,
  DataSourceNotice,
  FieldLabel,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "./commercial-ui";

export type NegotiationsPayload = {
  success: boolean;
  data: CommercialNegotiation[];
  kpis: NegotiationKpis;
  message?: string;
};

type Feedback = {
  type: "loading" | "success" | "error";
  message: string;
} | null;
const emptyNegotiations: CommercialNegotiation[] = [];

const statusMeta: Record<
  NegotiationStatus,
  {
    label: string;
    tone: "success" | "warning" | "danger" | "neutral" | "info";
    bar: string;
  }
> = {
  IN_PROGRESS: { label: "En cours", tone: "info", bar: "bg-[#4d7f9f]" },
  WAITING_SELLER: {
    label: "En attente vendeur",
    tone: "warning",
    bar: "bg-[#d28c37]",
  },
  WAITING_BUYER: {
    label: "En attente acquéreur",
    tone: "warning",
    bar: "bg-[#d28c37]",
  },
  COUNTER_OFFER: {
    label: "Contre-proposition en cours",
    tone: "warning",
    bar: "bg-[#d28c37]",
  },
  ACCEPTED: { label: "Acceptée", tone: "success", bar: "bg-[#4d7a5c]" },
  REJECTED: { label: "Refusée", tone: "danger", bar: "bg-[#8b928e]" },
  EXPIRED: { label: "Expirée", tone: "neutral", bar: "bg-[#8b928e]" },
  CONCLUDED: { label: "Conclue", tone: "success", bar: "bg-[#4d7a5c]" },
};

const hubTabs = [
  { label: "Toutes", statuses: null },
  {
    label: "En négociation",
    statuses: ["IN_PROGRESS", "COUNTER_OFFER"] as NegotiationStatus[],
  },
  {
    label: "En attente vendeur",
    statuses: ["WAITING_SELLER"] as NegotiationStatus[],
  },
  {
    label: "En attente acquéreur",
    statuses: ["WAITING_BUYER"] as NegotiationStatus[],
  },
  {
    label: "Conclues",
    statuses: ["ACCEPTED", "CONCLUDED"] as NegotiationStatus[],
  },
] as const;

async function getNegotiations(id?: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/admin/commercial/negotiations${id ? `?id=${encodeURIComponent(id)}` : ""}`,
    { cache: "no-store", signal },
  );
  const payload = (await response
    .json()
    .catch(() => null)) as NegotiationsPayload | null;
  if (!response.ok || !payload?.success)
    throw new Error(
      payload?.message ?? "Chargement des négociations impossible.",
    );
  return payload;
}

async function mutateNegotiation(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/commercial/negotiations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
  } | null;
  if (!response.ok || !payload?.success)
    throw new Error(
      payload?.message ?? "La négociation n'a pas pu être mise à jour.",
    );
  return payload;
}

function formatDate(value: string | null) {
  if (!value) return "Aucune échéance";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function relativeTime(value: string) {
  const delta = new Date(value).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  const minutes = Math.round(delta / 60_000);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function actionFor(negotiation: CommercialNegotiation) {
  if (negotiation.status === "COUNTER_OFFER") return "Répondre";
  if (negotiation.status === "IN_PROGRESS") return "Présenter";
  if (["WAITING_SELLER", "WAITING_BUYER"].includes(negotiation.status))
    return "Relancer";
  if (["REJECTED", "EXPIRED"].includes(negotiation.status))
    return "Nouvelle offre";
  if (negotiation.status === "ACCEPTED") return "Préparer compromis";
  return "Voir dossier";
}

function CounterOfferDialog({
  negotiation,
  demoMode,
  onClose,
  onSuccess,
}: {
  negotiation: CommercialNegotiation;
  demoMode: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [amount, setAmount] = useState(String(negotiation.currentAmount));
  const [comment, setComment] = useState("");
  const [deadline, setDeadline] = useState(
    negotiation.responseDeadline ??
      new Date(new Date(negotiation.updatedAt).getTime() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10),
  );
  const parsedAmount = Number(amount);
  const gap =
    Number.isFinite(parsedAmount) && negotiation.askingPrice > 0
      ? ((parsedAmount - negotiation.askingPrice) / negotiation.askingPrice) *
        100
      : null;
  const mutation = useMutation({
    mutationFn: async () =>
      demoMode
        ? {
            success: true,
            message: "Contre-proposition simulée dans l'aperçu Figma.",
          }
        : mutateNegotiation({
            action: "counter-offer",
            negotiationId: negotiation.id,
            amount: parsedAmount,
            authorRole: "SELLER",
            comment,
            responseDeadline: deadline,
          }),
    onSuccess: (payload) =>
      onSuccess(payload.message ?? "Contre-proposition enregistrée."),
  });

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#17221e]/65 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="counter-offer-title"
        className="w-full max-w-xl rounded-3xl bg-[#fbfaf7] p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#66706b]">
              Négociation · {negotiation.property.title}
            </p>
            <h2 id="counter-offer-title" className="mt-2 text-2xl font-bold">
              Faire une contre-proposition
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-9 place-items-center rounded-full bg-[#eef1eb]"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Montant actuel</FieldLabel>
            <div
              className={cn(
                fieldClass,
                "flex items-center bg-[#eef1eb] font-bold",
              )}
            >
              {formatPrice(negotiation.currentAmount)}
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="counter-amount">
              Nouveau montant proposé
            </FieldLabel>
            <input
              id="counter-amount"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/\D/g, ""))
              }
              inputMode="numeric"
              className={fieldClass}
            />
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-[#edf4ea] p-4 text-sm">
          <span className="text-[#66706b]">Écart au prix demandé</span>
          <strong className="ml-3 text-[#2f493a]">
            {gap == null ? "—" : `${gap.toFixed(1).replace(".", ",")} %`}
          </strong>
        </div>
        <div className="mt-4">
          <FieldLabel htmlFor="counter-message">
            Message au vendeur ou à l&apos;acquéreur
          </FieldLabel>
          <textarea
            id="counter-message"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className={cn(fieldClass, "min-h-28 py-3")}
            placeholder="Expliquez clairement la nouvelle position…"
          />
        </div>
        <div className="mt-4">
          <FieldLabel htmlFor="counter-deadline">
            Nouvelle date limite
          </FieldLabel>
          <input
            id="counter-deadline"
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className={fieldClass}
          />
        </div>
        {mutation.error ? (
          <div className="mt-4">
            <BentoErrorState
              message={
                mutation.error instanceof Error
                  ? mutation.error.message
                  : "Envoi impossible."
              }
            />
          </div>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className={commercialSecondaryButton}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !parsedAmount ||
              comment.trim().length < 2 ||
              !deadline
            }
            className={commercialPrimaryButton}
          >
            {mutation.isPending ? (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Send className="size-4" />
            )}
            Envoyer la contre-proposition
          </button>
        </div>
      </div>
    </div>
  );
}

function NegotiationCard({
  negotiation,
  demoMode,
  onCounter,
  onRemind,
  onClientRemind,
}: {
  negotiation: CommercialNegotiation;
  demoMode: boolean;
  onCounter: () => void;
  onRemind: () => void;
  onClientRemind: () => void;
}) {
  const meta = statusMeta[negotiation.status];
  const action = actionFor(negotiation);
  const detailHref = demoMode
    ? "/crm-riviera-commercial-preview?screen=negotiation-detail"
    : `/commercial/negociations/${negotiation.id}`;
  const actionElement =
    action === "Répondre" ? (
      <button
        type="button"
        onClick={onCounter}
        className={commercialPrimaryButton}
      >
        {action}
        <ArrowRight className="size-4" />
      </button>
    ) : action === "Relancer" ? (
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onRemind}
          className={commercialSecondaryButton}
          title="Ajoute uniquement une note CRM interne"
        >
          <MessageSquareText className="size-4" />
          Note interne
        </button>
        <button
          type="button"
          onClick={onClientRemind}
          className={cn(
            commercialSecondaryButton,
            "border-[#d7a354] text-[#815c1a]",
          )}
          title="Envoie un message uniquement si un fournisseur est configuré"
        >
          <Send className="size-4" />
          Relance client
        </button>
      </div>
    ) : action === "Nouvelle offre" ? (
      <Link
        href={`/commercial/offres/nouvelle?bien_id=${encodeURIComponent(negotiation.property.id)}&contact_id=${encodeURIComponent(negotiation.buyer.id ?? "")}`}
        className={commercialPrimaryButton}
      >
        <Plus className="size-4" />
        {action}
      </Link>
    ) : action === "Présenter" ? (
      <Link
        href={`/commercial/offres/${negotiation.offerId}`}
        className={commercialPrimaryButton}
      >
        {action}
        <ArrowRight className="size-4" />
      </Link>
    ) : (
      <Link href={detailHref} className={commercialSecondaryButton}>
        {action}
        <ArrowRight className="size-4" />
      </Link>
    );

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#dfddd4] bg-[#fbfaf7] shadow-[0_2px_8px_rgb(23_34_30/0.06)]">
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          negotiation.isUrgent ? "bg-[#a94d43]" : meta.bar,
        )}
        aria-hidden="true"
      />
      <div className="commercial-negotiation-row">
        <Link
          href={detailHref}
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2f493a]"
        >
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-[#dce5d7]">
            {negotiation.property.imageUrl ? (
              <Image
                src={negotiation.property.imageUrl}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <Handshake className="absolute inset-0 m-auto size-6 text-[#65706a]" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold">
              {negotiation.property.title}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[#66706b]">
              <MapPin className="size-3.5 shrink-0" />
              {negotiation.property.city}
              {negotiation.property.postalCode
                ? `, ${negotiation.property.postalCode}`
                : ""}
            </p>
            <p className="mt-2 text-[10px] font-medium uppercase text-[#59645f]">
              Réf. {negotiation.property.reference ?? "non renseignée"}
            </p>
          </div>
        </Link>
        <div className="grid gap-2 text-xs">
          <p className="flex items-center gap-2 font-semibold">
            <UserRound className="size-4 text-[#65706a]" />
            {negotiation.buyer.name}
          </p>
          <p className="flex items-center gap-2 text-[#66706b]">
            <span aria-hidden="true">↔</span>
            <AgentAvatar name={negotiation.responsible.name} size="xs" />
            {negotiation.seller?.name ?? negotiation.responsible.name}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="text-[10px] font-medium uppercase text-[#59645f]">
              Prix
            </dt>
            <dd className="mt-1 font-semibold">
              {formatPrice(negotiation.askingPrice)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase text-[#59645f]">
              Offre
            </dt>
            <dd className="mt-1 font-bold text-[#2f493a]">
              {formatPrice(negotiation.currentAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase text-[#59645f]">
              Écart
            </dt>
            <dd
              className={cn(
                "mt-1 font-bold",
                negotiation.currentGapPercent <= -7
                  ? "text-[#a94d43]"
                  : "text-[#4d7a5c]",
              )}
            >
              {negotiation.currentGapPercent.toFixed(1).replace(".", ",")} %
            </dd>
          </div>
        </dl>
        <div>
          <div
            className="flex gap-1"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={negotiation.totalSteps}
            aria-valuenow={negotiation.currentStep}
            aria-label={`Étape ${negotiation.currentStep} sur ${negotiation.totalSteps}`}
          >
            {Array.from({ length: negotiation.totalSteps }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  index < negotiation.currentStep
                    ? "bg-[#4d7a5c]"
                    : "bg-[#d9ddd8]",
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#66706b]">
            Étape {negotiation.currentStep}/{negotiation.totalSteps}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 lg:grid lg:justify-items-end">
          <div className="grid justify-items-start gap-2 lg:justify-items-end">
            <CommercialBadge tone={negotiation.isUrgent ? "danger" : meta.tone}>
              {negotiation.isUrgent ? "Urgent · " : ""}
              {meta.label}
            </CommercialBadge>
            <p
              className={cn(
                "flex items-center gap-1 text-[11px]",
                negotiation.isUrgent
                  ? "font-bold text-[#a94d43]"
                  : "text-[#66706b]",
              )}
            >
              <Clock3 className="size-3.5" />
              {negotiation.responseDeadline
                ? `Expire le ${formatDate(negotiation.responseDeadline)}`
                : `Activité ${relativeTime(negotiation.lastActivityAt)}`}
            </p>
          </div>
          {actionElement}
        </div>
      </div>
      {demoMode ? (
        <span className="sr-only">Donnée de démonstration Figma</span>
      ) : null}
    </article>
  );
}

export function NegotiationsHubScreen({
  demoMode = false,
  initialData,
}: {
  demoMode?: boolean;
  initialData?: NegotiationsPayload;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [responsible, setResponsible] = useState("all");
  const [sector, setSector] = useState("all");
  const [selected, setSelected] = useState<CommercialNegotiation | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const query = useQuery({
    queryKey: ["commercial-negotiations"],
    queryFn: ({ signal }) => getNegotiations(undefined, signal),
    enabled: !demoMode,
    initialData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const sync = useCommercialLiveSync({
    enabled: !demoMode,
    endpoint: "/api/admin/commercial/negotiations/realtime",
    paused: Boolean(selected) || feedback?.type === "loading",
    refresh: async () => {
      await query.refetch({ throwOnError: true });
      await queryClient.invalidateQueries({ queryKey: ["commercial-negotiations", "sidebar-count"], exact: true });
    },
    cancel: () => queryClient.cancelQueries({ queryKey: ["commercial-negotiations"], exact: true }),
  });
  const rows = query.data?.data ?? emptyNegotiations;
  const kpis = query.data?.kpis ?? calculateNegotiationKpis([]);
  const responsibles = [...new Set(rows.map((row) => row.responsible.name))];
  const sectors = [...new Set(rows.map((row) => row.property.city))];
  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const statuses = hubTabs[activeTab].statuses;
        return (
          (!statuses || statuses.includes(row.status)) &&
          (responsible === "all" || row.responsible.name === responsible) &&
          (sector === "all" || row.property.city === sector)
        );
      }),
    [activeTab, responsible, rows, sector],
  );
  const urgentRows = rows.filter(
    (row) =>
      row.isUrgent &&
      !["ACCEPTED", "REJECTED", "EXPIRED", "CONCLUDED"].includes(row.status),
  );

  const remindMutation = useMutation({
    mutationFn: async (negotiation: CommercialNegotiation) =>
      demoMode
        ? { success: true, message: "Relance simulée dans l'aperçu Figma." }
        : mutateNegotiation({
            action: "remind",
            negotiationId: negotiation.id,
            comment: `Relance à effectuer auprès de ${negotiation.seller?.name ?? negotiation.buyer.name}.`,
          }),
    onMutate: () =>
      setFeedback({
        type: "loading",
        message: "Enregistrement de la relance…",
      }),
    onSuccess: (payload) => {
      setFeedback({
        type: "success",
        message: payload.message ?? "Relance enregistrée.",
      });
      void queryClient.invalidateQueries({
        queryKey: ["commercial-negotiations"],
      });
    },
    onError: (error) =>
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Relance impossible.",
      }),
  });

  const clientReminderMutation = useMutation({
    mutationFn: async (negotiation: CommercialNegotiation) => {
      const recipientRole = negotiationReminderRecipient(
        negotiation.status,
        Boolean(negotiation.seller),
      );
      if (!recipientRole) {
        throw new Error(
          "Aucun destinataire ne correspond à l'attente actuelle de cette négociation.",
        );
      }
      const recipientName =
        recipientRole === "SELLER"
          ? negotiation.seller?.name
          : negotiation.buyer.name;
      return demoMode
        ? {
            success: true,
            message: "Relance client simulée dans l'aperçu Figma.",
          }
        : mutateNegotiation({
            action: "client-reminder",
            negotiationId: negotiation.id,
            recipientRole,
            channel: "EMAIL",
            subject: `Suivi de votre négociation · ${negotiation.property.title}`,
            message: `Bonjour ${recipientName}, nous revenons vers vous concernant la négociation en cours pour ${negotiation.property.title}. Merci de nous indiquer vos disponibilités pour faire le point.`,
          });
    },
    onMutate: () =>
      setFeedback({ type: "loading", message: "Tentative de relance client…" }),
    onSuccess: (payload) => {
      setFeedback({
        type: "success",
        message: payload.message ?? "Relance client envoyée.",
      });
      void queryClient.invalidateQueries({
        queryKey: ["commercial-negotiations"],
      });
    },
    onError: (error) =>
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Relance client non envoyée.",
      }),
  });

  return (
    <div className="grid gap-7">
      <CommercialPageHeader
        title="Espace de Négociation"
        description="Suivi centralisé de toutes les négociations actives entre acquéreurs et vendeurs"
        action={
          <Link
            href="/commercial/offres/nouvelle"
            className={commercialPrimaryButton}
          >
            <Plus className="size-4" />
            Nouvelle offre
          </Link>
        }
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DataSourceNotice demo={demoMode} />
        <CommercialSyncStatus state={sync} />
      </div>
      <StatCards
        items={[
          { label: "Négociations actives", value: kpis.active },
          {
            label: "En attente réponse",
            value: kpis.awaitingResponse,
            tone: "warning",
          },
          {
            label: "Action requise",
            value: kpis.actionRequired,
            tone: "danger",
          },
          {
            label: "Acceptées ce mois",
            value: kpis.acceptedThisMonth,
            tone: "success",
          },
          {
            label: "Écart moyen",
            value:
              kpis.averageGap == null ? "—" : kpis.averageGap.toFixed(1) + " %",
          },
          { label: "Volume total", value: formatPrice(kpis.totalVolume) },
        ]}
      />
      <div className="grid gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {hubTabs.map((tab, index) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveTab(index)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold",
                activeTab === index
                  ? "border-[#17221e] bg-[#17221e] text-white"
                  : "border-[#dfddd4] bg-[#fbfaf7]",
              )}
            >
              {tab.label}{" "}
              <span className="opacity-65">
                (
                {
                  rows.filter(
                    (row) => !tab.statuses || tab.statuses.includes(row.status),
                  ).length
                }
                )
              </span>
            </button>
          ))}
        </div>
        <CommercialPanel className="p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="relative">
              <span className="sr-only">Filtrer par conseiller</span>
              <select
                value={responsible}
                onChange={(event) => setResponsible(event.target.value)}
                className={cn(fieldClass, "appearance-none pr-10")}
              >
                <option value="all">Conseiller · Tous</option>
                {responsibles.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
            </label>
            <label className="relative">
              <span className="sr-only">Filtrer par secteur</span>
              <select
                value={sector}
                onChange={(event) => setSector(event.target.value)}
                className={cn(fieldClass, "appearance-none pr-10")}
              >
                <option value="all">Secteur · Tous</option>
                {sectors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
            </label>
            <button
              type="button"
              onClick={() => {
                setResponsible("all");
                setSector("all");
                setActiveTab(0);
              }}
              className={commercialSecondaryButton}
            >
              <RefreshCw className="size-4" />
              Réinitialiser les filtres
            </button>
          </div>
        </CommercialPanel>
      </div>
      {query.isLoading ? (
        <CommercialPanel className="p-6">
          <BentoCardSkeleton lines={5} />
        </CommercialPanel>
      ) : null}
      {query.error ? (
        <BentoErrorState
          message={
            query.error instanceof Error
              ? query.error.message
              : "Chargement impossible."
          }
        />
      ) : null}
      {!query.isLoading && !query.error ? (
        <div className="grid gap-4">
          {filtered.map((negotiation) => (
            <NegotiationCard
              key={negotiation.id}
              negotiation={negotiation}
              demoMode={demoMode}
              onCounter={() => setSelected(negotiation)}
              onRemind={() => remindMutation.mutate(negotiation)}
              onClientRemind={() => clientReminderMutation.mutate(negotiation)}
            />
          ))}
        </div>
      ) : null}
      {!query.isLoading && !query.error && !filtered.length ? (
        <BentoEmptyState
          title="Aucune négociation dans cette vue"
          description="Modifiez les filtres ou créez une offre pour démarrer un nouveau cycle."
          icon={<Handshake className="size-5" />}
        />
      ) : null}
      {urgentRows.length ? (
        <CommercialPanel className="border-[#ecc0bb] bg-[#fff3ef] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#a94d43]" />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-[#8c3e35]">
                {urgentRows.length} négociation
                {urgentRows.length > 1 ? "s arrivent" : " arrive"} à échéance
                dans les 48h
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {urgentRows.map((row) => (
                  <Link
                    key={row.id}
                    href={
                      demoMode
                        ? "/crm-riviera-commercial-preview?screen=negotiation-detail"
                        : `/commercial/negociations/${row.id}`
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#8c3e35] shadow-sm"
                  >
                    {row.property.title}
                    <ArrowRight className="size-3.5" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </CommercialPanel>
      ) : null}
      {selected ? (
        <CounterOfferDialog
          negotiation={selected}
          demoMode={demoMode}
          onClose={() => setSelected(null)}
          onSuccess={(message) => {
            setSelected(null);
            setFeedback({ type: "success", message });
            void queryClient.invalidateQueries({
              queryKey: ["commercial-negotiations"],
            });
          }}
        />
      ) : null}
      <CommercialFeedback state={feedback} />
    </div>
  );
}

function DecisionDialog({
  negotiation,
  decision,
  demoMode,
  onClose,
  onSuccess,
}: {
  negotiation: CommercialNegotiation;
  decision: "ACCEPTED" | "REJECTED";
  demoMode: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [comment, setComment] = useState("");
  const mutation = useMutation({
    mutationFn: async () =>
      demoMode
        ? {
            success: true,
            message:
              decision === "ACCEPTED"
                ? "Offre acceptée dans l'aperçu Figma."
                : "Offre refusée dans l'aperçu Figma.",
          }
        : mutateNegotiation({
            action: "decision",
            negotiationId: negotiation.id,
            decision,
            comment,
          }),
    onSuccess: (payload) =>
      onSuccess(payload.message ?? "Décision enregistrée."),
  });
  const rejecting = decision === "REJECTED";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#17221e]/65 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-3xl bg-[#fbfaf7] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {rejecting ? "Refuser l'offre" : "Accepter l'offre"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-9 place-items-center rounded-full bg-[#eef1eb]"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#66706b]">
          Cette décision synchronisera également le statut de l&apos;offre liée.{" "}
          {rejecting
            ? "Le motif sera conservé dans l'historique."
            : "Le montant courant deviendra le montant final."}
        </p>
        <div className="mt-5">
          <FieldLabel htmlFor="decision-comment">
            {rejecting ? "Motif du refus" : "Commentaire (optionnel)"}
          </FieldLabel>
          <textarea
            id="decision-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className={cn(fieldClass, "min-h-24 py-3")}
          />
        </div>
        {mutation.error ? (
          <div className="mt-4">
            <BentoErrorState
              message={
                mutation.error instanceof Error
                  ? mutation.error.message
                  : "Décision impossible."
              }
            />
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={commercialSecondaryButton}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending || (rejecting && comment.trim().length < 3)
            }
            className={
              rejecting
                ? cn(
                    commercialSecondaryButton,
                    "border-[#a94d43] text-[#943f37]",
                  )
                : commercialPrimaryButton
            }
          >
            {mutation.isPending ? (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            ) : decision === "ACCEPTED" ? (
              <Check className="size-4" />
            ) : (
              <X className="size-4" />
            )}
            {rejecting ? "Confirmer le refus" : "Confirmer l'acceptation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentUploadButton({
  negotiationId,
  demoMode,
  onSuccess,
  onError,
}: {
  negotiationId: string;
  demoMode: boolean;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      if (demoMode)
        return {
          success: true,
          message: "Upload désactivé dans l'aperçu Figma.",
        };
      const formData = new FormData();
      formData.set("negotiationId", negotiationId);
      formData.set("documentType", "OTHER");
      formData.set("file", file);
      const response = await fetch(
        "/api/admin/commercial/negotiations/documents",
        { method: "POST", body: formData },
      );
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!response.ok || !payload?.success)
        throw new Error(payload?.message ?? "Upload impossible.");
      return payload;
    },
    onSuccess: (payload) => onSuccess(payload.message ?? "Document ajouté."),
    onError: (error) =>
      onError(error instanceof Error ? error.message : "Upload impossible."),
  });
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        aria-label="Fichier de négociation"
        accept="application/pdf,image/jpeg,image/png"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) mutation.mutate(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={demoMode || mutation.isPending}
        title={
          demoMode
            ? "Upload disponible dans le module authentifié"
            : "Ajouter un document privé"
        }
        className="grid size-9 place-items-center rounded-lg border border-[#dfddd4] disabled:opacity-50"
        aria-label="Ajouter un document"
      >
        {mutation.isPending ? (
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Upload className="size-4" />
        )}
      </button>
    </>
  );
}

export function NegotiationDetailScreen({
  id,
  demoMode = false,
  initialData,
}: {
  id: string;
  demoMode?: boolean;
  initialData?: NegotiationsPayload;
}) {
  const queryClient = useQueryClient();
  const [counterOpen, setCounterOpen] = useState(false);
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED" | null>(
    null,
  );
  const [feedback, setFeedback] = useState<Feedback>(null);
  const query = useQuery({
    queryKey: ["commercial-negotiations", id],
    queryFn: ({ signal }) => getNegotiations(id, signal),
    enabled: !demoMode,
    initialData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const sync = useCommercialLiveSync({
    enabled: !demoMode,
    endpoint: "/api/admin/commercial/negotiations/realtime",
    paused: counterOpen || Boolean(decision) || feedback?.type === "loading",
    refresh: async () => {
      await query.refetch({ throwOnError: true });
      await queryClient.invalidateQueries({ queryKey: ["commercial-negotiations", "sidebar-count"], exact: true });
    },
    cancel: () => queryClient.cancelQueries({ queryKey: ["commercial-negotiations", id], exact: true }),
  });
  if (query.isLoading)
    return (
      <CommercialPanel className="p-6">
        <BentoCardSkeleton lines={8} />
      </CommercialPanel>
    );
  if (query.error)
    return (
      <BentoErrorState
        message={
          query.error instanceof Error
            ? query.error.message
            : "Chargement impossible."
        }
      />
    );
  const negotiation = query.data?.data[0];
  if (!negotiation)
    return (
      <BentoEmptyState
        title="Négociation introuvable"
        description="Elle a peut-être été clôturée ou supprimée."
      />
    );
  const meta = statusMeta[negotiation.status];
  const refresh = (message: string) => {
    setFeedback({ type: "success", message });
    setCounterOpen(false);
    setDecision(null);
    void queryClient.invalidateQueries({
      queryKey: ["commercial-negotiations"],
    });
  };

  return (
    <div className="grid gap-6">
      <Link
        href={
          demoMode
            ? "/crm-riviera-commercial-preview?screen=negotiations"
            : "/commercial/negociations"
        }
        className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-[#53615a]"
      >
        <ArrowLeft className="size-4" />
        Retour au hub
      </Link>
      <CommercialPageHeader
        title={`Négociation — ${negotiation.property.title}`}
        description={`Offre ${negotiation.property.reference ? `· Réf. ${negotiation.property.reference}` : "liée au dossier commercial"}`}
        action={
          <>
            <CommercialBadge tone={negotiation.isUrgent ? "danger" : meta.tone}>
              {meta.label}
            </CommercialBadge>
            <Link
              href={`/commercial/offres/${negotiation.offerId}`}
              className={commercialSecondaryButton}
            >
              Voir l&apos;offre
              <ArrowRight className="size-4" />
            </Link>
            {!demoMode && negotiation.buyer.id ? (
              <Link
                href={`/admin?tab=contacts&contact=${encodeURIComponent(negotiation.buyer.id)}`}
                className={commercialSecondaryButton}
              >
                <UserRound className="size-4" />
                Ouvrir l&apos;acquéreur
              </Link>
            ) : null}
            {!demoMode && negotiation.property.id ? (
              <Link
                href={`/admin?tab=properties&property=${encodeURIComponent(negotiation.property.id)}`}
                className={commercialSecondaryButton}
              >
                <MapPin className="size-4" />
                Ouvrir le bien
              </Link>
            ) : null}
          </>
        }
      />
      <div className="flex flex-wrap justify-end gap-2">
        <DataSourceNotice demo={demoMode} />
        <CommercialSyncStatus state={sync} />
      </div>
      <CommercialPanel className="p-5">
        <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1.2fr_auto_1fr]">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-[#dce5d7] font-bold">
              <UserRound className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-medium uppercase text-[#59645f]">
                Acquéreur
              </p>
              <p className="mt-1 font-bold">{negotiation.buyer.name}</p>
            </div>
          </div>
          <span className="hidden text-xl text-[#89918d] md:block">↔</span>
          <div className="flex items-center gap-3 md:justify-center">
            <div className="relative size-14 overflow-hidden rounded-xl bg-[#dce5d7]">
              {negotiation.property.imageUrl ? (
                <Image
                  src={negotiation.property.imageUrl}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <Handshake className="absolute inset-0 m-auto size-5" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase text-[#59645f]">
                Bien
              </p>
              <p className="mt-1 font-bold">{negotiation.property.title}</p>
              <p className="text-xs text-[#66706b]">
                {negotiation.property.city}
              </p>
            </div>
          </div>
          <span className="hidden text-xl text-[#89918d] md:block">↔</span>
          <div className="flex items-center gap-3 md:justify-end">
            <AgentAvatar name={negotiation.responsible.name} size="lg" />
            <div>
              <p className="text-[10px] font-medium uppercase text-[#59645f]">
                Mandataire
              </p>
              <p className="mt-1 font-bold">{negotiation.responsible.name}</p>
            </div>
          </div>
        </div>
      </CommercialPanel>
      <CommercialPanel className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Étapes de la négociation</h2>
            <p className="mt-1 text-xs text-[#66706b]">
              Étape {negotiation.currentStep} sur {negotiation.totalSteps}
            </p>
          </div>
          <History className="size-5 text-[#66706b]" />
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {Array.from({ length: negotiation.totalSteps }).map((_, index) => {
            const step = negotiation.steps.find(
              (item) => item.stepNumber === index + 1,
            );
            const current = index + 1 === negotiation.currentStep;
            const future = index + 1 > negotiation.currentStep;
            return (
              <div
                key={index}
                className={cn(
                  "rounded-xl border p-4",
                  current
                    ? "border-[#2f493a] bg-[#2f493a] text-white"
                    : future
                      ? "border-[#e6e4de] bg-[#f4f3ef] text-[#5f6964]"
                      : "border-[#dfddd4]",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full text-xs font-bold",
                      current
                        ? "bg-[#2f493a] text-white"
                        : future
                          ? "bg-[#e0e2de]"
                          : "bg-[#dce5d7] text-[#2f493a]",
                    )}
                  >
                    {!future && !current ? (
                      <Check className="size-4" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {current ? (
                    <CommercialBadge tone="success">Courante</CommercialBadge>
                  ) : null}
                </div>
                <p className="mt-4 text-sm font-bold">
                  {step?.label ?? (future ? "Étape à venir" : "Étape réalisée")}
                </p>
                <p className="mt-2 text-xs">
                  {step?.amount
                    ? formatPrice(step.amount)
                    : "Montant à définir"}
                </p>
                <p className="mt-2 text-[10px]">
                  {step ? relativeTime(step.createdAt) : "En attente"}
                </p>
              </div>
            );
          })}
        </div>
      </CommercialPanel>
      {!(
        ["ACCEPTED", "REJECTED", "EXPIRED", "CONCLUDED"] as NegotiationStatus[]
      ).includes(negotiation.status) ? (
        <CommercialPanel className="border-[#9bae9c] bg-[#dce5d7] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6553]">
                Action requise
              </p>
              <h2 className="mt-2 text-lg font-bold">
                Une décision ou une nouvelle proposition est attendue
              </h2>
              <p className="mt-1 text-sm text-[#59645f]">
                Montant courant : {formatPrice(negotiation.currentAmount)} ·
                Échéance : {formatDate(negotiation.responseDeadline)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDecision("ACCEPTED")}
                className={commercialPrimaryButton}
              >
                <Check className="size-4" />
                Accepter l&apos;offre
              </button>
              <button
                type="button"
                onClick={() => setCounterOpen(true)}
                className={commercialSecondaryButton}
              >
                <MessageSquareText className="size-4" />
                Contre-proposition
              </button>
              <button
                type="button"
                onClick={() => setDecision("REJECTED")}
                className={cn(commercialSecondaryButton, "text-[#943f37]")}
              >
                <X className="size-4" />
                Refuser
              </button>
            </div>
          </div>
        </CommercialPanel>
      ) : null}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CommercialPanel className="p-6">
          <h2 className="text-lg font-bold">Historique des échanges</h2>
          {negotiation.exchanges.length ? (
            <div className="mt-6 grid gap-0">
              {negotiation.exchanges.map((exchange, index) => (
                <div
                  key={exchange.id}
                  className="grid grid-cols-[28px_1fr] gap-3"
                >
                  <div className="flex flex-col items-center">
                    <span className="mt-1 size-2.5 rounded-full bg-[#4d7a5c] ring-4 ring-[#edf4ea]" />
                    {index < negotiation.exchanges.length - 1 ? (
                      <span className="h-full min-h-24 w-px bg-[#cbd4c8]" />
                    ) : null}
                  </div>
                  <div className="mb-5 rounded-xl border border-[#dfddd4] p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[10px] font-medium uppercase text-[#59645f]">
                          {relativeTime(exchange.createdAt)}
                          {exchange.authorName
                            ? ` · ${exchange.authorName}`
                            : ""}
                        </p>
                        <p className="mt-2 text-sm font-bold">
                          {exchange.type}
                        </p>
                      </div>
                      {exchange.amount ? (
                        <p className="text-lg font-bold text-[#2f493a]">
                          {formatPrice(exchange.amount)}
                        </p>
                      ) : null}
                    </div>
                    {exchange.comment ? (
                      <p className="mt-3 text-sm leading-6 text-[#65706a]">
                        {exchange.comment}
                      </p>
                    ) : null}
                    {exchange.isInternalNote ? (
                      <CommercialBadge tone="neutral" className="mt-3">
                        Note interne
                      </CommercialBadge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <BentoEmptyState
              title="Aucun échange historisé"
              description="La prochaine action alimentera automatiquement cette chronologie."
            />
          )}
        </CommercialPanel>
        <div className="grid gap-5 xl:sticky xl:top-24">
          <CommercialPanel className="p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <CircleDollarSign className="size-5" />
              Résumé des montants
            </h2>
            <dl className="mt-5 grid gap-4">
              <div className="flex items-center justify-between">
                <dt className="text-xs text-[#66706b]">Prix demandé</dt>
                <dd className="font-semibold">
                  {formatPrice(negotiation.askingPrice)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-[#66706b]">Offre actuelle</dt>
                <dd className="text-lg font-bold text-[#2f493a]">
                  {formatPrice(negotiation.currentAmount)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-[#dfddd4] pt-4">
                <dt className="text-xs text-[#66706b]">Écart</dt>
                <dd className="font-bold">
                  {negotiation.currentGapPercent.toFixed(1).replace(".", ",")} %
                </dd>
              </div>
            </dl>
          </CommercialPanel>
          <CommercialPanel className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <FileText className="size-5" />
                Documents associés
              </h2>
              <DocumentUploadButton
                negotiationId={negotiation.id}
                demoMode={demoMode}
                onSuccess={refresh}
                onError={(message) => setFeedback({ type: "error", message })}
              />
            </div>
            {negotiation.documents.length ? (
              <div className="mt-4 grid gap-2">
                {negotiation.documents.map((document) => (
                  <a
                    key={document.id}
                    href={`/api/admin/commercial/negotiations/documents?id=${encodeURIComponent(document.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-[#f4f3ef] p-3 transition hover:bg-[#e8ece5]"
                  >
                    <p className="truncate text-xs font-semibold">
                      {document.fileName}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-[#59645f]">
                      {document.documentType ?? document.mimeType ?? "Document"}
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs leading-5 text-[#66706b]">
                Aucun document joint à cette négociation.
              </p>
            )}
          </CommercialPanel>
          <CommercialPanel className="p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <UsersRound className="size-5" />
              Financement
            </h2>
            <dl className="mt-4 grid gap-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[#66706b]">Type</dt>
                <dd className="font-semibold">{negotiation.financingType}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#66706b]">Apport</dt>
                <dd className="font-semibold">
                  {negotiation.downPaymentAmount == null
                    ? "Non renseigné"
                    : formatPrice(negotiation.downPaymentAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#66706b]">Emprunt</dt>
                <dd className="font-semibold">
                  {negotiation.loanAmount == null
                    ? "Non renseigné"
                    : formatPrice(negotiation.loanAmount)}
                </dd>
              </div>
            </dl>
            {negotiation.suspensiveConditions ? (
              <div className="mt-4 border-t border-[#dfddd4] pt-4">
                <p className="text-[10px] font-medium uppercase text-[#59645f]">
                  Conditions suspensives
                </p>
                <p className="mt-2 text-xs leading-5">
                  {negotiation.suspensiveConditions}
                </p>
              </div>
            ) : null}
          </CommercialPanel>
        </div>
      </div>
      {counterOpen ? (
        <CounterOfferDialog
          negotiation={negotiation}
          demoMode={demoMode}
          onClose={() => setCounterOpen(false)}
          onSuccess={refresh}
        />
      ) : null}
      {decision ? (
        <DecisionDialog
          negotiation={negotiation}
          decision={decision}
          demoMode={demoMode}
          onClose={() => setDecision(null)}
          onSuccess={refresh}
        />
      ) : null}
      <CommercialFeedback state={feedback} />
    </div>
  );
}

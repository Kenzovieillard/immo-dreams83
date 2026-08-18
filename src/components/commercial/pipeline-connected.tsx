"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  ExternalLink,
  FileSignature,
  GripVertical,
  ListChecks,
  Plus,
  RotateCcw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  BentoEmptyState,
  BentoErrorState,
} from "@/components/admin/bento/bento-states";
import {
  CommercialBadge,
  CommercialFeedback,
  CommercialPageHeader,
  CommercialPanel,
  DataSourceNotice,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import type {
  CommercialPipelineCard,
  CommercialPipelinePayload,
  CommercialPipelineStage,
} from "@/types/commercial";

type ResponsePayload = CommercialPipelinePayload & {
  success: boolean;
  message?: string;
};
type Feedback = {
  type: "loading" | "success" | "error";
  message: string;
} | null;

const columns: Array<{ stage: CommercialPipelineStage; label: string }> = [
  { stage: "BUYER_NEW", label: "Nouveaux acquéreurs" },
  { stage: "BUYER_QUALIFIED", label: "Qualifiés" },
  { stage: "BUYER_VISIT", label: "Visites" },
  { stage: "BUYER_OFFER", label: "Offres" },
  { stage: "BUYER_COMPROMISE", label: "Compromis" },
  { stage: "BUYER_FINALIZED", label: "Finalisés" },
  { stage: "SELLER_NEW", label: "Nouveaux vendeurs" },
  { stage: "SELLER_CONTACT", label: "Contactés" },
  { stage: "SELLER_ESTIMATE_SCHEDULED", label: "Estimation planifiée" },
  { stage: "SELLER_ESTIMATE_DONE", label: "Estimation faite" },
  { stage: "SELLER_MANDATE_PROPOSED", label: "Mandat proposé" },
  { stage: "SELLER_MANDATE_SIGNED", label: "Mandat signé" },
  { stage: "SELLER_MARKETED", label: "Commercialisés" },
];

async function fetchPipeline() {
  const response = await fetch("/api/admin/commercial/pipeline", {
    cache: "no-store",
  });
  const payload = (await response
    .json()
    .catch(() => null)) as ResponsePayload | null;
  if (!response.ok || !payload?.success)
    throw new Error(payload?.message ?? "Pipeline indisponible.");
  return payload;
}

async function mutatePipeline(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/commercial/pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    id?: string;
  } | null;
  if (!response.ok || !payload?.success)
    throw new Error(payload?.message ?? "Action impossible.");
  return payload;
}

function Card({
  card,
  onSelect,
  onDragStart,
}: {
  card: CommercialPipelineCard;
  onSelect: () => void;
  onDragStart: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      className="cursor-pointer rounded-xl border border-[#dfddd4] bg-white p-3 shadow-sm transition hover:border-[#aeb8b1] hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-[#8b928e]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {card.contactName ?? card.dossierReference}
          </p>
          <p className="mt-0.5 truncate text-xs text-[#69736e]">
            {card.propertyTitle ??
              card.estimationLabel ??
              "Aucune relation immobilière"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <CommercialBadge
          tone={
            card.isBlocked
              ? "danger"
              : card.priority === "urgent"
                ? "warning"
                : "neutral"
          }
        >
          {card.isBlocked ? "Bloqué" : card.priority}
        </CommercialBadge>
        {card.nextAction ? (
          <CommercialBadge tone="info">{card.nextAction.title}</CommercialBadge>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-[#69736e]">
        <span>{card.assignedToName ?? "Non assigné"}</span>
        <span>{card.dossierReference}</span>
      </div>
    </article>
  );
}

export function CommercialPipelineConnected({
  initialData,
  initialSelectedId = null,
}: {
  initialData: CommercialPipelinePayload;
  initialSelectedId?: string | null;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["commercial", "pipeline"],
    queryFn: fetchPipeline,
    initialData: { success: true, ...initialData },
    refetchInterval: 15_000,
  });
  const data = query.data;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [teamView, setTeamView] = useState(false);
  const [filters, setFilters] = useState({
    type: "ALL",
    agent: "ALL",
    priority: "ALL",
    status: "ALL",
    period: "ALL",
  });
  const selected = data.cards.find((card) => card.id === selectedId) ?? null;
  const filtered = useMemo(
    () =>
      data.cards.filter((card) => {
        if (filters.type !== "ALL" && card.pipelineType !== filters.type)
          return false;
        if (
          filters.agent !== "ALL" &&
          (card.assignedTo ?? "UNASSIGNED") !== filters.agent
        )
          return false;
        if (filters.priority !== "ALL" && card.priority !== filters.priority)
          return false;
        if (filters.status === "BLOCKED" && !card.isBlocked) return false;
        if (filters.status === "ACTIVE" && card.isBlocked) return false;
        if (filters.period !== "ALL") {
          const days = Number(filters.period);
          if (
            new Date(card.updatedAt).getTime() <
            new Date(data.generatedAt).getTime() - days * 86400000
          )
            return false;
        }
        return true;
      }),
    [data.cards, data.generatedAt, filters],
  );

  async function moveCard(stage: CommercialPipelineStage) {
    if (!draggedId) return;
    const card = data.cards.find((item) => item.id === draggedId);
    setDraggedId(null);
    if (
      !card ||
      card.stage === stage ||
      card.pipelineType !== (stage.startsWith("SELLER_") ? "SELLER" : "BUYER")
    )
      return;
    const previous = queryClient.getQueryData<ResponsePayload>([
      "commercial",
      "pipeline",
    ]);
    queryClient.setQueryData<ResponsePayload>(
      ["commercial", "pipeline"],
      (current) =>
        current
          ? {
              ...current,
              cards: current.cards.map((item) =>
                item.id === card.id
                  ? { ...item, stage, updatedAt: new Date().toISOString() }
                  : item,
              ),
            }
          : current,
    );
    setFeedback({ type: "loading", message: "Déplacement en cours…" });
    try {
      await mutatePipeline({ action: "move-stage", id: card.id, stage });
      await query.refetch();
      setFeedback({
        type: "success",
        message: "Étape enregistrée dans Supabase.",
      });
    } catch (error) {
      if (previous)
        queryClient.setQueryData(["commercial", "pipeline"], previous);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Déplacement annulé.",
      });
    }
  }

  async function submitCase(form: FormData) {
    setFeedback({ type: "loading", message: "Création du dossier…" });
    try {
      const result = await mutatePipeline({
        action: "create-case",
        contactId: form.get("contactId"),
        pipelineType: form.get("pipelineType"),
        assignedTo: form.get("assignedTo") || null,
        propertyId: form.get("propertyId") || null,
        estimationId: form.get("estimationId") || null,
        priority: form.get("priority"),
        title: form.get("title"),
        notes: form.get("notes") || null,
      });
      setCreateOpen(false);
      await query.refetch();
      setSelectedId(result.id ?? null);
      setFeedback({ type: "success", message: "Dossier créé." });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Création impossible.",
      });
    }
  }

  async function submitTask(form: FormData) {
    if (!selected) return;
    setFeedback({ type: "loading", message: "Création de la tâche…" });
    try {
      await mutatePipeline({
        action: "create-task",
        leadId: selected.id,
        title: form.get("title"),
        description: form.get("description") || null,
        dueAt: form.get("dueAt")
          ? new Date(String(form.get("dueAt"))).toISOString()
          : null,
        priority: form.get("priority"),
        assignedTo: selected.assignedTo,
      });
      await query.refetch();
      setFeedback({ type: "success", message: "Tâche persistée." });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Tâche impossible.",
      });
    }
  }

  async function taskAction(
    id: string,
    action: "complete" | "reopen" | "archive",
  ) {
    setFeedback({ type: "loading", message: "Mise à jour de la tâche…" });
    try {
      await mutatePipeline(
        action === "archive"
          ? { action: "archive-task", id }
          : {
              action: "update-task",
              id,
              status: action === "complete" ? "COMPLETED" : "TODO",
            },
      );
      await query.refetch();
      setFeedback({ type: "success", message: "Tâche mise à jour." });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Mise à jour impossible.",
      });
    }
  }

  async function createMandate(form: FormData) {
    if (!selected?.propertyId) return;
    setFeedback({ type: "loading", message: "Création du mandat…" });
    try {
      await mutatePipeline({
        action: "create-mandate",
        leadId: selected.id,
        propertyId: selected.propertyId,
        mandateType: form.get("mandateType"),
        status: form.get("status"),
      });
      await query.refetch();
      setFeedback({ type: "success", message: "Mandat créé." });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Mandat impossible.",
      });
    }
  }

  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        eyebrow="CRM Commercial"
        title="Pipeline"
        description="Dossiers acquéreurs et vendeurs synchronisés avec Supabase."
        action={
          <>
            <DataSourceNotice demo={false} />
            <button
              className={commercialSecondaryButton}
              onClick={() => setTeamView((value) => !value)}
            >
              <Users className="size-4" />
              Vue équipe
            </button>
            {data.permissions.canWrite ? (
              <button
                className={commercialPrimaryButton}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" />
                Nouveau dossier
              </button>
            ) : null}
          </>
        }
      />
      {query.error ? <BentoErrorState message={query.error.message} /> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CommercialPanel className="p-4">
          <p className="text-xs text-[#69736e]">Dossiers</p>
          <p className="mt-1 text-2xl font-bold">{data.stats.total}</p>
        </CommercialPanel>
        <CommercialPanel className="p-4">
          <p className="text-xs text-[#69736e]">Bloqués</p>
          <p className="mt-1 text-2xl font-bold">{data.stats.blocked}</p>
        </CommercialPanel>
        <CommercialPanel className="p-4 md:col-span-2">
          <p className="text-xs text-[#69736e]">Valeur estimée</p>
          <p className="mt-1 text-2xl font-bold">
            {data.stats.estimatedValue.toLocaleString("fr-FR")} €
          </p>
        </CommercialPanel>
      </div>
      <CommercialPanel className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <select
          className={fieldClass}
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="ALL">Tous les types</option>
          <option value="BUYER">Acquéreurs</option>
          <option value="SELLER">Vendeurs</option>
        </select>
        <select
          className={fieldClass}
          value={filters.agent}
          onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
        >
          <option value="ALL">Tous les agents</option>
          <option value="UNASSIGNED">Non assigné</option>
          {data.options.profiles.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
        >
          <option value="ALL">Toutes priorités</option>
          {["low", "normal", "high", "urgent"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="ALL">Tous les statuts</option>
          <option value="ACTIVE">Actifs</option>
          <option value="BLOCKED">Bloqués</option>
        </select>
        <select
          className={fieldClass}
          value={filters.period}
          onChange={(e) => setFilters({ ...filters, period: e.target.value })}
        >
          <option value="ALL">Toutes périodes</option>
          <option value="7">7 jours</option>
          <option value="30">30 jours</option>
          <option value="90">90 jours</option>
        </select>
      </CommercialPanel>
      {teamView ? (
        <CommercialPanel className="overflow-x-auto p-4">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Conseiller</th>
                <th className="p-2">Dossiers</th>
                <th className="p-2">Bloqués</th>
                <th className="p-2">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {data.team.map((row) => (
                <tr
                  key={row.profileId ?? "none"}
                  className="border-b last:border-0"
                >
                  <td className="p-2 font-semibold">{row.name}</td>
                  <td className="p-2">{row.dossierCount}</td>
                  <td className="p-2">{row.blockedCount}</td>
                  <td className="p-2">
                    {row.estimatedValue.toLocaleString("fr-FR")} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CommercialPanel>
      ) : null}
      {filtered.length === 0 ? (
        <BentoEmptyState
          title="Aucun dossier"
          description="Aucun dossier réel ne correspond aux filtres."
        />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-3">
            {columns.map((column) => {
              const cards = filtered.filter(
                (card) => card.stage === column.stage,
              );
              return (
                <section
                  key={column.stage}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveCard(column.stage)}
                  className="w-[280px] shrink-0 rounded-2xl border border-[#dfddd4] bg-[#f1efe9] p-3"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold">{column.label}</h2>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold">
                      {cards.length}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {cards.map((card) => (
                      <Card
                        key={card.id}
                        card={card}
                        onSelect={() => setSelectedId(card.id)}
                        onDragStart={() => setDraggedId(card.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4">
          <CommercialPanel className="w-full max-w-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Nouveau dossier</h2>
              <button onClick={() => setCreateOpen(false)}>
                <X />
              </button>
            </div>
            <form
              action={submitCase}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <select required name="contactId" className={fieldClass}>
                <option value="">Contact réel…</option>
                {data.options.contacts.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.email}
                  </option>
                ))}
              </select>
              <select name="pipelineType" className={fieldClass}>
                <option value="BUYER">Acquéreur</option>
                <option value="SELLER">Vendeur</option>
              </select>
              <select name="assignedTo" className={fieldClass}>
                <option value="">Agent connecté</option>
                {data.options.profiles.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              <select name="priority" className={fieldClass}>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
                <option value="low">Basse</option>
              </select>
              <select name="propertyId" className={fieldClass}>
                <option value="">Aucun bien</option>
                {data.options.properties.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.reference} · {row.title}
                  </option>
                ))}
              </select>
              <select name="estimationId" className={fieldClass}>
                <option value="">Aucune estimation</option>
                {data.options.estimations.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
              <input
                required
                minLength={2}
                name="title"
                className={`${fieldClass} sm:col-span-2`}
                placeholder="Intitulé du dossier"
              />
              <textarea
                name="notes"
                className={`${fieldClass} min-h-24 sm:col-span-2`}
                placeholder="Notes factuelles"
              />
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  className={commercialSecondaryButton}
                  onClick={() => setCreateOpen(false)}
                >
                  Annuler
                </button>
                <button className={commercialPrimaryButton}>Créer</button>
              </div>
            </form>
          </CommercialPanel>
        </div>
      ) : null}

      {selected ? (
        <div
          className="fixed inset-0 z-[85] flex justify-end bg-black/35"
          onClick={() => setSelectedId(null)}
        >
          <aside
            className="h-full w-full max-w-xl overflow-y-auto bg-[#fbfaf7] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#69736e]">
                  {selected.dossierReference}
                </p>
                <h2 className="text-2xl font-bold">
                  {selected.contactName ?? "Dossier commercial"}
                </h2>
              </div>
              <button onClick={() => setSelectedId(null)}>
                <X />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {selected.contactId ? (
                <Link
                  className={commercialSecondaryButton}
                  href={`/admin?tab=contacts&contact=${selected.contactId}`}
                >
                  <ExternalLink className="size-4" />
                  Contact
                </Link>
              ) : null}
              {selected.propertyId ? (
                <Link
                  className={commercialSecondaryButton}
                  href={`/admin?tab=properties&property=${selected.propertyId}`}
                >
                  <ExternalLink className="size-4" />
                  Bien
                </Link>
              ) : null}
              {selected.estimationId ? (
                <Link
                  className={commercialSecondaryButton}
                  href={`/commercial/estimations/${selected.estimationId}`}
                >
                  Estimation
                </Link>
              ) : null}
              {selected.visitIds[0] ? (
                <Link
                  className={commercialSecondaryButton}
                  href={`/commercial/visites/${selected.visitIds[0]}`}
                >
                  Visite
                </Link>
              ) : null}
              {selected.offerIds[0] ? (
                <Link
                  className={commercialSecondaryButton}
                  href={`/commercial/offres/${selected.offerIds[0]}`}
                >
                  Offre
                </Link>
              ) : null}
              {selected.negotiationIds[0] ? (
                <Link
                  className={commercialSecondaryButton}
                  href={`/commercial/negociations/${selected.negotiationIds[0]}`}
                >
                  Négociation
                </Link>
              ) : null}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <CommercialPanel className="p-3">
                <p className="text-xs text-[#69736e]">Conseiller</p>
                <p className="font-semibold">
                  {selected.assignedToName ?? "Non assigné"}
                </p>
              </CommercialPanel>
              <CommercialPanel className="p-3">
                <p className="text-xs text-[#69736e]">Dernière activité</p>
                <p className="font-semibold">
                  {selected.lastActivityAt
                    ? new Date(selected.lastActivityAt).toLocaleString("fr-FR")
                    : "Aucune"}
                </p>
              </CommercialPanel>
            </div>
            <section className="mt-7">
              <h3 className="flex items-center gap-2 font-bold">
                <ListChecks className="size-4" />
                Tâches persistées
              </h3>
              <div className="mt-3 grid gap-2">
                {selected.tasks
                  .filter((task) => task.status !== "CANCELLED")
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 rounded-lg border bg-white p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={
                            task.status === "COMPLETED"
                              ? "line-through opacity-60"
                              : "font-semibold"
                          }
                        >
                          {task.title}
                        </p>
                        <p className="text-xs text-[#69736e]">
                          {task.dueAt
                            ? new Date(task.dueAt).toLocaleString("fr-FR")
                            : "Sans échéance"}
                        </p>
                      </div>
                      {task.status === "COMPLETED" ? (
                        <button
                          title="Rouvrir"
                          onClick={() => taskAction(task.id, "reopen")}
                        >
                          <RotateCcw className="size-4" />
                        </button>
                      ) : (
                        <button
                          title="Terminer"
                          onClick={() => taskAction(task.id, "complete")}
                        >
                          <Check className="size-4" />
                        </button>
                      )}
                      <button
                        title="Archiver"
                        onClick={() => taskAction(task.id, "archive")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
              </div>
              {data.permissions.canWrite ? (
                <form action={submitTask} className="mt-3 grid gap-2">
                  <input
                    required
                    name="title"
                    className={fieldClass}
                    placeholder="Nouvelle tâche"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="dueAt"
                      type="datetime-local"
                      className={fieldClass}
                    />
                    <select name="priority" className={fieldClass}>
                      <option value="normal">Normale</option>
                      <option value="high">Haute</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                  <textarea
                    name="description"
                    className={fieldClass}
                    placeholder="Description"
                  />
                  <button className={commercialPrimaryButton}>
                    <Plus className="size-4" />
                    Ajouter la tâche
                  </button>
                </form>
              ) : null}
            </section>
            {selected.pipelineType === "SELLER" &&
            selected.propertyId &&
            data.permissions.canWrite ? (
              <section className="mt-7">
                <h3 className="flex items-center gap-2 font-bold">
                  <FileSignature className="size-4" />
                  Nouveau mandat
                </h3>
                <form
                  action={createMandate}
                  className="mt-3 grid grid-cols-2 gap-2"
                >
                  <select name="mandateType" className={fieldClass}>
                    <option value="exclusive">Exclusif</option>
                    <option value="semi-exclusive">Semi-exclusif</option>
                    <option value="simple">Simple</option>
                  </select>
                  <select name="status" className={fieldClass}>
                    <option value="draft">Brouillon</option>
                    <option value="proposed">Proposé</option>
                    <option value="signed">Signé</option>
                  </select>
                  <button className={`${commercialPrimaryButton} col-span-2`}>
                    <FileSignature className="size-4" />
                    Créer le mandat
                  </button>
                </form>
              </section>
            ) : null}
            <section className="mt-7">
              <h3 className="flex items-center gap-2 font-bold">
                <CalendarDays className="size-4" />
                Historique
              </h3>
              <div className="mt-3 grid gap-2">
                {selected.history.length ? (
                  selected.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="border-l-2 border-[#2f493a] pl-3"
                    >
                      <p className="text-sm font-semibold">{entry.action}</p>
                      <p className="text-xs text-[#69736e]">
                        {entry.actorName} ·{" "}
                        {new Date(entry.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#69736e]">
                    Aucun historique enregistré.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
      <CommercialFeedback state={feedback} />
    </div>
  );
}

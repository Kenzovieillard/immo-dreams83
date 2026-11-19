"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
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
import { CommercialDialog, Person } from "./commercial-design-ui";
import { PipelineTaskEditor } from "./pipeline-task-editor";
import { CommercialSyncStatus, useCommercialLiveSync } from "./use-commercial-live-sync";
import { money, shortDate } from "@/lib/commercial-presentation";
import { reorderPipelineCards } from "@/lib/commercial-pipeline-order";
import { cn } from "@/lib/utils";
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
  { stage: "BUYER_NEW", label: "Nouveau" },
  { stage: "BUYER_QUALIFIED", label: "Qualifié" },
  { stage: "BUYER_VISIT", label: "Visite" },
  { stage: "BUYER_OFFER", label: "Offre" },
  { stage: "BUYER_COMPROMISE", label: "Compromis" },
  { stage: "BUYER_FINALIZED", label: "Finalisé" },
  { stage: "SELLER_NEW", label: "Nouveau" },
  { stage: "SELLER_CONTACT", label: "À contacter" },
  { stage: "SELLER_ESTIMATE_SCHEDULED", label: "Est. planifiée" },
  { stage: "SELLER_ESTIMATE_DONE", label: "Est. réalisée" },
  { stage: "SELLER_MANDATE_PROPOSED", label: "Mandat proposé" },
  { stage: "SELLER_MANDATE_SIGNED", label: "Mandat signé" },
  { stage: "SELLER_MARKETED", label: "Commercialisé" },
];

// Each key press targets an entire column, including empty/off-screen columns.
const columnCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.code))
    return;
  event.preventDefault();
  const { active, over, droppableContainers, droppableRects, collisionRect } =
    context;
  if (!active || !collisionRect) return;
  const enabled = droppableContainers.getEnabled();
  const stage = over?.data.current?.stage ?? active.data.current?.stage;
  if (["ArrowUp", "ArrowDown"].includes(event.code)) {
    const cards = enabled.filter(
      (item) =>
        item.data.current?.kind === "card" &&
        item.data.current?.stage === stage,
    ).sort((a, b) => (droppableRects.get(a.id)?.top ?? 0) - (droppableRects.get(b.id)?.top ?? 0));
    const index = cards.findIndex(
      (item) =>
        item.id === (over?.data.current?.kind === "card" ? over.id : active.id),
    );
    const next = cards[index + (event.code === "ArrowDown" ? 1 : -1)];
    const rect = next && droppableRects.get(next.id);
    if (!rect) return;
    return {
      x: rect.left,
      y: rect.top + (rect.height - collisionRect.height) / 2,
    };
  }
  const available = enabled.filter(
    (item) => item.data.current?.kind === "column",
  );
  const index = available.findIndex((column) => column.id === stage);
  const next = available[index + (event.code === "ArrowRight" ? 1 : -1)];
  const rect = next && droppableRects.get(next.id);
  if (!rect) return;
  return {
    x: rect.left + (rect.width - collisionRect.width) / 2,
    y: rect.top + 65,
  };
};

async function fetchPipeline({ signal }: { signal?: AbortSignal } = {}) {
  const response = await fetch("/api/admin/commercial/pipeline", {
    cache: "no-store",
    signal,
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
  onMove,
  onReorder,
  canMoveUp,
  canMoveDown,
  canWrite,
}: {
  card: CommercialPipelineCard;
  onSelect: () => void;
  onMove: (stage: CommercialPipelineStage) => void;
  onReorder: (direction: "up" | "down") => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canWrite: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: !canWrite,
    data: { stage: card.stage, kind: "card" },
  });
  const drop = useDroppable({
    id: card.id,
    disabled: !canWrite,
    data: { stage: card.stage, kind: "card" },
  });
  const compatibleColumns = columns.filter((column) =>
    card.pipelineType === "SELLER"
      ? column.stage.startsWith("SELLER_")
      : column.stage.startsWith("BUYER_"),
  );
  return (
    <article
      data-card-id={card.id}
      ref={(node) => {
        setNodeRef(node);
        drop.setNodeRef(node);
      }}
      className={cn(
        "relative min-w-0 rounded-lg border bg-[#fbfaf7] p-3 shadow-sm transition hover:shadow-md",
        card.isBlocked ? "border-[#b34d40]" : "border-[#dfddd4]",
        isDragging && "opacity-25",
        drop.isOver && !isDragging && "ring-2 ring-[#5d7d65]",
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-[#2f493a]"
        >
          <h3 className="break-words text-[13px] font-bold">
            {card.contactName ?? card.dossierReference}
          </h3>
        </button>
        {canWrite && (
          <button
            type="button"
            className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded text-[#66716c] hover:bg-[#dce5d7] focus-visible:outline-2 active:cursor-grabbing"
            aria-label={
              "Déplacer " + (card.contactName ?? card.dossierReference)
            }
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="mt-2 block w-full text-left"
      >
        <CommercialBadge
          dot={false}
          className="max-w-full whitespace-normal px-2 py-0.5 text-[10px]"
        >
          {card.pipelineType === "SELLER" ? "Vendeur" : "Acquéreur"}
        </CommercialBadge>
        <p className="mt-3 line-clamp-2 text-xs text-[#66716c]">
          {card.propertyTitle ?? card.estimationLabel ?? "Bien à définir"}
        </p>
        <p className="mt-2 text-sm font-bold">{money(card.amount)}</p>
      </button>
      {card.nextAction && (
        <p className="mt-3 rounded bg-[#dce5d7] px-2 py-1.5 text-[10px] font-medium text-[#2f493a]">
          {card.nextAction.title}
        </p>
      )}
      <div className="mt-4">
        <Person name={card.assignedToName} />
      </div>
      <p className="mt-2 text-[10px] text-[#66716c]">
        Mis à jour {shortDate(card.updatedAt)}
      </p>
      {card.isBlocked && (
        <p className="mt-3 rounded bg-[#f8ded9] p-2 text-[10px] font-semibold text-[#943f37]">
          {card.blockingReason ?? "Dossier bloqué"}
        </p>
      )}
      {canWrite && (
        <details className="mt-3 border-t border-[#dfddd4] pt-2 text-[10px] text-[#66716c]">
          <summary className="cursor-pointer">Déplacer vers…</summary>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onReorder("up")}
              className="rounded border p-2 disabled:opacity-40"
              aria-label="Monter le dossier"
            >
              ↑ Monter
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onReorder("down")}
              className="rounded border p-2 disabled:opacity-40"
              aria-label="Descendre le dossier"
            >
              ↓ Descendre
            </button>
          </div>
          <label className="mt-2 block">
            <span className="sr-only">Nouvelle étape</span>
            <select
              aria-label={
                "Déplacer " +
                (card.contactName ?? card.dossierReference) +
                " vers une autre étape"
              }
              value={card.stage}
              onChange={(event) =>
                onMove(event.target.value as CommercialPipelineStage)
              }
              className="mt-1 w-full rounded-md border border-[#dfddd4] bg-[#fbfaf7] px-2 py-2 text-[11px]"
            >
              {compatibleColumns.map((column) => (
                <option key={column.stage} value={column.stage}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
        </details>
      )}
    </article>
  );
}

function PipelineColumn({
  column,
  cards,
  canWrite,
  onSelect,
  onMove,
  onReorder,
}: {
  column: (typeof columns)[number];
  cards: CommercialPipelineCard[];
  canWrite: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, stage: CommercialPipelineStage) => void;
  onReorder: (
    id: string,
    targetId: string,
    placement: "before" | "after",
  ) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.stage,
    data: { stage: column.stage, kind: "column" },
    disabled: !canWrite,
  });
  return (
    <section
      ref={setNodeRef}
      data-stage={column.stage}
      aria-label={`Étape ${column.label}`}
      className={cn(
        "min-h-[650px] min-w-[165px] flex-1 rounded-xl border p-2 transition-colors",
        isOver
          ? "border-[#5d7d65] bg-[#e7eee4]"
          : column.stage === "BUYER_FINALIZED"
            ? "border-[#c7d8c2] bg-[#ebf3ee]"
            : "border-[#dfddd4] bg-[#f8f7f3]",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold">{column.label}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold">
          {cards.length}
        </span>
      </div>
      <div className="grid gap-2">
        {!cards.length && (
          <p className="rounded-lg border border-dashed border-[#dfddd4] p-3 text-xs text-[#66716c]">
            {canWrite ? "Déposez un dossier ici" : "Aucun dossier"}
          </p>
        )}
        {cards.map((card, index) => (
          <Card
            key={card.id}
            card={card}
            canWrite={canWrite}
            onSelect={() => onSelect(card.id)}
            onMove={(stage) => onMove(card.id, stage)}
            canMoveUp={index > 0}
            canMoveDown={index < cards.length - 1}
            onReorder={(direction) => {
              const target = cards[index + (direction === "up" ? -1 : 1)];
              if (target)
                onReorder(
                  card.id,
                  target.id,
                  direction === "up" ? "before" : "after",
                );
            }}
          />
        ))}
      </div>
    </section>
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
  const dragContextId = useId();
  const movingRef = useRef(false);
  const [moving, setMoving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["commercial", "pipeline"],
    queryFn: fetchPipeline,
    initialData: { success: true, ...initialData },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const data = query.data;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  );
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const sync = useCommercialLiveSync({
    endpoint: "/api/admin/commercial/realtime",
    paused: moving || Boolean(activeId || selectedId || createOpen) || feedback?.type === "loading",
    refresh: () => query.refetch({ throwOnError: true }),
    cancel: () => queryClient.cancelQueries({ queryKey: ["commercial", "pipeline"], exact: true }),
  });
  const [teamView, setTeamView] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelId = useId();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    type: (initialData.cards.find((card) => card.id === initialSelectedId)
      ?.pipelineType ?? "BUYER") as string,
    agent: "ALL",
    priority: "ALL",
    status: "ALL",
    period: "ALL",
  });
  const activeFilterCount =
    Number(Boolean(search.trim())) +
    [filters.agent, filters.priority, filters.status, filters.period].filter(
      (value) => value !== "ALL",
    ).length;
  const selected = data.cards.find((card) => card.id === selectedId) ?? null;
  const filtered = useMemo(
    () =>
      data.cards.filter((card) => {
        const normalize = (value: string) =>
          value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("fr");
        if (
          search.trim() &&
          !normalize(
            [
              card.contactName,
              card.dossierReference,
              card.propertyTitle,
              card.contactEmail,
              card.contactPhone,
            ].join(" "),
          ).includes(normalize(search.trim()))
        )
          return false;
        if (card.pipelineType !== filters.type) return false;
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
    [data.cards, data.generatedAt, filters, search],
  );
  const blockedCount = filtered.filter((card) => card.isBlocked).length;
  const filteredTeam = useMemo(() => {
    const members = new Map<
      string,
      {
        profileId: string | null;
        name: string;
        dossierCount: number;
        blockedCount: number;
        estimatedValue: number;
      }
    >();
    for (const card of filtered) {
      const key = card.assignedTo ?? "unassigned";
      const member = members.get(key) ?? {
        profileId: card.assignedTo,
        name: card.assignedToName ?? "Non assigné",
        dossierCount: 0,
        blockedCount: 0,
        estimatedValue: 0,
      };
      member.dossierCount++;
      member.blockedCount += Number(card.isBlocked);
      member.estimatedValue += card.amount ?? 0;
      members.set(key, member);
    }
    return [...members.values()];
  }, [filtered]);

  async function saveTask(
    id: string,
    values: { title: string; dueAt: string | null; priority: string },
  ) {
    if (!data.permissions.canWrite || feedback?.type === "loading")
      return false;
    setFeedback({ type: "loading", message: "Enregistrement de la tâche…" });
    try {
      await mutatePipeline({ action: "update-task", id, ...values });
      await query.refetch();
      setFeedback({
        type: "success",
        message: "Tâche et échéance mises à jour.",
      });
      return true;
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Modification impossible.",
      });
      return false;
    }
  }

  async function moveCard(cardId: string, stage: CommercialPipelineStage) {
    if (!data.permissions.canWrite || movingRef.current) return;
    const card = data.cards.find((item) => item.id === cardId);
    if (
      !card ||
      card.stage === stage ||
      card.pipelineType !== (stage.startsWith("SELLER_") ? "SELLER" : "BUYER")
    )
      return;
    movingRef.current = true;
    setMoving(true);
    await queryClient.cancelQueries({ queryKey: ["commercial", "pipeline"] });
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
      const refreshed = await query.refetch();
      setFeedback({
        type: "success",
        message: refreshed.isError
          ? "Étape enregistrée. Actualisez pour recharger l’historique."
          : "Étape enregistrée dans Supabase.",
      });
    } catch (error) {
      if (previous)
        queryClient.setQueryData(["commercial", "pipeline"], previous);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Déplacement annulé.",
      });
    } finally {
      movingRef.current = false;
      setMoving(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const target = data.cards.find((card) => card.id === event.over?.id);
    const movingCard = data.cards.find((card) => card.id === event.active.id);
    if (target && movingCard && target.stage === movingCard.stage) {
      const stageCards = data.cards.filter(
        (card) => card.stage === target.stage,
      );
      const keyboard = event.activatorEvent.type === "keydown";
      const rect = event.active.rect.current.translated;
      const after = keyboard
        ? stageCards.indexOf(target) > stageCards.indexOf(movingCard)
        : Boolean(
            rect &&
            event.over &&
            rect.top + rect.height / 2 >
              event.over.rect.top + event.over.rect.height / 2,
          );
      void reorderCard(movingCard.id, target.id, after ? "after" : "before");
      return;
    }
    const stage = target?.stage ?? event.over?.id;
    if (typeof stage !== "string") return;
    if (!columns.some((column) => column.stage === stage)) return;
    void moveCard(String(event.active.id), stage as CommercialPipelineStage);
  }

  async function reorderCard(
    id: string,
    targetId: string,
    placement: "before" | "after",
  ) {
    if (!data.permissions.canWrite || movingRef.current || id === targetId)
      return;
    const card = data.cards.find((item) => item.id === id);
    const target = data.cards.find((item) => item.id === targetId);
    if (!card || !target || card.stage !== target.stage) return;
    movingRef.current = true;
    setMoving(true);
    await queryClient.cancelQueries({ queryKey: ["commercial", "pipeline"] });
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
              cards: reorderPipelineCards(
                current.cards,
                id,
                targetId,
                placement,
              ),
            }
          : current,
    );
    setFeedback({ type: "loading", message: "Enregistrement de l’ordre…" });
    try {
      await mutatePipeline({
        action: "reorder",
        id,
        targetId,
        placement,
        stage: card.stage,
      });
      const refreshed = await query.refetch();
      setFeedback({
        type: "success",
        message: refreshed.isError
          ? "Ordre enregistré. Actualisez pour le recharger."
          : "Ordre enregistré dans Supabase.",
      });
    } catch (error) {
      if (previous)
        queryClient.setQueryData(["commercial", "pipeline"], previous);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Classement annulé.",
      });
    } finally {
      movingRef.current = false;
      setMoving(false);
    }
  }

  async function submitCase(form: FormData) {
    if (feedback?.type === "loading") return;
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
      setSearch("");
      setFilters({
        type: String(form.get("pipelineType")),
        agent: "ALL",
        priority: "ALL",
        status: "ALL",
        period: "ALL",
      });
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
    if (!selected || feedback?.type === "loading") return;
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
    if (!data.permissions.canWrite || feedback?.type === "loading") return;
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
    if (!selected?.propertyId || feedback?.type === "loading") return;
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
    <div className="grid min-w-0 gap-6">
      <CommercialPageHeader
        title={
          filters.type === "SELLER"
            ? "Pipeline commercial vendeurs"
            : "Pipeline commercial"
        }
        description={
          filters.type === "SELLER"
            ? "Suivi des vendeurs · Estimations, mandats et commercialisation"
            : "Acquéreurs · Suivi des dossiers et progression"
        }
        action={
          <>
            <button
              className={commercialSecondaryButton}
              aria-pressed={teamView}
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
      <CommercialSyncStatus state={sync} />
      {query.error ? <BentoErrorState message={query.error.message} /> : null}
      <nav aria-label="Type de pipeline" className="flex flex-wrap gap-3">
        {[
          ["BUYER", "Pipeline acquéreurs"],
          ["SELLER", "Pipeline vendeurs"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={filters.type === value}
            disabled={moving || Boolean(activeId)}
            onClick={() => setFilters({ ...filters, type: value })}
            className={cn(
              "min-h-9 rounded-full border px-4 text-xs font-semibold",
              filters.type === value
                ? "border-[#17221e] bg-[#17221e] text-white"
                : "border-[#dfddd4] bg-[#fbfaf7]",
            )}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#719077] bg-[#dce5d7] px-4 py-2 text-sm font-semibold text-[#2f493a]">
        <div className="flex flex-wrap items-center gap-3">
          <p>
            Valeur estimée du pipeline :{" "}
            {money(filtered.reduce((sum, card) => sum + (card.amount ?? 0), 0))}
          </p>
          <CommercialBadge tone={blockedCount > 0 ? "warning" : "success"}>
            {blockedCount} {blockedCount > 1 ? "dossiers bloqués" : "dossier bloqué"}
          </CommercialBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(commercialSecondaryButton, "px-3 text-xs")}
            disabled={moving || query.isFetching}
            onClick={() => void query.refetch()}
          >
            Actualiser
          </button>
          <button
            type="button"
            className={cn(commercialSecondaryButton, "px-3 text-xs")}
            aria-expanded={filtersOpen}
            aria-controls={filterPanelId}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <Image
              src="/images/crm-commercial/pipeline-filter.svg"
              alt=""
              width={12}
              height={12}
            />
            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
      </div>
      <div id={filterPanelId} className={filtersOpen ? "grid gap-3" : "hidden"}>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${fieldClass} min-w-40 flex-1`}
            aria-label="Rechercher un dossier"
            placeholder="Rechercher un contact, un bien, une référence…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            className={commercialSecondaryButton}
            onClick={() => {
              setSearch("");
              setFilters({
                type: filters.type,
                agent: "ALL",
                priority: "ALL",
                status: "ALL",
                period: "ALL",
              });
            }}
          >
            Réinitialiser les filtres
          </button>
        </div>
        <CommercialPanel className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            className={fieldClass}
            aria-label="Conseiller"
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
            aria-label="Priorité"
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          >
            <option value="ALL">Toutes priorités</option>
            {[
              ["low", "Basse"],
              ["normal", "Normale"],
              ["high", "Haute"],
              ["urgent", "Urgente"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={fieldClass}
            aria-label="État du dossier"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="BLOCKED">Bloqués</option>
          </select>
          <select
            className={fieldClass}
            aria-label="Période"
            value={filters.period}
            onChange={(e) => setFilters({ ...filters, period: e.target.value })}
          >
            <option value="ALL">Toutes périodes</option>
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
          </select>
        </CommercialPanel>
      </div>
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
              {filteredTeam.map((row) => (
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
        <DndContext
          id={dragContextId}
          sensors={sensors}
          collisionDetection={(args) => {
            const hits = args.pointerCoordinates
              ? pointerWithin(args)
              : rectIntersection(args);
            const cardHits = hits.filter(
              (hit) =>
                hit.id !== args.active.id &&
                args.droppableContainers.find((item) => item.id === hit.id)
                  ?.data.current?.kind === "card",
            );
            return cardHits.length
              ? cardHits
              : hits.length
                ? hits
                : args.pointerCoordinates
                  ? []
                  : closestCenter(args);
          }}
          onDragStart={(event) => setActiveId(String(event.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                "Espace pour saisir. Gauche ou droite pour changer d’étape, haut ou bas pour classer dans la colonne. Espace pour déposer, Échap pour annuler.",
            },
            announcements: {
              onDragStart: () => "Dossier saisi. Choisissez une étape.",
              onDragOver: ({ over, active }) =>
                over
                  ? over.data.current?.kind === "card" &&
                    over.data.current?.stage === active.data.current?.stage
                    ? `Position de ${data.cards.find((card) => card.id === over.id)?.contactName ?? "dossier"}`
                    : `Étape ${columns.find((column) => column.stage === (over.data.current?.stage ?? over.id))?.label ?? ""}`
                  : "Hors du tableau",
              onDragEnd: ({ over }) =>
                over
                  ? "Dossier déposé. Enregistrement en cours."
                  : "Déplacement annulé.",
              onDragCancel: () => "Déplacement annulé.",
            },
          }}
        >
          <p className="text-xs text-[#66716c]">
            Glissez un dossier vers une étape ou sur une carte pour le classer.
            Au clavier : Espace, gauche/droite pour l’étape, haut/bas pour
            l’ordre, Espace pour déposer. Échap pour annuler. Ordre partagé avec
            l’équipe.
          </p>
          <div
            className="min-w-0 overflow-x-auto pb-4"
            tabIndex={0}
            aria-label="Tableau du pipeline, défilement horizontal"
          >
            <div className="flex gap-3">
              {columns
                .filter((column) => column.stage.startsWith(filters.type + "_"))
                .map((column) => {
                  const cards = filtered.filter(
                    (card) => card.stage === column.stage,
                  );
                  return (
                    <PipelineColumn
                      key={column.stage}
                      column={column}
                      cards={cards}
                      canWrite={data.permissions.canWrite && !moving}
                      onSelect={setSelectedId}
                      onMove={(id, stage) => void moveCard(id, stage)}
                      onReorder={(id, targetId, placement) =>
                        void reorderCard(id, targetId, placement)
                      }
                    />
                  );
                })}
            </div>
          </div>
          {typeof document !== "undefined" &&
            createPortal(
              <DragOverlay dropAnimation={null}>
                {activeId ? (
                  <div className="rounded-xl border border-[#5d7d65] bg-[#fbfaf7] p-4 text-sm shadow-2xl">
                    <p className="font-bold">
                      {data.cards.find((card) => card.id === activeId)
                        ?.contactName ?? "Dossier"}
                    </p>
                    <p className="mt-2 text-xs">
                      Relâchez pour changer d’étape
                    </p>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )}
        </DndContext>
      )}

      {createOpen ? (
        <CommercialDialog
          title="Nouveau dossier"
          onClose={() => {
            if (feedback?.type !== "loading") setCreateOpen(false);
          }}
        >
          <CommercialFeedback state={feedback} inline />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitCase(new FormData(event.currentTarget));
            }}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <select
              required
              name="contactId"
              aria-label="Contact du dossier"
              className={fieldClass}
            >
              <option value="">Contact réel…</option>
              {data.options.contacts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.email}
                </option>
              ))}
            </select>
            <select
              name="pipelineType"
              aria-label="Type du dossier"
              defaultValue={filters.type}
              className={fieldClass}
            >
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
              <button
                disabled={feedback?.type === "loading"}
                className={commercialPrimaryButton}
              >
                Créer
              </button>
            </div>
          </form>
        </CommercialDialog>
      ) : null}

      {selected ? (
        <CommercialDialog
          drawer
          title={
            selected.propertyTitle ??
            selected.estimationLabel ??
            "Dossier commercial"
          }
          onClose={() => setSelectedId(null)}
        >
          <CommercialFeedback state={feedback} inline />
          <CommercialBadge tone="success">
            {columns.find((column) => column.stage === selected.stage)?.label ??
              selected.stage}
          </CommercialBadge>
          <p className="mt-2 text-xs text-[#66716c]">
            Dossier{" "}
            {selected.pipelineType === "SELLER" ? "vendeur" : "acquéreur"} ·
            Réf. {selected.dossierReference}
          </p>
          <section className="mt-6">
            <h3 className="mb-3 text-sm font-semibold">
              Informations du{" "}
              {selected.pipelineType === "SELLER" ? "propriétaire" : "contact"}
            </h3>
            <div className="rounded-xl bg-[#f6f4ef] p-4">
              <Person name={selected.contactName} />
              <p className="mt-3 text-xs text-[#66716c]">
                Téléphone : {selected.contactPhone ?? "Non renseigné"}
              </p>
              <p className="mt-2 break-all text-xs text-[#66716c]">
                E-mail : {selected.contactEmail ?? "Non renseigné"}
              </p>
            </div>
          </section>
          <section className="mt-6">
            <h3 className="mb-3 text-sm font-semibold">
              Prochaine action planifiée
            </h3>
            <div className="rounded-xl bg-[#dce5d7] p-4 text-xs">
              <p className="font-semibold">
                {selected.nextAction
                  ? shortDate(selected.nextAction.dueAt, true)
                  : "Aucune action planifiée"}
              </p>
              <p className="mt-2">{selected.nextAction?.title}</p>
            </div>
          </section>
          <div className="mt-5 flex flex-wrap gap-2">
            {selected.contactPhone && (
              <a
                className={commercialSecondaryButton}
                href={`tel:${selected.contactPhone}`}
              >
                Appeler
              </a>
            )}
            {selected.contactEmail && (
              <a
                className={commercialSecondaryButton}
                href={`mailto:${selected.contactEmail}`}
              >
                Écrire un e-mail
              </a>
            )}
            {data.permissions.canWrite &&
              selected.propertyId &&
              selected.contactId && (
                <Link
                  className={commercialSecondaryButton}
                  href={`/commercial/visites/nouvelle?bien_id=${selected.propertyId}&contact_id=${selected.contactId}`}
                >
                  Planifier une visite
                </Link>
              )}
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
              Tâches à réaliser
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
                      {data.permissions.canWrite && (
                        <PipelineTaskEditor
                          task={task}
                          busy={feedback?.type === "loading"}
                          onSave={saveTask}
                        />
                      )}
                    </div>
                    {data.permissions.canWrite &&
                      (task.status === "COMPLETED" ? (
                        <button
                          title="Rouvrir"
                          disabled={feedback?.type === "loading"}
                          onClick={() => taskAction(task.id, "reopen")}
                        >
                          <RotateCcw className="size-4" />
                        </button>
                      ) : (
                        <button
                          title="Terminer"
                          disabled={feedback?.type === "loading"}
                          onClick={() => taskAction(task.id, "complete")}
                        >
                          <Check className="size-4" />
                        </button>
                      ))}
                    {data.permissions.canWrite && (
                      <button
                        title="Archiver"
                        disabled={feedback?.type === "loading"}
                        onClick={() => taskAction(task.id, "archive")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
            </div>
            {data.permissions.canWrite ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitTask(new FormData(event.currentTarget));
                }}
                className="mt-3 grid gap-2"
              >
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
                <button
                  disabled={feedback?.type === "loading"}
                  className={commercialPrimaryButton}
                >
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
                onSubmit={(event) => {
                  event.preventDefault();
                  void createMandate(new FormData(event.currentTarget));
                }}
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
                <button
                  disabled={feedback?.type === "loading"}
                  className={`${commercialPrimaryButton} col-span-2`}
                >
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
        </CommercialDialog>
      ) : null}
      <DataSourceNotice demo={false} />
      <CommercialFeedback state={feedback} />
    </div>
  );
}

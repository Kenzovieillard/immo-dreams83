"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronDown, Filter, GripVertical, MoreHorizontal, Plus, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  buyerStages,
  formatPrice,
  pipelineFixtures,
  sellerStages,
  type PipelineCardData,
  type PipelineKind,
  type PipelineStage,
} from "./commercial-data";
import {
  AgentAvatar,
  CommercialBadge,
  CommercialFeedback,
  CommercialPageHeader,
  DataSourceNotice,
  commercialPrimaryButton,
  commercialSecondaryButton,
} from "./commercial-ui";

function roleTone(role: string) {
  if (/invest/i.test(role)) return "border-[#d4c6e7] bg-[#f0e9f8] text-[#694f89]";
  if (/propri/i.test(role)) return "border-[#decbbb] bg-[#f6ebe1] text-[#795636]";
  if (/acqué/i.test(role)) return "border-[#c6d8e9] bg-[#eaf2f8] text-[#365f83]";
  return "border-[#c7d8c2] bg-[#eef4eb] text-[#35583d]";
}

function alertClass(tone?: PipelineCardData["alertTone"]) {
  if (tone === "danger") return "border-[#e5a49d] bg-[#fff1ef] text-[#bc3e32]";
  if (tone === "warning") return "border-[#efd19a] bg-[#fff7e4] text-[#c66d00]";
  if (tone === "info") return "border-[#b9d8ee] bg-[#edf7fd] text-[#1472a6]";
  return "border-[#bcd8c0] bg-[#edf7ed] text-[#287345]";
}

function PipelineCard({ data, onOpen }: { data: PipelineCardData; onOpen: (card: PipelineCardData) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: data.id, data: { stage: data.stage } });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(data)}
      className={cn(
        "cursor-grab touch-none rounded-lg border bg-[#fbfaf7] p-3 text-left shadow-[0_2px_6px_rgb(23_34_30/0.08)] outline-none transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing",
        data.blocked ? "border-[#e16b5f] bg-[#fffaf8]" : "border-[#dfddd4]",
        data.compact ? "min-h-[76px]" : "min-h-[168px]",
        isDragging && "z-50 opacity-70 shadow-xl"
      )}
    >
      <div className="flex items-center justify-between gap-2 text-[#7d8581]">
        <GripVertical className="size-3.5" aria-hidden="true" />
        {data.status ? <CommercialBadge tone={data.status === "Acté" ? "success" : data.status === "À relancer" ? "danger" : "warning"} className="max-w-[120px] truncate py-0.5">{data.status}</CommercialBadge> : <MoreHorizontal className="size-4" />}
      </div>
      <h3 className="mt-2 truncate text-[13px] font-bold text-[#18211f]">{data.contact}</h3>
      {data.compact ? (
        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-[#66706b]">{data.property} · {formatPrice(data.amount)}</p>
      ) : (
        <>
          <span className={cn("mt-2 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold", roleTone(data.role))}>{data.role}</span>
          <p className="mt-2 truncate text-[11px] text-[#6c746f]">{data.property}</p>
          <p className="mt-1 text-[13px] font-bold">{data.stage === "BUYER_NEW" ? "Est. " : ""}{formatPrice(data.amount)}</p>
          {data.alert ? <p className={cn("mt-2 rounded-md border px-2 py-1.5 text-[10px] font-semibold leading-3.5", alertClass(data.alertTone))}>{data.alert}</p> : null}
          <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-[#ebe8df] pt-2 text-[10px] text-[#78817c]">
            {data.owner ? <><AgentAvatar name={data.owner} size="xs" /><span>{data.owner}</span></> : <><span className="size-4 rounded-full bg-[#deded5]" /><span>Non attribué</span></>}
            {data.updatedLabel ? <span className="ml-auto whitespace-nowrap">{data.updatedLabel}</span> : null}
          </div>
        </>
      )}
    </article>
  );
}

function PipelineColumn({
  stage,
  cards,
  onOpen,
}: {
  stage: { id: PipelineStage; label: string; color: string };
  cards: PipelineCardData[];
  onOpen: (card: PipelineCardData) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  return (
    <section ref={setNodeRef} className={cn("flex min-h-[650px] w-[178px] shrink-0 flex-col rounded-xl border bg-[#f8f7f3] p-3 transition xl:min-h-[720px] xl:flex-1", isOver ? "border-[#4d7a5c] bg-[#eef4eb]" : "border-[#dfddd4]")}>
      <header className="mb-3 flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ backgroundColor: stage.color }} />
        <h2 className="truncate text-xs font-bold">{stage.label}</h2>
        <span className="rounded-full bg-[#dce5d7] px-1.5 py-0.5 text-[10px] font-bold">{cards.length}</span>
        <button type="button" aria-label={`Ajouter dans ${stage.label}`} className="ml-auto text-[#69736e]"><Plus className="size-3.5" /></button>
      </header>
      <div className="grid gap-3">
        {cards.map((card) => <PipelineCard key={card.id} data={card} onOpen={onOpen} />)}
        {cards.length === 0 ? <div className="rounded-lg border border-dashed border-[#d8d5cb] p-3 text-center text-[11px] text-[#818985]">Déposer un dossier ici</div> : null}
      </div>
    </section>
  );
}

const drawerTasks = [
  "Vérifier le titre de propriété",
  "Commander les diagnostics obligatoires",
  "Prendre les photos professionnelles",
  "Rédiger l'annonce pour portails",
];

function DossierDrawer({ card, onClose }: { card: PipelineCardData | null; onClose: () => void }) {
  const [completed, setCompleted] = useState([true, true, false, false]);
  if (!card) return null;
  return (
    <div className="fixed inset-0 z-[75]">
      <button type="button" aria-label="Fermer le dossier" onClick={onClose} className="absolute inset-0 bg-[#17221e]/45" />
      <aside role="dialog" aria-modal="true" aria-label={`Dossier ${card.contact}`} className="absolute inset-y-0 right-0 w-full max-w-[420px] overflow-y-auto bg-[#fbfaf7] p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><CommercialBadge tone="success">Mandat signé</CommercialBadge><h2 className="mt-3 text-2xl font-bold leading-7">{card.property}</h2><p className="mt-1 text-xs text-[#717a75]">Dossier Vendeur · Réf. #83042</p></div><button type="button" onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-full bg-[#eef1eb]"><X className="size-4" /></button></div>
        <div className="my-6 h-px bg-[#dfddd4]" />
        <section><h3 className="text-sm font-bold">Informations du propriétaire</h3><div className="mt-3 rounded-xl bg-[#f6f4ef] p-4 text-sm"><p className="font-bold">Marc Durand</p><p className="mt-2 text-xs text-[#747d78]">Téléphone : +33 6 12 34 56 78</p><p className="mt-2 text-xs text-[#747d78]">Email : m.durand@example.com</p></div></section>
        <section className="mt-6"><h3 className="text-sm font-bold">Prochaine action planifiée</h3><div className="mt-3 rounded-xl bg-[#dce5d7] p-4 text-sm"><p className="font-bold text-[#2f493a]">Aujourd&apos;hui · 14:30</p><p className="mt-2 text-xs leading-5">Rendez-vous sur place pour remise des clés et signature du mandat exclusif.</p></div></section>
        <section className="mt-6"><h3 className="text-sm font-bold">Tâches à réaliser</h3><div className="mt-3 grid gap-3">{drawerTasks.map((task, index) => <label key={task} className="flex cursor-pointer items-start gap-3 text-xs"><input type="checkbox" checked={completed[index]} onChange={() => setCompleted((items) => items.map((value, itemIndex) => itemIndex === index ? !value : value))} className="peer sr-only" /><span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded border", completed[index] ? "border-[#2f493a] bg-[#2f493a] text-white" : "border-[#9aa19d] bg-white")}><Check className="size-3" /></span><span className={completed[index] ? "text-[#68716c] underline" : "text-[#26322d]"}>{task}</span></label>)}</div></section>
        <section className="mt-6"><h3 className="text-sm font-bold">Historique du dossier</h3><div className="mt-4 grid gap-0">{[["Création de la demande d'estimation","15 juil."],["Rendez-vous d'estimation effectué","20 juil."],["Rapport d'estimation envoyé","22 juil."]].map(([event,date], index) => <div key={event} className="relative flex gap-3 pb-5"><span className="relative z-10 mt-1.5 size-2 rounded-full bg-[#4d7a5c]" />{index < 2 ? <span className="absolute left-[3px] top-3 h-full w-px bg-[#d6d9d2]" /> : null}<div><p className="text-xs font-bold">{event}</p><p className="mt-1 text-[10px] text-[#7f8783]">{date}</p></div></div>)}</div></section>
      </aside>
    </div>
  );
}

export function CommercialPipelineScreen() {
  const [kind, setKind] = useState<PipelineKind>("buyers");
  const [cards, setCards] = useState(pipelineFixtures);
  const [selected, setSelected] = useState<PipelineCardData | null>(null);
  const [feedback, setFeedback] = useState<{ type: "loading" | "success" | "error"; message: string } | null>(null);
  const realtimeRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>["channel"]> | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(KeyboardSensor));
  const stages = kind === "buyers" ? buyerStages : sellerStages;
  const visibleCards = useMemo(() => cards.filter((card) => kind === "buyers" ? card.stage.startsWith("BUYER_") : card.stage.startsWith("SELLER_")), [cards, kind]);

  const moveMutation = useMutation({
    mutationFn: async ({ id, pipelineStage }: { id: string; pipelineStage: PipelineStage }) => {
      if (id.startsWith("demo-")) {
        return { success: true, persisted: false, message: "Aperçu Figma déplacé localement." };
      }
      const response = await fetch("/api/admin/commercial", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move-pipeline", id, pipelineStage }) });
      const payload = await response.json().catch(() => null) as { success?: boolean; message?: string; persisted?: boolean } | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.message ?? "Le déplacement n'a pas pu être enregistré.");
      return payload;
    },
    onSuccess: async (payload, variables) => {
      setFeedback({ type: "success", message: payload.message ?? "Dossier déplacé." });
      await realtimeRef.current?.send({ type: "broadcast", event: "pipeline-moved", payload: variables });
      window.setTimeout(() => setFeedback(null), 2400);
    },
    onError: (error, variables) => {
      setCards((current) => current.map((card) => card.id === variables.id ? { ...card, stage: pipelineFixtures.find((item) => item.id === card.id)?.stage ?? card.stage } : card));
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erreur de déplacement." });
    },
  });

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const channel = supabase.channel("commercial-pipeline")
      .on("broadcast", { event: "pipeline-moved" }, ({ payload }) => {
        const value = payload as { id?: string; pipelineStage?: PipelineStage };
        if (!value.id || !value.pipelineStage) return;
        setCards((current) => current.map((card) => card.id === value.id ? { ...card, stage: value.pipelineStage! } : card));
      })
      .subscribe();
    realtimeRef.current = channel;
    return () => { realtimeRef.current = null; void supabase.removeChannel(channel); };
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const cardId = String(event.active.id);
    const targetStage = event.over?.id ? String(event.over.id) as PipelineStage : null;
    const card = cards.find((item) => item.id === cardId);
    if (!card || !targetStage || card.stage === targetStage) return;
    const previousStage = card.stage;
    setCards((current) => current.map((item) => item.id === cardId ? { ...item, stage: targetStage } : item));
    setFeedback({ type: "loading", message: "Mise à jour de l'étape…" });
    moveMutation.mutate({ id: cardId, pipelineStage: targetStage }, { onError: () => setCards((current) => current.map((item) => item.id === cardId ? { ...item, stage: previousStage } : item)) });
  }

  const pipelineValue = visibleCards.reduce((sum, card) => sum + card.amount, 0);
  return (
    <div className="grid gap-6">
      <CommercialPageHeader title={kind === "buyers" ? "Pipeline commercial" : "Pipeline vendeurs"} description={kind === "buyers" ? "Acquéreurs · Suivi des dossiers et progression" : "Suivi des vendeurs · Estimation des biens, mandats et commercialisation"} action={<><button type="button" className={commercialSecondaryButton}>Vue équipe</button><button type="button" className={commercialSecondaryButton}>Vendeur: Tous <ChevronDown className="size-4" /></button><button type="button" className={commercialPrimaryButton}><Plus className="size-4" />{kind === "buyers" ? "Nouveau dossier" : "Nouveau mandat"}</button></>} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="inline-flex w-fit rounded-full border border-[#dfddd4] bg-[#fbfaf7] p-1"><button type="button" onClick={() => setKind("buyers")} className={cn("rounded-full px-4 py-2 text-xs font-semibold", kind === "buyers" ? "bg-[#17221e] text-white" : "text-[#4f5954]")}>Pipeline acquéreurs</button><button type="button" onClick={() => setKind("sellers")} className={cn("rounded-full px-4 py-2 text-xs font-semibold", kind === "sellers" ? "bg-[#17221e] text-white" : "text-[#4f5954]")}>Pipeline vendeurs</button></div><DataSourceNotice /></div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#6d8b72] bg-[#dce5d7] px-5 py-3 text-sm"><strong>{kind === "buyers" ? `Valeur estimée du pipeline : ${formatPrice(pipelineValue)}` : "Estimations actives : 14 dossiers · Volume estimé : 8 450 000 €"}</strong><CommercialBadge tone="warning">{kind === "buyers" ? "3 dossiers bloqués" : "2 à relancer urgemment"}</CommercialBadge><button type="button" className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#c8cec5] bg-[#fbfaf7] px-3 py-2 text-xs font-semibold"><Filter className="size-3.5" />Filtres</button></div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3 xl:overflow-visible">
          {stages.map((stage) => <PipelineColumn key={stage.id} stage={stage} cards={visibleCards.filter((card) => card.stage === stage.id)} onOpen={setSelected} />)}
        </div>
      </DndContext>
      <p className="text-xs text-[#727b76]">Astuce : faites glisser une carte entre les colonnes. Sur données réelles, Supabase met à jour l’étape et sa date d’entrée, puis diffuse le changement aux autres onglets.</p>
      <Link href="/commercial/offres" className="sr-only">Ouvrir les offres</Link>
      <DossierDrawer card={selected} onClose={() => setSelected(null)} />
      <CommercialFeedback state={feedback} />
    </div>
  );
}

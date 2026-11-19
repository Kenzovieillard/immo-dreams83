"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FilePlus2,
  Gauge,
  HousePlus,
  Phone,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CrmDailyPriority } from "@/lib/crm-dashboard";
import type { CrmOverviewSnapshot, PipelineTask } from "@/types/crm";
import { cn } from "@/lib/utils";
import {
  RivieraStatusBadge,
  rivieraPrimaryButtonClass,
  rivieraSecondaryButtonClass,
} from "./crm-riviera-ui";

export type RivieraOverviewMetrics = {
  totalLeads: number;
  newLeads: number;
  visits: number;
  offers: number;
  availableProperties: number;
  propertiesWithoutPhotos: number;
  contactsToQualify: number;
  openTasks: number;
  todayTasks: number;
};

const pipelineSteps = [
  { key: "newLeads", label: "Nouveaux prospects" },
  { key: "contactsToQualify", label: "À qualifier" },
  { key: "visits", label: "En visite" },
  { key: "offers", label: "Offres" },
] as const;

function formatShortDate(value: Date) {
  return value.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });
}

function formatTaskTime(value: string | null) {
  if (!value) return "À planifier";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "À planifier";
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function OverviewMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <article className="grid min-w-0 gap-4 rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-4 shadow-[var(--crm-riviera-shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-action)]">
          <Icon className="size-[18px]" aria-hidden="true" />
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            tone === "success" && "bg-[#e4eee4] text-[#3f6b4d]",
            tone === "warning" && "bg-[#f5ead4] text-[#966819]",
            tone === "neutral" && "bg-[#eceae4] text-[var(--crm-riviera-text-secondary)]"
          )}
        >
          {detail}
        </span>
      </div>
      <div>
        <p className="text-3xl font-semibold tracking-[-0.04em] text-[var(--crm-riviera-text-primary)]">{value}</p>
        <p className="mt-1 text-xs font-medium text-[var(--crm-riviera-text-secondary)]">{label}</p>
      </div>
    </article>
  );
}

function QuickAction({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-20 items-center gap-4 rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b8c6b6] hover:shadow-[var(--crm-riviera-shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-action)]">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--crm-riviera-text-primary)]">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-[var(--crm-riviera-text-secondary)]">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-[var(--crm-riviera-text-secondary)] transition group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

export function CrmRivieraOverview({
  metrics,
  priorities,
  tasks,
  onPriorityAction,
  onOpenPipeline,
  onOpenContacts,
  onOpenProperties,
  onOpenEstimations,
  onCreateContact,
  overview,
}: {
  metrics: RivieraOverviewMetrics;
  priorities: CrmDailyPriority[];
  tasks: PipelineTask[];
  onPriorityAction: (priority: CrmDailyPriority) => void;
  onOpenPipeline: () => void;
  onOpenContacts: () => void;
  onOpenProperties: () => void;
  onOpenEstimations: () => void;
  onCreateContact: () => void;
  overview?: CrmOverviewSnapshot | null;
}) {
  const now = new Date();
  const openTasks = tasks.filter((task) => !task.completedAt);
  const todayTasks = openTasks
    .filter((task) => {
      if (!task.dueAt) return false;
      const due = new Date(task.dueAt);
      return (
        due.getFullYear() === now.getFullYear() &&
        due.getMonth() === now.getMonth() &&
        due.getDate() === now.getDate()
      );
    })
    .sort((left, right) => (left.dueAt ?? "").localeCompare(right.dueAt ?? ""))
    .slice(0, 3);
  const visiblePriorities = priorities.slice(0, 4);
  const syncedAt = overview?.generatedAt ? new Date(overview.generatedAt) : null;
  const syncLabel = syncedAt && !Number.isNaN(syncedAt.getTime())
    ? `Mis à jour à ${syncedAt.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      })}`
    : "Données de la session";
  const pipelineMax = Math.max(...pipelineSteps.map((step) => metrics[step.key]), 1);

  return (
    <div className="grid min-w-0 gap-6 lg:gap-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--crm-riviera-text-action)]">
            <Sparkles className="size-4" aria-hidden="true" />
            Suivi opérationnel Riviera
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[var(--crm-riviera-text-primary)] sm:text-4xl">
            Vue d&apos;ensemble — Aujourd&apos;hui
          </h1>
          <p className="mt-2 text-sm capitalize text-[var(--crm-riviera-text-secondary)]">
            {formatShortDate(now)} · IMMO DREAMS83
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] px-3 text-xs font-medium text-[var(--crm-riviera-text-secondary)]">
            <CheckCircle2 className="size-4 text-[var(--crm-riviera-status-success)]" aria-hidden="true" />
            {syncLabel}
          </span>
          <Button type="button" variant="secondary" className={rivieraSecondaryButtonClass}>
            <SlidersHorizontal className="size-4" />
            Personnaliser
          </Button>
        </div>
      </section>

      <section aria-labelledby="activity-summary-title" className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="activity-summary-title" className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Synthèse d&apos;activité</h2>
          <span className="text-xs text-[var(--crm-riviera-text-secondary)]">Données actives uniquement</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <OverviewMetric label="Nouveaux contacts" value={metrics.newLeads} detail="Entrants" icon={UserPlus} tone="success" />
          <OverviewMetric label="Urgences" value={priorities.length} detail="À traiter" icon={CircleAlert} tone={priorities.length ? "warning" : "success"} />
          <OverviewMetric label="À relancer" value={metrics.openTasks} detail="Ouverts" icon={Phone} />
          <OverviewMetric label="Estimations en cours" value={metrics.contactsToQualify} detail="À qualifier" icon={FilePlus2} />
          <OverviewMetric label="Biens actifs" value={metrics.availableProperties} detail="Stock" icon={Building2} tone="success" />
          <OverviewMetric label="Visites prévues" value={metrics.visits} detail="Agenda" icon={CalendarDays} tone="success" />
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.8fr)]">
        <section aria-labelledby="priorities-title" className="rounded-3xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-5 shadow-[var(--crm-riviera-shadow-card)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="priorities-title" className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Priorités de l&apos;équipe</h2>
              <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">Les dossiers qui demandent une action maintenant.</p>
            </div>
            <button type="button" onClick={onOpenPipeline} className="min-h-10 text-sm font-semibold text-[var(--crm-riviera-text-action)]">
              Ouvrir les {priorities.length} priorités →
            </button>
          </div>

          {visiblePriorities.length ? (
            <div className="mt-5 divide-y divide-[var(--crm-riviera-border-default)]">
              {visiblePriorities.map((priority) => (
                <article key={priority.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                  <RivieraStatusBadge tone={priority.tone}>{priority.badge}</RivieraStatusBadge>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--crm-riviera-text-primary)]">{priority.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--crm-riviera-text-secondary)]">{priority.context} · {priority.timeLabel}</p>
                  </div>
                  <Button type="button" variant="secondary" className={rivieraSecondaryButtonClass} onClick={() => onPriorityAction(priority)}>
                    {priority.actionLabel}
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-[var(--crm-riviera-bg-accent)] px-5 py-8 text-center">
              <CheckCircle2 className="mx-auto size-7 text-[var(--crm-riviera-status-success)]" aria-hidden="true" />
              <p className="mt-3 font-semibold text-[var(--crm-riviera-text-primary)]">Aucune priorité bloquante</p>
              <p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">Les dossiers du jour sont sous contrôle.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="agenda-title" className="rounded-3xl bg-[var(--crm-riviera-bg-header)] p-5 text-white shadow-[var(--crm-riviera-shadow-card)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="agenda-title" className="text-lg font-semibold">Agenda d&apos;aujourd&apos;hui</h2>
              <p className="mt-1 text-xs text-white/65">{todayTasks.length} rendez-vous ou rappel{todayTasks.length > 1 ? "s" : ""}</p>
            </div>
            <CalendarDays className="size-5 text-[#a9c0ab]" aria-hidden="true" />
          </div>
          <div className="mt-5 grid gap-3">
            {todayTasks.length ? todayTasks.map((task) => (
              <article key={task.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 rounded-2xl bg-white/7 p-3">
                <span className="font-mono text-sm font-semibold text-[#d6b16a]">{formatTaskTime(task.dueAt)}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{task.title}</p>
                  <p className="mt-1 truncate text-xs text-white/60">{task.description || "Suivi commercial planifié"}</p>
                </div>
              </article>
            )) : (
              <div className="rounded-2xl bg-white/7 px-4 py-8 text-center">
                <Clock3 className="mx-auto size-6 text-[#a9c0ab]" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">Aucun rendez-vous daté aujourd&apos;hui</p>
                <p className="mt-1 text-xs text-white/60">Les tâches sans échéance restent visibles dans le pipeline.</p>
              </div>
            )}
          </div>
          <button type="button" onClick={onOpenPipeline} className="mt-4 min-h-10 text-sm font-semibold text-[#dce5d7]">Voir l&apos;agenda complet →</button>
        </section>
      </div>

      <section aria-labelledby="pipeline-title" className="rounded-3xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="pipeline-title" className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Pipeline commercial</h2>
            <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">Évolution globale des dossiers actifs de l&apos;agence.</p>
          </div>
          <RivieraStatusBadge tone="success">{metrics.totalLeads} dossiers actifs</RivieraStatusBadge>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {pipelineSteps.map((step, index) => {
            const value = metrics[step.key];
            const width = Math.max(8, Math.round((value / pipelineMax) * 100));
            return (
              <button key={step.key} type="button" onClick={onOpenPipeline} className="rounded-2xl bg-[var(--crm-riviera-bg-canvas)] p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[var(--crm-riviera-text-secondary)]">{step.label}</span>
                  <span className="text-2xl font-semibold text-[var(--crm-riviera-text-primary)]">{value}</span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#dfddd4]">
                  <div className={cn("h-full rounded-full", index === 3 ? "bg-[#c28b2c]" : "bg-[var(--crm-riviera-bg-action)]")} style={{ width: `${width}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <section aria-labelledby="properties-alert-title" className="overflow-hidden rounded-3xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
            <div>
              <h2 id="properties-alert-title" className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Biens nécessitant une attention</h2>
              <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">Alertes calculées avec les informations disponibles.</p>
            </div>
            <Button type="button" variant="secondary" className={rivieraSecondaryButtonClass} onClick={onOpenProperties}>Voir les biens</Button>
          </div>
          <div className="border-t border-[var(--crm-riviera-border-default)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_7rem] sm:px-6">
              <div>
                <p className="text-sm font-semibold text-[var(--crm-riviera-text-primary)]">Photos manquantes</p>
                <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">Annonces à compléter avant diffusion.</p>
              </div>
              <RivieraStatusBadge tone={metrics.propertiesWithoutPhotos ? "warning" : "success"}>{metrics.propertiesWithoutPhotos} bien{metrics.propertiesWithoutPhotos > 1 ? "s" : ""}</RivieraStatusBadge>
              <button type="button" onClick={onOpenProperties} className="hidden text-right text-xs font-semibold text-[var(--crm-riviera-text-action)] sm:block">Corriger →</button>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-[var(--crm-riviera-border-default)] px-5 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_7rem] sm:px-6">
              <div>
                <p className="text-sm font-semibold text-[var(--crm-riviera-text-primary)]">Stock actif à piloter</p>
                <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">Mandats actuellement disponibles.</p>
              </div>
              <RivieraStatusBadge>{metrics.availableProperties} actif{metrics.availableProperties > 1 ? "s" : ""}</RivieraStatusBadge>
              <button type="button" onClick={onOpenProperties} className="hidden text-right text-xs font-semibold text-[var(--crm-riviera-text-action)] sm:block">Analyser →</button>
            </div>
          </div>
        </section>

        <section aria-labelledby="team-title" className="rounded-3xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="team-title" className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Charge opérationnelle</h2>
              <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">Vue agrégée de l&apos;équipe.</p>
            </div>
            <UsersRound className="size-5 text-[var(--crm-riviera-text-action)]" aria-hidden="true" />
          </div>
          <div className="mt-5 grid gap-3">
            <div className="flex items-center justify-between rounded-2xl bg-[var(--crm-riviera-bg-canvas)] px-4 py-3 text-sm"><span className="text-[var(--crm-riviera-text-secondary)]">Priorités actives</span><strong>{priorities.length}</strong></div>
            <div className="flex items-center justify-between rounded-2xl bg-[var(--crm-riviera-bg-canvas)] px-4 py-3 text-sm"><span className="text-[var(--crm-riviera-text-secondary)]">Tâches ouvertes</span><strong>{metrics.openTasks}</strong></div>
            <div className="flex items-center justify-between rounded-2xl bg-[var(--crm-riviera-bg-canvas)] px-4 py-3 text-sm"><span className="text-[var(--crm-riviera-text-secondary)]">Offres en attente</span><strong>{metrics.offers}</strong></div>
          </div>
          <button type="button" onClick={onOpenContacts} className="mt-4 min-h-10 text-sm font-semibold text-[var(--crm-riviera-text-action)]">Voir les contacts →</button>
        </section>
      </div>

      <section aria-labelledby="quick-actions-title" className="grid gap-4">
        <div className="flex items-center gap-2">
          <Gauge className="size-5 text-[var(--crm-riviera-text-action)]" aria-hidden="true" />
          <h2 id="quick-actions-title" className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Actions rapides</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction title="Ajouter un contact" description="Créer une fiche acquéreur ou vendeur" icon={UserPlus} onClick={onCreateContact} />
          <QuickAction title="Planifier une estimation" description="Ouvrir les demandes d'avis de valeur" icon={FilePlus2} onClick={onOpenEstimations} />
          <QuickAction title="Ajouter un bien" description="Enregistrer un nouveau mandat" icon={HousePlus} onClick={onOpenProperties} />
          <QuickAction title="Créer une visite" description="Planifier un rendez-vous client" icon={Plus} onClick={onOpenPipeline} />
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" className={rivieraPrimaryButtonClass} onClick={onOpenPipeline}>
          <Target className="size-4" />
          Piloter le pipeline
        </Button>
      </div>
    </div>
  );
}

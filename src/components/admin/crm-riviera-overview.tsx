"use client";

import { Download, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CrmDailyPriority } from "@/lib/crm-dashboard";
import type { CrmOverviewSnapshot, PipelineTask } from "@/types/crm";
import {
  RivieraActionCard,
  RivieraMetric,
  RivieraPanel,
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

export function CrmRivieraOverview({
  metrics,
  priorities,
  tasks,
  onPriorityAction,
  onOpenPipeline,
  onOpenContacts,
  onOpenProperties,
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
  onCreateContact: () => void;
  overview?: CrmOverviewSnapshot | null;
}) {
  const openTasks = tasks.filter((task) => !task.completedAt);
  const today = new Date();
  const todayTasks = openTasks.filter((task) => {
    if (!task.dueAt) return false;
    const due = new Date(task.dueAt);
    return (
      due.getFullYear() === today.getFullYear() &&
      due.getMonth() === today.getMonth() &&
      due.getDate() === today.getDate()
    );
  });
  const visiblePriorities = priorities.slice(0, 2);
  const syncedAt = overview?.generatedAt ? new Date(overview.generatedAt) : null;
  const formattedDate = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const syncLabel = syncedAt && !Number.isNaN(syncedAt.getTime())
    ? `Vue : equipe · ${syncedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : "Vue : equipe";

  return (
    <div className="grid min-w-0 gap-4 sm:gap-5">
      <div className="hidden items-center justify-between gap-6 md:flex">
        <div>
          <h2 className="text-3xl font-bold leading-10 text-[var(--crm-riviera-text-primary)]">
            Vue d&apos;ensemble — Aujourd&apos;hui
          </h2>
          <p className="mt-1 text-sm capitalize text-[var(--crm-riviera-text-secondary)]">
            {formattedDate} · Priorités de l&apos;équipe Riviera
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-[var(--crm-riviera-text-secondary)]">{syncLabel}</span>
          <Button type="button" variant="secondary" className={rivieraSecondaryButtonClass}>
            <Download className="size-4" />
            Exporter
          </Button>
          <RivieraStatusBadge tone={priorities.length ? "warning" : "success"}>
            {priorities.length ? `${priorities.length} urgences` : "Journée à jour"}
          </RivieraStatusBadge>
        </div>
      </div>

      <div className="grid w-full min-w-0 max-w-full gap-4 overflow-hidden lg:grid-cols-12 lg:gap-5">
        <RivieraPanel className="grid gap-4 border-0 bg-transparent p-0 shadow-none md:border md:bg-[var(--crm-riviera-bg-surface)] md:p-4 md:shadow-[var(--crm-riviera-shadow-card)] lg:col-span-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold leading-6 text-[var(--crm-riviera-text-primary)]">
              À traiter aujourd&apos;hui
            </h2>
            <RivieraStatusBadge tone={priorities.length ? "warning" : "success"}>
              {priorities.length ? `${priorities.length} urgences` : "À jour"}
            </RivieraStatusBadge>
          </div>

          {visiblePriorities.length ? (
            <div className="grid w-full min-w-0 max-w-full gap-4 md:grid-cols-2">
              {visiblePriorities.map((priority) => (
                <RivieraActionCard
                  key={priority.id}
                  badge={priority.badge}
                  title={priority.title}
                  context={priority.context}
                  timeLabel={priority.timeLabel}
                  actionLabel={priority.actionLabel}
                  tone={priority.tone}
                  onAction={() => onPriorityAction(priority)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--crm-riviera-bg-accent)] px-5 py-8 text-center">
              <p className="font-semibold text-[var(--crm-riviera-text-primary)]">
                Aucune priorité bloquante
              </p>
              <p className="mt-2 text-sm text-[var(--crm-riviera-text-secondary)]">
                Les qualifications et rappels du jour sont sous contrôle.
              </p>
            </div>
          )}

          <div className="grid min-w-0 grid-cols-2 gap-3 md:flex md:justify-end">
            <Button type="button" variant="secondary" className={rivieraSecondaryButtonClass} onClick={onOpenPipeline}>
              <Target className="size-4" />
              <span className="truncate">
                <span className="md:hidden">Voir tout</span>
                <span className="hidden md:inline">Ouvrir les {priorities.length} priorités</span>
              </span>
            </Button>
            <Button type="button" className={rivieraPrimaryButtonClass} onClick={onCreateContact}>
              <Plus className="size-4" />
              <span className="truncate">
                <span className="md:hidden">Créer</span>
                <span className="hidden md:inline">Créer un contact</span>
              </span>
            </Button>
          </div>
        </RivieraPanel>

        <RivieraPanel className="grid content-start gap-4 p-4 lg:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">
              Pipeline commercial
            </h2>
            <RivieraStatusBadge>{metrics.totalLeads} actifs</RivieraStatusBadge>
          </div>
          <p className="text-sm text-[var(--crm-riviera-text-secondary)]">
            {metrics.totalLeads} dossiers actifs · {metrics.newLeads} en attente de décision
          </p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <RivieraMetric label="Leads" value={metrics.totalLeads} className="px-3 text-center" />
            <RivieraMetric label="Visites" value={metrics.visits} className="px-3 text-center" />
            <RivieraMetric label="Offres" value={metrics.offers} className="px-3 text-center" />
          </div>
          <button
            type="button"
            onClick={onOpenPipeline}
            className="min-h-11 w-fit rounded-lg text-sm font-semibold text-[var(--crm-riviera-text-action)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]"
          >
            Ouvrir le pipeline →
          </button>
        </RivieraPanel>

        <RivieraPanel className="grid gap-3 p-4 lg:col-span-4">
          <h2 className="font-semibold text-[var(--crm-riviera-text-primary)]">Nouveaux leads</h2>
          <p className="text-3xl font-bold text-[var(--crm-riviera-text-primary)]">{metrics.newLeads}</p>
          <p className="text-sm text-[var(--crm-riviera-text-secondary)]">
            {metrics.contactsToQualify} contact{metrics.contactsToQualify > 1 ? "s" : ""} à qualifier.
          </p>
          <button type="button" onClick={onOpenContacts} className="w-fit min-h-11 text-sm font-semibold text-[var(--crm-riviera-text-action)]">
            Voir les contacts →
          </button>
        </RivieraPanel>

        <RivieraPanel className="grid gap-3 p-4 lg:col-span-4">
          <h2 className="font-semibold text-[var(--crm-riviera-text-primary)]">Visites à venir</h2>
          <p className="text-3xl font-bold text-[var(--crm-riviera-text-primary)]">{metrics.visits}</p>
          <p className="text-sm text-[var(--crm-riviera-text-secondary)]">
            {metrics.todayTasks || todayTasks.length} prévue{(metrics.todayTasks || todayTasks.length) > 1 ? "s" : ""} aujourd&apos;hui · {metrics.openTasks || openTasks.length} action{(metrics.openTasks || openTasks.length) > 1 ? "s" : ""} ouverte{(metrics.openTasks || openTasks.length) > 1 ? "s" : ""}.
          </p>
          <button type="button" onClick={onOpenPipeline} className="w-fit min-h-11 text-sm font-semibold text-[var(--crm-riviera-text-action)]">
            Ouvrir l&apos;agenda →
          </button>
        </RivieraPanel>

        <RivieraPanel className="grid gap-3 p-4 lg:col-span-4">
          <h2 className="font-semibold text-[var(--crm-riviera-text-primary)]">Stock actif</h2>
          <p className="text-3xl font-bold text-[var(--crm-riviera-text-primary)]">
            {metrics.availableProperties}
          </p>
          <p className="text-sm text-[var(--crm-riviera-text-secondary)]">
            {metrics.propertiesWithoutPhotos} bien{metrics.propertiesWithoutPhotos > 1 ? "s" : ""} sans photo.
          </p>
          <button type="button" onClick={onOpenProperties} className="w-fit min-h-11 text-sm font-semibold text-[var(--crm-riviera-text-action)]">
            Analyser le stock →
          </button>
        </RivieraPanel>
      </div>
    </div>
  );
}

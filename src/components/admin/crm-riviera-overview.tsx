"use client";

import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CrmDailyPriority } from "@/lib/crm-dashboard";
import type { PipelineTask } from "@/types/crm";
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
  appointments: number;
  mandateSigned: number;
  availableProperties: number;
  propertiesWithoutPhotos: number;
  contactsToQualify: number;
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
}: {
  metrics: RivieraOverviewMetrics;
  priorities: CrmDailyPriority[];
  tasks: PipelineTask[];
  onPriorityAction: (priority: CrmDailyPriority) => void;
  onOpenPipeline: () => void;
  onOpenContacts: () => void;
  onOpenProperties: () => void;
  onCreateContact: () => void;
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
  const visiblePriorities = priorities.slice(0, 4);
  const formattedDate = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="grid gap-4 sm:gap-5">
      <div className="hidden items-center justify-between gap-6 md:flex">
        <div>
          <h2 className="text-3xl font-bold leading-10 text-[var(--crm-riviera-text-primary)]">
            Vue d&apos;ensemble — Aujourd&apos;hui
          </h2>
          <p className="mt-1 text-sm capitalize text-[var(--crm-riviera-text-secondary)]">
            {formattedDate} · Priorités de l&apos;équipe Riviera
          </p>
        </div>
        <RivieraStatusBadge tone={priorities.length ? "warning" : "success"}>
          {priorities.length ? `${priorities.length} priorités` : "Journée à jour"}
        </RivieraStatusBadge>
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <RivieraPanel className="grid gap-4 border-0 bg-transparent p-0 shadow-none md:border md:bg-[var(--crm-riviera-bg-surface)] md:p-5 md:shadow-[var(--crm-riviera-shadow-card)] lg:col-span-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold leading-6 text-[var(--crm-riviera-text-primary)]">
              À traiter maintenant
            </h2>
            <RivieraStatusBadge tone={priorities.length ? "warning" : "success"}>
              {priorities.length ? "Aujourd'hui" : "À jour"}
            </RivieraStatusBadge>
          </div>

          {visiblePriorities.length ? (
            <div className="grid gap-4 md:grid-cols-2">
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

          <div className="grid grid-cols-2 gap-3 md:flex md:justify-end">
            <Button type="button" variant="secondary" className={rivieraSecondaryButtonClass} onClick={onOpenPipeline}>
              <Target className="size-4" />
              Voir tout
            </Button>
            <Button type="button" className={rivieraPrimaryButtonClass} onClick={onCreateContact}>
              <Plus className="size-4" />
              Créer un contact
            </Button>
          </div>
        </RivieraPanel>

        <RivieraPanel className="grid content-start gap-4 p-5 lg:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">
              Pipeline commercial
            </h2>
            <RivieraStatusBadge>{metrics.totalLeads} actifs</RivieraStatusBadge>
          </div>
          <p className="text-sm text-[var(--crm-riviera-text-secondary)]">
            Données réelles issues des prospects et rappels enregistrés.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <RivieraMetric label="Nouveaux" value={metrics.newLeads} className="px-3 text-center" />
            <RivieraMetric label="Rendez-vous" value={metrics.appointments} className="px-3 text-center" />
            <RivieraMetric label="Mandats" value={metrics.mandateSigned} className="px-3 text-center" />
          </div>
          <button
            type="button"
            onClick={onOpenPipeline}
            className="min-h-11 w-fit rounded-lg text-sm font-semibold text-[var(--crm-riviera-text-action)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]"
          >
            Ouvrir le pipeline →
          </button>
        </RivieraPanel>

        <RivieraPanel className="grid gap-4 p-5 lg:col-span-4">
          <h2 className="font-semibold text-[var(--crm-riviera-text-primary)]">Nouveaux leads</h2>
          <p className="text-3xl font-bold text-[var(--crm-riviera-text-primary)]">{metrics.newLeads}</p>
          <p className="text-sm text-[var(--crm-riviera-text-secondary)]">
            {metrics.contactsToQualify} contact{metrics.contactsToQualify > 1 ? "s" : ""} à qualifier.
          </p>
          <button type="button" onClick={onOpenContacts} className="w-fit min-h-11 text-sm font-semibold text-[var(--crm-riviera-text-action)]">
            Voir les contacts →
          </button>
        </RivieraPanel>

        <RivieraPanel className="grid gap-4 p-5 lg:col-span-4">
          <h2 className="font-semibold text-[var(--crm-riviera-text-primary)]">Rappels aujourd&apos;hui</h2>
          <p className="text-3xl font-bold text-[var(--crm-riviera-text-primary)]">{todayTasks.length}</p>
          <p className="text-sm text-[var(--crm-riviera-text-secondary)]">
            {openTasks.length} rappel{openTasks.length > 1 ? "s" : ""} encore ouvert{openTasks.length > 1 ? "s" : ""}.
          </p>
          <button type="button" onClick={onOpenPipeline} className="w-fit min-h-11 text-sm font-semibold text-[var(--crm-riviera-text-action)]">
            Ouvrir les rappels →
          </button>
        </RivieraPanel>

        <RivieraPanel className="grid gap-4 p-5 lg:col-span-4">
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

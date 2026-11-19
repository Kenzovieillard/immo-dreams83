"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarPlus,
  Check,
  ContactRound,
  RefreshCw,
  SlidersHorizontal,
  UserRoundPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmOnboardingStepKey } from "@/types/crm";

type OnboardingStep = {
  key: CrmOnboardingStepKey;
  title: string;
  description: string;
  actionLabel: string;
  icon: LucideIcon;
  completed: boolean;
  onAction: () => void;
};

function ConfigurationStep({
  step,
  index,
  saving,
  onToggle,
}: {
  step: OnboardingStep;
  index: number;
  saving: boolean;
  onToggle?: (step: CrmOnboardingStepKey, completed: boolean) => void;
}) {
  const Icon = step.icon;

  return (
    <article
      className={cn(
        "group grid gap-4 rounded-2xl border bg-[var(--crm-riviera-bg-surface)] p-5 shadow-[var(--crm-riviera-shadow-card)] transition sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center",
        step.completed
          ? "border-[#b9ceb9]"
          : "border-[var(--crm-riviera-border-default)] hover:border-[#b8c6b6]"
      )}
    >
      <span
        className={cn(
          "grid size-11 place-items-center rounded-full border-2",
          step.completed
            ? "border-[var(--crm-riviera-status-success)] bg-[var(--crm-riviera-status-success)] text-white"
            : "border-[var(--crm-riviera-bg-action)] bg-white text-[var(--crm-riviera-bg-action)]"
        )}
      >
        {step.completed ? <Check className="size-5" aria-hidden="true" /> : <Icon className="size-5" aria-hidden="true" />}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--crm-riviera-text-secondary)]">
            Étape {index + 1}
          </span>
          <span
            className={cn(
              "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium",
              step.completed
                ? "bg-[#e4eee4] text-[#3f6b4d]"
                : "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-primary)]"
            )}
          >
            <span className={cn("size-1.5 rounded-full", step.completed ? "bg-[#4d7a5c]" : "bg-[#c28b2c]")} />
            {step.completed ? "Terminé" : "À faire"}
          </span>
        </div>
        <h3 className="mt-2 text-base font-semibold text-[var(--crm-riviera-text-primary)]">{step.title}</h3>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[var(--crm-riviera-text-secondary)]">{step.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {onToggle ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => onToggle(step.key, !step.completed)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--crm-riviera-border-default)] bg-white px-3 text-xs font-semibold text-[var(--crm-riviera-text-primary)] transition hover:border-[#91a88d] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]"
          >
            <Check className="size-3.5" aria-hidden="true" />
            {saving ? "Enregistrement..." : step.completed ? "Marquer à refaire" : "Marquer terminée"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={step.onAction}
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl bg-[var(--crm-riviera-bg-accent)] px-4 text-sm font-semibold text-[var(--crm-riviera-text-action)] transition hover:bg-[#cad9c6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]"
        >
          {step.completed ? "Consulter" : step.actionLabel}
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export function CrmRivieraOnboarding({
  profileCompleted = false,
  contactsCompleted = false,
  pipelineCompleted = false,
  appointmentCompleted = false,
  onOpenProfile,
  onOpenContacts,
  onOpenPipeline,
  onPlanAppointment,
  onToggleStep,
  savingStep = null,
  saveError = "",
}: {
  profileCompleted?: boolean;
  contactsCompleted?: boolean;
  pipelineCompleted?: boolean;
  appointmentCompleted?: boolean;
  onOpenProfile: () => void;
  onOpenContacts: () => void;
  onOpenPipeline: () => void;
  onPlanAppointment: () => void;
  onToggleStep?: (step: CrmOnboardingStepKey, completed: boolean) => void;
  savingStep?: CrmOnboardingStepKey | null;
  saveError?: string;
}) {
  const steps: OnboardingStep[] = [
    {
      key: "profile",
      title: "Compléter votre profil professionnel",
      description: "Ajoutez vos informations professionnelles afin de personnaliser les documents, les suivis commerciaux et les fiches de biens.",
      actionLabel: "Configurer",
      icon: UserRoundPen,
      completed: profileCompleted,
      onAction: onOpenProfile,
    },
    {
      key: "contacts",
      title: "Importer vos contacts et prospects",
      description: "Ajoutez vos premiers acquéreurs et vendeurs pour commencer à qualifier et suivre votre portefeuille client.",
      actionLabel: "Ajouter",
      icon: ContactRound,
      completed: contactsCompleted,
      onAction: onOpenContacts,
    },
    {
      key: "pipeline",
      title: "Configurer votre pipeline commercial",
      description: "Préparez le suivi des prospects, estimations, visites et offres selon le fonctionnement de votre agence.",
      actionLabel: "Ouvrir",
      icon: SlidersHorizontal,
      completed: pipelineCompleted,
      onAction: onOpenPipeline,
    },
    {
      key: "appointment",
      title: "Planifier votre premier rendez-vous",
      description: "Enregistrez une visite ou une estimation dans l’agenda partagé pour lancer votre premier suivi opérationnel.",
      actionLabel: "Planifier",
      icon: CalendarPlus,
      completed: appointmentCompleted,
      onAction: onPlanAppointment,
    },
  ];
  const completedCount = steps.filter((step) => step.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="grid min-w-0 gap-6 lg:gap-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[var(--crm-riviera-text-primary)] sm:text-4xl">
            Bienvenue sur CRM Riviera
          </h1>
          <p className="mt-2 text-sm text-[var(--crm-riviera-text-secondary)]">
            Configurez votre espace de travail en quelques étapes.
          </p>
        </div>
        <span className="inline-flex min-h-9 w-fit items-center gap-2 text-xs font-medium text-[var(--crm-riviera-text-secondary)]">
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Mis à jour à l&apos;instant
        </span>
      </section>

      <section className="overflow-hidden rounded-3xl bg-[var(--crm-riviera-bg-action)] p-6 text-white shadow-[var(--crm-riviera-shadow-card)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Votre nouvel outil de performance immobilière</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#dce5d7]">
              Suivez vos mandats, gérez vos contacts et optimisez vos visites sur la Côte d&apos;Azur. Complétez ces quatre étapes pour démarrer sereinement.
            </p>
          </div>
          <div className="flex w-fit items-center gap-4 rounded-2xl bg-white/10 p-4">
            <div
              className="grid size-14 place-items-center rounded-full"
              style={{ background: `conic-gradient(#dce5d7 ${progress}%, rgb(255 255 255 / 0.16) ${progress}% 100%)` }}
              aria-label={`${progress}% configuré`}
            >
              <span className="grid size-11 place-items-center rounded-full bg-[var(--crm-riviera-bg-action)] text-sm font-bold">
                {completedCount}/{steps.length}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold">Progression</p>
              <p className="mt-0.5 text-[11px] text-[#dce5d7]">{progress}% configuré</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="configuration-title" className="grid gap-4">
        <div>
          <h2 id="configuration-title" className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Étapes de configuration</h2>
          <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">Chaque étape ouvre directement l’outil correspondant dans le CRM.</p>
        </div>
        {saveError ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {saveError}
          </p>
        ) : null}
        <div className="grid gap-3">
          {steps.map((step, index) => (
            <ConfigurationStep
              key={step.key}
              step={step}
              index={index}
              saving={savingStep === step.key}
              onToggle={onToggleStep}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

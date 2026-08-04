"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmDailyPriorityTone } from "@/lib/crm-dashboard";

const statusToneClasses: Record<CrmDailyPriorityTone, string> = {
  neutral: "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-primary)]",
  success: "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-primary)]",
  warning: "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-primary)]",
  danger: "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-primary)]",
};

const statusDotClasses: Record<CrmDailyPriorityTone, string> = {
  neutral: "bg-[var(--crm-riviera-text-action)]",
  success: "bg-[var(--crm-riviera-status-success)]",
  warning: "bg-[var(--crm-riviera-status-warning)]",
  danger: "bg-[var(--crm-riviera-status-danger)]",
};

export function RivieraStatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: CrmDailyPriorityTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium leading-4",
        statusToneClasses[tone],
        className
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", statusDotClasses[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}

export function RivieraPanel({
  children,
  className,
  as: Component = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "article" | "aside" | "section";
}) {
  return (
    <Component
      className={cn(
        "w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] shadow-[var(--crm-riviera-shadow-card)]",
        className
      )}
    >
      {children}
    </Component>
  );
}

export function RivieraMetric({
  label,
  value,
  description,
  className,
}: {
  label: string;
  value: ReactNode;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl bg-[var(--crm-riviera-bg-accent)] px-3 py-3 sm:px-5 sm:py-4",
        className
      )}
    >
      <p className="text-2xl font-bold leading-8 text-[var(--crm-riviera-text-primary)] sm:text-3xl sm:leading-9">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium leading-4 text-[var(--crm-riviera-text-secondary)] sm:text-sm">
        {label}
      </p>
      {description ? (
        <p className="mt-2 text-xs leading-4 text-[var(--crm-riviera-text-secondary)]">{description}</p>
      ) : null}
    </div>
  );
}

export function RivieraActionCard({
  badge,
  title,
  context,
  timeLabel,
  actionLabel,
  tone,
  onAction,
}: {
  badge: string;
  title: string;
  context: string;
  timeLabel: string;
  actionLabel: string;
  tone: CrmDailyPriorityTone;
  onAction: () => void;
}) {
  const borderClass =
    tone === "danger"
      ? "border-[var(--crm-riviera-status-danger)]"
      : tone === "warning"
        ? "border-[var(--crm-riviera-status-warning)]"
        : "border-[var(--crm-riviera-border-default)]";

  return (
    <article
      className={cn(
        "grid w-full min-w-0 max-w-full gap-2 rounded-2xl border bg-[var(--crm-riviera-bg-surface)] p-3 shadow-[var(--crm-riviera-shadow-card)] sm:gap-3 sm:p-4",
        borderClass
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <RivieraStatusBadge tone={tone}>{badge}</RivieraStatusBadge>
        <span className="truncate text-xs font-medium text-[var(--crm-riviera-text-secondary)]">
          {timeLabel}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-6 text-[var(--crm-riviera-text-primary)]">
          {title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--crm-riviera-text-secondary)]">
          {context}
        </p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="ml-auto inline-flex min-h-8 max-w-full items-center justify-end gap-1.5 rounded-lg px-1 text-sm font-semibold text-[var(--crm-riviera-text-action)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]"
      >
        <span className="truncate">{actionLabel}</span>
        <ArrowRight className="size-4" />
      </button>
    </article>
  );
}

export const rivieraPrimaryButtonClass =
  "h-12 min-w-0 shrink rounded-2xl bg-[var(--crm-riviera-bg-action)] px-4 font-semibold whitespace-normal text-white hover:bg-[var(--crm-riviera-bg-header)] sm:h-11 sm:px-5";

export const rivieraSecondaryButtonClass =
  "h-12 min-w-0 shrink rounded-2xl border-0 bg-[var(--crm-riviera-bg-accent)] px-4 font-semibold whitespace-normal text-[var(--crm-riviera-text-primary)] hover:bg-[#cedbc8] sm:h-11 sm:px-5";

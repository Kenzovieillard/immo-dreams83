import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { bentoSpanClasses, type BentoSpan } from "./bento-grid";

export function BentoKpiCard({
  label,
  value,
  description,
  tone = "dark",
  className,
  span,
}: {
  label: string;
  value: ReactNode;
  description?: string;
  tone?: "dark" | "orange" | "success" | "warning";
  className?: string;
  span?: BentoSpan;
}) {
  const toneClassName = {
    dark: "text-[var(--crm-riviera-text-primary)]",
    orange: "text-[var(--crm-riviera-text-action)]",
    success: "text-[var(--crm-riviera-status-success)]",
    warning: "text-[#815c1a]",
  }[tone];

  return (
    <div
      className={cn(
        span ? bentoSpanClasses[span] : null,
        span
          ? "min-w-0 rounded-(--bento-card-radius) border border-[var(--bento-card-border)] bg-[var(--crm-riviera-bg-surface)] p-4 shadow-(--bento-card-shadow)"
          : "min-w-0 border-l-2 border-[var(--crm-riviera-bg-accent)] py-1 pl-3",
        className
      )}
    >
      <p className="text-xs font-semibold leading-5 text-[var(--crm-riviera-text-secondary)] sm:text-sm">{label}</p>
      <p className={cn("mt-1 break-words text-2xl font-black leading-tight sm:text-3xl", toneClassName)}>
        {value}
      </p>
      {description ? <p className="mt-2 text-xs leading-5 text-[var(--crm-riviera-text-secondary)]">{description}</p> : null}
    </div>
  );
}

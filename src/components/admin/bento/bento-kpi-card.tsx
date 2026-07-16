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
    dark: "text-[#111111]",
    orange: "text-orange-600",
    success: "text-emerald-700",
    warning: "text-yellow-700",
  }[tone];

  return (
    <div
      className={cn(
        span ? bentoSpanClasses[span] : null,
        "min-w-0 rounded-xl border border-orange-100 bg-white p-4 shadow-sm shadow-orange-100/30",
        className
      )}
    >
      <p className="text-xs font-semibold leading-5 text-gray-500 sm:text-sm">{label}</p>
      <p className={cn("mt-2 break-words text-2xl font-black leading-tight sm:text-3xl", toneClassName)}>
        {value}
      </p>
      {description ? <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p> : null}
    </div>
  );
}

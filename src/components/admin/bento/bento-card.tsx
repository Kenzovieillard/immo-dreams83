import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bentoSpanClasses, type BentoSpan } from "./bento-grid";

export type BentoVariant = "default" | "highlight" | "success" | "warning" | "danger" | "muted";

const variantClasses: Record<BentoVariant, string> = {
  default: "border-[var(--bento-card-border)] bg-[var(--bento-card-background)] text-[var(--crm-riviera-text-primary)]",
  highlight: "border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-primary)]",
  success: "border-emerald-100 bg-emerald-50 text-emerald-950",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-950",
  danger: "border-red-100 bg-red-50 text-red-950",
  muted: "border-[var(--bento-card-border)] bg-[var(--bento-card-muted-background)] text-[var(--crm-riviera-text-primary)]",
};

export function BentoCard({
  title,
  description,
  eyebrow,
  action,
  id,
  children,
  className,
  contentClassName,
  span = "medium",
  variant = "default",
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  id?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  span?: BentoSpan;
  variant?: BentoVariant;
}) {
  return (
    <Card
      id={id}
      className={cn(
        bentoSpanClasses[span],
        "min-w-0 rounded-(--bento-card-radius) border shadow-(--bento-card-shadow)",
        variantClasses[variant],
        className
      )}
    >
      <CardHeader className="gap-2 px-(--bento-card-padding)">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {eyebrow ? (
              <Badge className="mb-2 w-fit border-0 bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-action)]">{eyebrow}</Badge>
            ) : null}
            <CardTitle className="text-base font-bold leading-snug text-inherit sm:text-lg">
              {title}
            </CardTitle>
            {description ? (
              <p className="mt-1.5 text-sm leading-5 text-[var(--crm-riviera-text-secondary)]">{description}</p>
            ) : null}
          </div>
          {action ? <div className="self-end sm:shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("grid gap-4 px-(--bento-card-padding)", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

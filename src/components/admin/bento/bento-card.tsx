import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bentoSpanClasses, type BentoSpan } from "./bento-grid";

export type BentoVariant = "default" | "highlight" | "success" | "warning" | "danger" | "muted";

const variantClasses: Record<BentoVariant, string> = {
  default: "border-orange-100 bg-white text-[#111111]",
  highlight: "border-orange-200 bg-orange-50/90 text-[#111111]",
  success: "border-emerald-100 bg-emerald-50 text-emerald-950",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-950",
  danger: "border-red-100 bg-red-50 text-red-950",
  muted: "border-orange-100 bg-[#fffaf3] text-[#111111]",
};

export function BentoCard({
  title,
  description,
  eyebrow,
  action,
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
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  span?: BentoSpan;
  variant?: BentoVariant;
}) {
  return (
    <Card
      className={cn(
        bentoSpanClasses[span],
        "min-w-0 rounded-(--bento-card-radius) border shadow-(--bento-card-shadow)",
        "transition-shadow duration-200 hover:shadow-sm motion-reduce:transition-none",
        variantClasses[variant],
        className
      )}
    >
      <CardHeader className="gap-2 px-(--bento-card-padding)">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? (
              <Badge className="mb-2 w-fit border-0 bg-white text-orange-700">{eyebrow}</Badge>
            ) : null}
            <CardTitle className="text-lg font-black leading-tight text-inherit sm:text-xl">
              {title}
            </CardTitle>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("grid gap-4 px-(--bento-card-padding)", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

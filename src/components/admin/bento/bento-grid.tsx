import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BentoSpan = "small" | "medium" | "large" | "wide" | "tall" | "full";

export const bentoSpanClasses: Record<BentoSpan, string> = {
  small: "md:col-span-3 xl:col-span-3",
  medium: "md:col-span-3 xl:col-span-4",
  large: "md:col-span-6 xl:col-span-6",
  wide: "md:col-span-6 xl:col-span-8",
  tall: "md:col-span-3 xl:col-span-4 xl:row-span-2",
  full: "md:col-span-6 xl:col-span-12",
};

export function BentoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-(--bento-gap) md:grid-cols-6 xl:grid-cols-12",
        className
      )}
    >
      {children}
    </div>
  );
}

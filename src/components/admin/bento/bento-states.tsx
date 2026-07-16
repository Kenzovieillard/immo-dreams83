import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, LockKeyhole, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BentoEmptyState({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed border-orange-200 bg-orange-50/70 p-5 text-center", className)}>
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-white text-orange-600">
        {icon ?? <CheckCircle2 className="size-5" />}
      </div>
      <p className="mt-3 font-bold text-[#111111]">{title}</p>
      {description ? <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p> : null}
    </div>
  );
}

export function BentoErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
      <AlertCircle className="mr-2 inline size-4" />
      {message}
    </div>
  );
}

export function BentoPermissionState({ message = "Vous n'avez pas la permission de consulter ce bloc." }: { message?: string }) {
  return (
    <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm font-semibold text-orange-800">
      <LockKeyhole className="mr-2 inline size-4" />
      {message}
    </div>
  );
}

export function BentoCardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="grid gap-3" aria-label="Chargement">
      <Loader2 className="size-5 animate-spin text-orange-500 motion-reduce:animate-none" />
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-3 rounded-full bg-orange-100"
          style={{ width: `${85 - index * 12}%` }}
        />
      ))}
    </div>
  );
}

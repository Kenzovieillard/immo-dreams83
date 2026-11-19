"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const CommercialPreviewContext = createContext(false);

export const commercialPrimaryButton =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[#2f493a] px-4 text-sm font-semibold text-white transition hover:bg-[#17221e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f493a] disabled:cursor-not-allowed disabled:opacity-50";

export const commercialSecondaryButton =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#dfddd4] bg-[#fbfaf7] px-4 text-sm font-semibold text-[#18211f] transition hover:bg-[#f0eee8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f493a] disabled:cursor-not-allowed disabled:opacity-50";

export function CommercialPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[#dfddd4] bg-[#fbfaf7] shadow-[0_2px_8px_rgb(23_34_30/0.06)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CommercialPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#59645f]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] font-bold leading-9 tracking-[-0.035em] text-[#18211f] sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[#5f6964]">{description}</p>
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
        </div>
      ) : null}
    </header>
  );
}

const badgeTone: Record<string, string> = {
  neutral: "border-[#dfddd4] bg-[#eef1eb] text-[#26322d]",
  success: "border-[#c7d8c2] bg-[#dce5d7] text-[#274331]",
  warning: "border-[#ecd7ad] bg-[#f7edd7] text-[#815c1a]",
  danger: "border-[#ecc0bb] bg-[#f8ded9] text-[#943f37]",
  info: "border-[#b9d8ee] bg-[#dceefa] text-[#28658b]",
  dark: "border-[#17221e] bg-[#17221e] text-white",
};

export function CommercialBadge({
  children,
  tone = "neutral",
  className,
  dot = true,
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-4",
        badgeTone[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current opacity-70"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}

export function AgentAvatar({
  name,
  size = "sm",
}: {
  name: "Antoine" | "Sophie" | string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "xs"
      ? "size-5"
      : size === "md"
        ? "size-9"
        : size === "lg"
          ? "size-12"
          : "size-7";
  return (
    <span
      aria-label={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-white bg-[#dce5d7] text-[9px] font-bold text-[#274331]",
        sizeClass,
      )}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function DataSourceNotice({ demo = true }: { demo?: boolean }) {
  const preview = useContext(CommercialPreviewContext);
  demo = demo || preview;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
        demo ? "bg-[#f7edd7] text-[#815c1a]" : "bg-[#dce5d7] text-[#274331]",
      )}
    >
      <span className="size-2 rounded-full bg-current opacity-70" />
      {demo
        ? "Aperçu Figma · données de démonstration"
        : "Données Supabase synchronisées"}
    </span>
  );
}

export function CommercialPagination({
  basePath,
  page,
  limit,
  count,
  query,
  status,
}: {
  basePath: string;
  page: number;
  limit: number;
  count: number;
  query: string;
  status: string;
}) {
  const totalPages = Math.max(1, Math.ceil(count / limit));
  if (totalPages <= 1) return null;
  const href = (targetPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status && status !== "ALL") params.set("status", status);
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  };
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3"
    >
      <Link
        className={cn(
          commercialSecondaryButton,
          page <= 1 && "pointer-events-none opacity-50",
        )}
        href={href(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
      >
        Précédent
      </Link>
      <span className="text-sm text-[#5f6964]">
        Page {page} sur {totalPages}
      </span>
      <Link
        className={cn(
          commercialSecondaryButton,
          page >= totalPages && "pointer-events-none opacity-50",
        )}
        href={href(Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
      >
        Suivant
      </Link>
    </nav>
  );
}

export function CommercialFeedback({
  state,
  inline = false,
}: {
  state: { type: "loading" | "success" | "error"; message: string } | null;
  inline?: boolean;
}) {
  if (!state) return null;
  const Icon =
    state.type === "loading"
      ? LoaderCircle
      : state.type === "success"
        ? CheckCircle2
        : AlertCircle;
  return (
    <div
      role={state.type === "error" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl",
        inline
          ? "mb-4 w-full"
          : "fixed bottom-5 right-4 z-[110] w-[calc(100%-2rem)] max-w-sm",
        state.type === "error"
          ? "border-[#a94d43] bg-[#fff4f2] text-[#8d342d]"
          : "border-[#bfd1b9] bg-[#f4f8f2] text-[#274331]",
      )}
    >
      <Icon
        className={cn(
          "size-5 shrink-0",
          state.type === "loading" && "animate-spin",
        )}
      />
      {state.message}
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-semibold text-[#26322d]"
    >
      {children}
    </label>
  );
}

export const fieldClass =
  "min-h-11 w-full rounded-lg border border-[#dfddd4] bg-[#f8f7f3] px-3.5 text-sm text-[#18211f] outline-none transition placeholder:text-[#8b928e] focus:border-[#2f493a] focus:ring-2 focus:ring-[#2f493a]/10";

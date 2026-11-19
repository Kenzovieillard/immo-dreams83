"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Building2, Search, X } from "lucide-react";
import {
  AgentAvatar,
  CommercialBadge,
  CommercialPanel,
  commercialSecondaryButton,
} from "./commercial-ui";
import { commercialLabel, commercialTone } from "@/lib/commercial-presentation";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  return (
    <CommercialBadge tone={commercialTone(status)}>
      {commercialLabel(status)}
    </CommercialBadge>
  );
}
export function Person({
  name,
  label,
}: {
  name: string | null;
  label?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <AgentAvatar name={name ?? "?"} />
      <div className="min-w-0">
        {label && <p className="text-[10px] text-[#66716c]">{label}</p>}
        <p className="truncate text-xs font-medium">{name ?? "Non attribué"}</p>
      </div>
    </div>
  );
}
export function PropertyPhoto({
  src,
  title,
  className,
}: {
  src?: string | null;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cn(
        "relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#dce5d7] text-[#66716c]",
        className,
      )}
    >
      {src && !failed ? (
        <Image
          src={src}
          alt={title}
          fill
          unoptimized
          sizes="160px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Building2 className="size-6" aria-label="Photo non disponible" />
      )}
    </div>
  );
}
export function StatCards({
  items,
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    tone?: "success" | "warning" | "danger";
    note?: string;
  }>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[375px]:grid-cols-2 md:flex md:flex-wrap">
      {items.map((item) => (
        <CommercialPanel
          key={item.label}
          className="min-w-0 flex-1 p-4 md:min-w-28"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[#66716c]">{item.label}</p>
            {item.tone && (
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  item.tone === "success"
                    ? "bg-[#4f7d5e]"
                    : item.tone === "danger"
                      ? "bg-[#b34d40]"
                      : "bg-[#cb8f22]",
                )}
              />
            )}
          </div>
          <p className="mt-3 break-words text-[26px] font-bold leading-8 tracking-tight">
            {item.value}
          </p>
          {item.note && (
            <p className="mt-1 text-[11px] text-[#66716c]">{item.note}</p>
          )}
        </CommercialPanel>
      ))}
    </div>
  );
}
export function StatusTabs({
  basePath,
  values,
  active,
  query,
  total,
}: {
  basePath: string;
  values: string[];
  active: string;
  query: string;
  total?: number;
}) {
  return (
    <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
      {["ALL", ...values].map((value) => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (value !== "ALL") params.set("status", value);
        return (
          <Link
            key={value}
            href={`${basePath}?${params}`}
            aria-current={active === value ? "page" : undefined}
            className={cn(
              "inline-flex min-h-8 items-center gap-2 rounded-full border px-4 text-xs font-medium transition",
              active === value
                ? "border-[#17221e] bg-[#17221e] text-white"
                : "border-[#dfddd4] bg-[#fbfaf7] hover:bg-[#dce5d7]",
            )}
          >
            {value === "ALL" ? "Toutes" : commercialLabel(value)}
            {value === active && total != null && (
              <span className="rounded-full bg-[#dce5d7] px-1.5 text-[10px] text-[#2f493a]">
                {total}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
export function SearchFilters({
  query,
  status,
  placeholder,
  children,
}: {
  query: string;
  status: string;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <CommercialPanel className="p-3">
      <form method="get" className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="status" value={status} />
        <label className="relative min-w-40 flex-1">
          <span className="sr-only">Rechercher</span>
          <Search className="absolute left-3 top-3 size-4 text-[#66716c]" />
          <input
            name="q"
            defaultValue={query}
            placeholder={placeholder}
            className="h-10 w-full rounded-lg border border-[#dfddd4] bg-[#f6f4ef] pl-9 pr-3 text-xs outline-none focus:border-[#2f493a]"
          />
        </label>
        {children}
        <button className={commercialSecondaryButton}>Rechercher</button>
      </form>
    </CommercialPanel>
  );
}
export function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#66716c]">{label}</dt>
      <dd className="mt-2 break-words text-sm font-semibold">
        {children ?? "Non renseigné"}
      </dd>
    </div>
  );
}
export function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 rounded-2xl border border-[#dfddd4] bg-[#fbfaf7] p-5 sm:p-6">
      <legend className="float-left mb-5 w-full text-base font-semibold">
        {title}
      </legend>
      <div className="clear-both grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
export function CommercialDialog({
  title,
  onClose,
  children,
  drawer = false,
  dismissible = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
      className={cn(
        "fixed z-[100] overflow-y-auto border border-[#dfddd4] bg-[#fbfaf7] p-6 text-[#18211f] shadow-2xl backdrop:bg-[#17221e]/40 sm:p-8",
        drawer
          ? "inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[480px]"
          : "inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[600px] rounded-3xl",
      )}
    >
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#dfddd4] pb-5">
        <h2 id={titleId} className="text-xl font-bold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={!dismissible}
          aria-label="Fermer"
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-[#dce5d7]"
        >
          <X className="size-4" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

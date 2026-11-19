"use client";

import { useEffect, useState } from "react";
import { fieldClass } from "@/components/commercial/commercial-ui";
import type { AgendaOption } from "@/lib/agenda";
import { agendaRequest } from "./agenda-request";

export function AgendaLookup({
  label,
  kind,
  value,
  onChange,
  required,
  error,
}: {
  label: string;
  kind: "contact" | "property" | "estimation";
  value: AgendaOption | null;
  onChange: (option: AgendaOption | null) => void;
  required?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<{
    query: string;
    options: AgendaOption[];
    error?: string;
  } | null>(null);
  const pending = lookup?.query !== query;
  const items = lookup?.options ?? [];
  const options =
    value && !items.some(({ id }) => id === value.id)
      ? [value, ...items]
      : items;

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void agendaRequest<{ options: AgendaOption[] }>(
        { lookup: kind, q: query },
        { signal: controller.signal },
      )
        .then(({ options }) => {
          if (!controller.signal.aborted) setLookup({ options, query });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setLookup({
              options: [],
              query,
              error:
                error instanceof Error
                  ? error.message
                  : "Recherche indisponible.",
            });
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, kind]);

  return (
    <div className="grid min-w-0 gap-1.5 text-sm">
      <label className="grid gap-1.5">
        <span className="font-medium">Rechercher · {label}</span>
        <input
          className={`${fieldClass} w-full`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={80}
          autoComplete="off"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="font-medium">
          {label}
          {required ? " *" : ""}
        </span>
        <select
          className={`${fieldClass} w-full`}
          value={value?.id ?? ""}
          aria-invalid={Boolean(error)}
          onChange={(event) =>
            onChange(
              options.find(({ id }) => id === event.target.value) ?? null,
            )
          }
        >
          <option value="">
            {pending ? "Recherche en cours…" : "Sélectionner"}
          </option>
          {options.map(({ id, label, note }) => (
            <option key={id} value={id}>
              {label}
              {note ? ` · ${note}` : ""}
            </option>
          ))}
        </select>
      </label>
      {error || lookup?.error ? (
        <p role="alert" className="text-xs text-[#943f37]">
          {error || lookup?.error}
        </p>
      ) : null}
      {!pending && !lookup?.error && !options.length ? (
        <p className="text-xs text-[#59645f]">Aucun résultat.</p>
      ) : null}
    </div>
  );
}

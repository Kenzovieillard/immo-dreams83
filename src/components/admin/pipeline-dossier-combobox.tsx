"use client";

import { useId, useMemo } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { matchesPipelineDossierSearch } from "@/lib/crm-pipeline-rules";
import { cn } from "@/lib/utils";
import type { PipelineLead } from "@/types/crm";

function getDossierLabel(lead: PipelineLead) {
  return `${lead.contactName} · ${lead.requestType} · ${lead.city ?? "Ville non renseignée"}`;
}

export function PipelineDossierCombobox({
  leads,
  value,
  onValueChange,
  disabled = false,
  className,
}: {
  leads: PipelineLead[];
  value: string | null;
  onValueChange: (leadId: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputId = useId();
  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === value) ?? null,
    [leads, value]
  );

  return (
    <Combobox.Root
      items={leads}
      value={selectedLead}
      onValueChange={(lead) => onValueChange(lead?.id ?? null)}
      itemToStringLabel={getDossierLabel}
      itemToStringValue={(lead) => lead.id}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      filter={(lead, query) => matchesPipelineDossierSearch(lead, query)}
      autoHighlight
      disabled={disabled}
    >
      <div className={cn("grid gap-2", className)}>
        <label htmlFor={inputId} className="text-sm font-semibold text-[var(--crm-riviera-text-primary)]">
          Dossier concerné
        </label>
        <Combobox.InputGroup className="relative flex min-h-12 items-center rounded-lg border border-[var(--crm-riviera-border-default)] bg-white focus-within:border-[var(--crm-riviera-text-action)] focus-within:ring-2 focus-within:ring-[var(--crm-riviera-bg-accent)]">
          <Search className="ml-3 size-4 shrink-0 text-[var(--crm-riviera-text-secondary)]" aria-hidden="true" />
          <Combobox.Input
            id={inputId}
            placeholder="Rechercher un dossier, une ville, un bien..."
            className="h-12 min-w-0 flex-1 border-0 bg-transparent px-3 text-base text-[var(--crm-riviera-text-primary)] outline-none placeholder:text-[var(--crm-riviera-text-secondary)] md:text-sm"
          />
          {selectedLead ? (
            <Combobox.Clear
              aria-label="Effacer le dossier sélectionné"
              className="flex size-10 items-center justify-center text-[var(--crm-riviera-text-secondary)] hover:text-[var(--crm-riviera-text-primary)]"
            >
              <X className="size-4" />
            </Combobox.Clear>
          ) : null}
          <Combobox.Trigger
            aria-label="Afficher les dossiers"
            className="flex size-10 items-center justify-center text-[var(--crm-riviera-text-primary)]"
          >
            <ChevronDown className="size-4" />
          </Combobox.Trigger>
        </Combobox.InputGroup>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner className="z-[80] outline-none" sideOffset={6} align="start">
          <Combobox.Popup className="crm-riviera w-[var(--anchor-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-[var(--crm-riviera-border-default)] bg-white shadow-xl transition-[transform,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Combobox.Empty className="px-4 py-6 text-center text-sm text-[var(--crm-riviera-text-secondary)]">
              Aucun dossier ne correspond à cette recherche.
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(24rem,var(--available-height))] overflow-y-auto overscroll-contain p-1 outline-none">
              {(lead: PipelineLead) => (
                <Combobox.Item
                  key={lead.id}
                  value={lead}
                  className="grid cursor-default grid-cols-[1fr_auto] gap-3 rounded-md px-3 py-3 outline-none data-highlighted:bg-[var(--crm-riviera-bg-accent)] data-selected:bg-[var(--crm-riviera-bg-accent)]"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate font-semibold text-[var(--crm-riviera-text-primary)]">
                        {lead.contactName}
                      </p>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--crm-riviera-text-secondary)]">
                        {lead.dossierReference}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--crm-riviera-text-secondary)]">
                      {lead.requestType} · {lead.city ?? "Ville non renseignée"}
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-[var(--crm-riviera-text-action)]">
                      {lead.linkedPropertyTitle ?? "Aucun bien lié"} · {lead.assignedToName ?? "Non attribué"}
                    </p>
                  </div>
                  <Combobox.ItemIndicator className="mt-1 text-[var(--crm-riviera-text-action)]">
                    <Check className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

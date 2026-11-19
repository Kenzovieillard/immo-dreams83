"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Building2, Check, ChevronDown, FileSignature, Search } from "lucide-react";
import { PipelineDossierCombobox } from "@/components/admin/pipeline-dossier-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice, type Property } from "@/data/properties";
import { normalizeCrmSearch } from "@/lib/crm";
import { getPropertyOfferIneligibility } from "@/lib/crm-pipeline-rules";
import type {
  AdminTeamMember,
  OfferFinancingType,
  PipelineLead,
} from "@/types/crm";

const financingLabels: Record<OfferFinancingType, string> = {
  CASH: "Comptant",
  LOAN: "Avec prêt",
  MIXED: "Financement mixte",
  UNKNOWN: "Non renseigné",
};

function getDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getDateTimeInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getTeamMemberLabel(member: AdminTeamMember | undefined) {
  return member?.fullName?.trim() || member?.email || "Agent";
}

function PropertyCombobox({
  properties,
  value,
  onValueChange,
  disabled,
}: {
  properties: Property[];
  value: string | null;
  onValueChange: (propertyId: string | null) => void;
  disabled: boolean;
}) {
  const inputId = useId();
  const selectedProperty = properties.find((property) => property.id === value) ?? null;

  return (
    <Combobox.Root
      items={properties}
      value={selectedProperty}
      onValueChange={(property) => onValueChange(property?.id ?? null)}
      itemToStringLabel={(property) => `Réf. ${property.reference} · ${property.title}`}
      itemToStringValue={(property) => property.id}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      filter={(property, query) =>
        normalizeCrmSearch(
          `${property.reference} ${property.title} ${property.city} ${property.postalCode}`
        ).includes(normalizeCrmSearch(query))
      }
      autoHighlight
      disabled={disabled}
    >
      <div className="grid gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-[var(--crm-riviera-text-primary)]">
          Bien concerné
        </label>
        <Combobox.InputGroup className="relative flex min-h-12 items-center rounded-lg border border-[var(--crm-riviera-border-default)] bg-white focus-within:border-[var(--crm-riviera-text-action)] focus-within:ring-2 focus-within:ring-[var(--crm-riviera-bg-accent)]">
          <Search className="ml-3 size-4 text-[var(--crm-riviera-text-secondary)]" aria-hidden="true" />
          <Combobox.Input
            id={inputId}
            placeholder="Rechercher une référence, un titre, une ville..."
            className="h-12 min-w-0 flex-1 border-0 bg-transparent px-3 text-base outline-none placeholder:text-[var(--crm-riviera-text-secondary)] md:text-sm"
          />
          <Combobox.Trigger aria-label="Afficher les biens" className="flex size-10 items-center justify-center">
            <ChevronDown className="size-4" />
          </Combobox.Trigger>
        </Combobox.InputGroup>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner className="z-[90] outline-none" sideOffset={6} align="start">
          <Combobox.Popup className="crm-riviera w-[var(--anchor-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-[var(--crm-riviera-border-default)] bg-white shadow-xl">
            <Combobox.Empty className="px-4 py-6 text-center text-sm text-[var(--crm-riviera-text-secondary)]">
              Aucun bien éligible trouvé.
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(22rem,var(--available-height))] overflow-y-auto p-1 outline-none">
              {(property: Property) => (
                <Combobox.Item
                  key={property.id}
                  value={property}
                  className="grid cursor-default grid-cols-[1fr_auto] gap-3 rounded-md px-3 py-3 outline-none data-highlighted:bg-[var(--crm-riviera-bg-accent)] data-selected:bg-[var(--crm-riviera-bg-accent)]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--crm-riviera-text-primary)]">
                      Réf. {property.reference} · {property.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">
                      {property.city} · {formatPrice(property.price)}
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

export function OfferComposer({
  open,
  onOpenChange,
  leads,
  properties,
  team,
  initialLeadId,
  initialPropertyId,
  connected,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: PipelineLead[];
  properties: Property[];
  team: AdminTeamMember[];
  initialLeadId: string | null;
  initialPropertyId: string | null;
  connected: boolean;
  onSaved: (message: string) => Promise<void>;
}) {
  const router = useRouter();
  const activeLeads = useMemo(
    () => leads.filter((lead) => !lead.archived && lead.status !== "LOST" && Boolean(lead.contactId)),
    [leads]
  );
  const eligibleProperties = useMemo(
    () =>
      properties.filter((property) => getPropertyOfferIneligibility(property) === null),
    [properties]
  );
  const [leadId, setLeadId] = useState<string | null>(initialLeadId);
  const [propertyId, setPropertyId] = useState<string | null>(initialPropertyId);
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [offerDate, setOfferDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [financingType, setFinancingType] = useState<OfferFinancingType>("UNKNOWN");
  const [downPaymentAmount, setDownPaymentAmount] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [suspensiveConditions, setSuspensiveConditions] = useState("");
  const [includedFurniture, setIncludedFurniture] = useState("");
  const [negotiationComment, setNegotiationComment] = useState("");
  const [nextAction, setNextAction] = useState("Faire signer l'offre à l'acquéreur");
  const [nextActionDueAt, setNextActionDueAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const selectedLead = activeLeads.find((lead) => lead.id === leadId) ?? null;
  const selectedProperty = eligibleProperties.find((property) => property.id === propertyId) ?? null;
  const propertyLocked = Boolean(initialPropertyId);

  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const validity = new Date(today);
    validity.setDate(validity.getDate() + 7);
    const nextDue = new Date(today);
    nextDue.setDate(nextDue.getDate() + 1);
    nextDue.setHours(10, 0, 0, 0);
    const nextLead = activeLeads.find((lead) => lead.id === initialLeadId) ?? null;
    const nextPropertyId =
      eligibleProperties.find((property) => property.id === initialPropertyId)?.id ??
      nextLead?.linkedPropertyId ??
      null;

    const resetId = window.setTimeout(() => {
      setLeadId(nextLead?.id ?? null);
      setPropertyId(nextPropertyId);
      setResponsibleUserId(nextLead?.assignedTo ?? team[0]?.id ?? "");
      setAmount("");
      setOfferDate(getDateInputValue(today));
      setValidUntil(getDateInputValue(validity));
      setFinancingType("UNKNOWN");
      setDownPaymentAmount("");
      setLoanAmount("");
      setSuspensiveConditions("");
      setIncludedFurniture("");
      setNegotiationComment("");
      setNextAction("Faire signer l'offre à l'acquéreur");
      setNextActionDueAt(getDateTimeInputValue(nextDue));
      setError("");
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [activeLeads, eligibleProperties, initialLeadId, initialPropertyId, open, team]);

  function selectLead(nextLeadId: string | null) {
    setLeadId(nextLeadId);
    const nextLead = activeLeads.find((lead) => lead.id === nextLeadId) ?? null;
    setResponsibleUserId(nextLead?.assignedTo ?? team[0]?.id ?? "");
    if (!propertyLocked && nextLead?.linkedPropertyId) setPropertyId(nextLead.linkedPropertyId);
  }

  async function submit() {
    if (
      !selectedLead?.contactId ||
      !selectedProperty ||
      !responsibleUserId ||
      !amount ||
      !offerDate ||
      !validUntil ||
      !nextAction.trim() ||
      !nextActionDueAt
    ) {
      setError("Complétez le bien, le dossier, le responsable, le montant, les dates et la prochaine action.");
      return;
    }
    if (!connected) {
      setError("Supabase doit être connecté pour enregistrer une offre réelle.");
      return;
    }

    setPending(true);
    setError("");
    const response = await fetch("/api/admin/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: selectedProperty.id,
        buyerDossierId: selectedLead.id,
        buyerContactId: selectedLead.contactId,
        responsibleUserId,
        amount,
        offerDate,
        validUntil,
        financingType,
        downPaymentAmount,
        loanAmount,
        suspensiveConditions,
        includedFurniture,
        negotiationComment,
        nextAction,
        nextActionDueAt,
      }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    setPending(false);

    if (!response?.ok) {
      if (response?.status === 401) router.push("/admin/login");
      setError(payload?.message ?? "L'offre n'a pas pu être créée.");
      return;
    }

    await onSaved(payload?.message ?? "Brouillon d'offre créé.");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="crm-riviera !w-screen max-w-none gap-0 bg-[var(--crm-riviera-bg-surface)] sm:!w-[min(94vw,32rem)] sm:!max-w-[32rem]"
        overlayClassName="supports-backdrop-filter:backdrop-blur-none"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] px-4 py-4 pr-14">
          <SheetTitle className="text-lg font-semibold">Créer une offre</SheetTitle>
          <SheetDescription>Le bien et l&apos;acquéreur restent liés à leurs fiches d&apos;origine.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="grid gap-5">
            {propertyLocked && selectedProperty ? (
              <div className="rounded-lg border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-accent)] p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--crm-riviera-text-secondary)]">
                  <Building2 className="size-4" />
                  Bien lié
                </p>
                <p className="mt-2 font-semibold text-[var(--crm-riviera-text-primary)]">
                  Réf. {selectedProperty.reference} · {selectedProperty.title}
                </p>
                <p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">
                  {selectedProperty.city} · {formatPrice(selectedProperty.price)}
                </p>
              </div>
            ) : (
              <PropertyCombobox
                properties={eligibleProperties}
                value={propertyId}
                onValueChange={setPropertyId}
                disabled={pending}
              />
            )}

            <PipelineDossierCombobox
              leads={activeLeads}
              value={leadId}
              onValueChange={selectLead}
              disabled={pending}
            />

            {selectedLead ? (
              <div className="rounded-lg bg-[var(--crm-riviera-bg-accent)] p-3 text-sm">
                <p className="text-xs text-[var(--crm-riviera-text-secondary)]">Acquéreur</p>
                <p className="mt-1 font-semibold text-[var(--crm-riviera-text-primary)]">
                  {selectedLead.contactName}
                </p>
                <p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">
                  {selectedLead.dossierReference} · {selectedLead.requestType} · {selectedLead.city ?? "Ville non renseignée"}
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="offer-amount">Montant proposé</Label>
                <Input
                  id="offer-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="167000"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-2">
                <Label>Responsable</Label>
                <Select value={responsibleUserId} onValueChange={(value) => setResponsibleUserId(String(value))}>
                  <SelectTrigger aria-label="Responsable de l'offre" className="min-h-11">
                    <SelectValue>
                      {(value) => getTeamMemberLabel(team.find((member) => member.id === value))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {team.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {getTeamMemberLabel(member)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-date">Date de l&apos;offre</Label>
                <Input id="offer-date" type="date" value={offerDate} onChange={(event) => setOfferDate(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-valid-until">Valable jusqu&apos;au</Label>
                <Input id="offer-valid-until" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-1">
                <Label>Financement</Label>
                <Select value={financingType} onValueChange={(value) => setFinancingType(value as OfferFinancingType)}>
                  <SelectTrigger aria-label="Mode de financement" className="min-h-11">
                    <SelectValue>{(value) => financingLabels[value as OfferFinancingType]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(financingLabels) as OfferFinancingType[]).map((value) => (
                      <SelectItem key={value} value={value}>{financingLabels[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-down-payment">Apport</Label>
                <Input id="offer-down-payment" inputMode="decimal" value={downPaymentAmount} onChange={(event) => setDownPaymentAmount(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-loan">Montant du prêt</Label>
                <Input id="offer-loan" inputMode="decimal" value={loanAmount} onChange={(event) => setLoanAmount(event.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="offer-conditions">Conditions suspensives</Label>
              <Textarea id="offer-conditions" value={suspensiveConditions} onChange={(event) => setSuspensiveConditions(event.target.value)} className="min-h-20" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="offer-furniture">Mobilier inclus</Label>
              <Input id="offer-furniture" value={includedFurniture} onChange={(event) => setIncludedFurniture(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="offer-comment">Commentaire de négociation</Label>
              <Textarea id="offer-comment" value={negotiationComment} onChange={(event) => setNegotiationComment(event.target.value)} className="min-h-20" />
            </div>

            <div className="grid gap-4 rounded-lg border border-[var(--crm-riviera-border-default)] p-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="offer-next-action">Prochaine action</Label>
                <Input id="offer-next-action" value={nextAction} onChange={(event) => setNextAction(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-next-action-due">Échéance</Label>
                <Input id="offer-next-action-due" type="datetime-local" value={nextActionDueAt} onChange={(event) => setNextActionDueAt(event.target.value)} />
              </div>
            </div>

            {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
          </div>
        </div>

        <SheetFooter className="sticky bottom-0 z-10 mt-0 border-t border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] px-4 py-4 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={pending || !selectedLead || !selectedProperty || !amount || !responsibleUserId}
            className="bg-[var(--crm-riviera-bg-action)] text-white hover:bg-[var(--crm-riviera-bg-header)]"
          >
            <FileSignature className="size-4" />
            {pending ? "Enregistrement..." : "Créer le brouillon"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

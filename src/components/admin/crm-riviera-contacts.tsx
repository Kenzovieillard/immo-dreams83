"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Check,
  Download,
  Mail,
  Phone,
  Save,
  Search,
  Target,
  UserRoundCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  contactQualificationStatuses,
  contactQualificationStatusLabels,
  contactRoleLabels,
  contactRoles,
  leadStatusLabels,
  leadStatuses,
} from "@/lib/crm";
import { cn } from "@/lib/utils";
import type {
  AdminCrmLead,
  ContactQualificationStatus,
  ContactRole,
  LeadStatus,
} from "@/types/crm";
import {
  RivieraMetric,
  RivieraPanel,
  RivieraStatusBadge,
  rivieraPrimaryButtonClass,
  rivieraSecondaryButtonClass,
} from "./crm-riviera-ui";

type ContactFilter = "ALL" | ContactQualificationStatus;
type RoleFilter = "ALL" | ContactRole;

const qualificationOrder: Record<ContactQualificationStatus, number> = {
  TO_REVIEW: 0,
  QUALIFIED: 1,
  NO_CONTACT: 2,
  DUPLICATE: 3,
  INACTIVE: 4,
};

function qualificationTone(status: ContactQualificationStatus) {
  if (status === "QUALIFIED") return "success" as const;
  if (status === "TO_REVIEW") return "warning" as const;
  if (status === "NO_CONTACT" || status === "DUPLICATE") return "danger" as const;
  return "neutral" as const;
}

function hasRealEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return Boolean(normalized && !normalized.endsWith("@legacy.immo-dreams83.local"));
}

function hasRealPhone(phone: string) {
  return phone.replace(/\D/g, "").length >= 8;
}

function formatReceivedAt(value: string) {
  const date = new Date(value);
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 60) return `Reçu il y a ${elapsedMinutes} min`;
  if (elapsedMinutes < 24 * 60) return `Reçu il y a ${Math.round(elapsedMinutes / 60)} h`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function exportContacts(leads: AdminCrmLead[]) {
  const rows = [
    ["Nom", "Email", "Téléphone", "Rôle", "Qualification", "Demande", "Ville"],
    ...leads
      .filter((lead) => !lead.archived)
      .map((lead) => [
        lead.name,
        lead.email,
        lead.phone,
        lead.contactRole ? contactRoleLabels[lead.contactRole] : "",
        lead.qualificationStatus ? contactQualificationStatusLabels[lead.qualificationStatus] : "",
        lead.category,
        lead.city,
      ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `contacts-immo-dreams-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ContactMethod({
  valid,
  icon,
  label,
}: {
  valid: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-16 items-start gap-2 rounded-2xl p-3 text-sm font-semibold",
        valid
          ? "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-primary)]"
          : "border border-[var(--crm-riviera-status-danger)] bg-[var(--crm-riviera-bg-surface)] text-[var(--crm-riviera-status-danger)]"
      )}
    >
      {valid ? <Check className="mt-0.5 size-4 shrink-0" /> : <X className="mt-0.5 size-4 shrink-0" />}
      <span className="grid gap-1">
        <span className="inline-flex items-center gap-1.5">{icon}{label}</span>
        <span className="text-xs font-normal">{valid ? "Validé" : "À compléter"}</span>
      </span>
    </div>
  );
}

export function CrmRivieraContacts({
  leads,
  setLeads,
  connected,
  search,
  onSearchChange,
  selectedContactId,
  onSelectedContactChange,
  pendingId,
  feedback,
  onSaveQualification,
  onCreateProspect,
  onPersist,
  onOpenPipeline,
}: {
  leads: AdminCrmLead[];
  setLeads: React.Dispatch<React.SetStateAction<AdminCrmLead[]>>;
  connected: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selectedContactId: string | null;
  onSelectedContactChange: (id: string | null) => void;
  pendingId: string | null;
  feedback: string;
  onSaveQualification: (lead: AdminCrmLead) => Promise<void>;
  onCreateProspect: (lead: AdminCrmLead) => Promise<void>;
  onPersist: (lead: AdminCrmLead, updates: Partial<AdminCrmLead>) => Promise<boolean>;
  onOpenPipeline: () => void;
}) {
  const [qualificationFilter, setQualificationFilter] = useState<ContactFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const normalizedSearch = search.trim().toLocaleLowerCase("fr-FR");

  const activeContacts = useMemo(
    () => leads.filter((lead) => lead.kind === "contacts" && !lead.archived),
    [leads]
  );
  const visibleContacts = useMemo(
    () =>
      activeContacts
        .filter((lead) => {
          const haystack = `${lead.name} ${lead.email} ${lead.phone} ${lead.city} ${lead.category}`.toLocaleLowerCase("fr-FR");
          return (
            (!normalizedSearch || haystack.includes(normalizedSearch)) &&
            (qualificationFilter === "ALL" || lead.qualificationStatus === qualificationFilter) &&
            (roleFilter === "ALL" || lead.contactRole === roleFilter)
          );
        })
        .sort((first, second) => {
          const firstRank = first.qualificationStatus
            ? qualificationOrder[first.qualificationStatus]
            : 99;
          const secondRank = second.qualificationStatus
            ? qualificationOrder[second.qualificationStatus]
            : 99;
          return firstRank - secondRank || new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
        }),
    [activeContacts, normalizedSearch, qualificationFilter, roleFilter]
  );

  const selectedContact =
    activeContacts.find((lead) => lead.id === selectedContactId) ?? null;

  const metrics = {
    toReview: activeContacts.filter((lead) => lead.qualificationStatus === "TO_REVIEW").length,
    ready: activeContacts.filter(
      (lead) =>
        lead.qualificationStatus === "QUALIFIED" &&
        lead.activeProspect &&
        lead.contactRole !== "UNKNOWN" &&
        !lead.pipelineLeadId
    ).length,
    noContact: activeContacts.filter((lead) => lead.qualificationStatus === "NO_CONTACT").length,
  };

  function updateSelected(updates: Partial<AdminCrmLead>) {
    if (!selectedContact) return;
    setLeads((current) =>
      current.map((lead) => (lead.id === selectedContact.id ? { ...lead, ...updates } : lead))
    );
  }

  function selectNextToQualify() {
    const next = activeContacts
      .filter((lead) => lead.qualificationStatus === "TO_REVIEW")
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())[0];
    if (next) openContact(next.id);
  }

  function openContact(id: string) {
    onSelectedContactChange(id);
  }

  function showDuplicates() {
    setQualificationFilter("DUPLICATE");
    onSelectedContactChange(null);
  }

  return (
    <div className="grid gap-4 sm:gap-5">
      <div className={cn("hidden items-end justify-between gap-6 md:flex", selectedContactId && "md:flex")}>
        <div>
          <h2 className="text-3xl font-bold leading-10 text-[var(--crm-riviera-text-primary)]">Contacts</h2>
          <p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">
            Qualifier, dédupliquer et transformer les contacts.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className={rivieraSecondaryButtonClass}
          onClick={() => exportContacts(activeContacts)}
        >
          <Download className="size-4" />
          Exporter
        </Button>
      </div>

      <div className={cn("grid grid-cols-3 gap-2 sm:gap-3", selectedContact && "hidden md:grid")}>
        <RivieraMetric label="À qualifier" value={metrics.toReview} />
        <RivieraMetric label="Prêts" value={metrics.ready} />
        <RivieraMetric label="Sans contact" value={metrics.noContact} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(330px,1fr)] lg:gap-5">
        <RivieraPanel className={cn("grid content-start gap-3 p-4 sm:p-5", selectedContact && "hidden lg:grid")}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Contacts actifs</h3>
            <RivieraStatusBadge>{visibleContacts.length} résultats</RivieraStatusBadge>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--crm-riviera-text-secondary)]" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Rechercher nom, téléphone ou email…"
              aria-label="Rechercher un contact"
              className="h-12 rounded-2xl pl-11"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtres de contacts">
            <button
              type="button"
              onClick={() => setQualificationFilter((current) => current === "TO_REVIEW" ? "ALL" : "TO_REVIEW")}
              aria-pressed={qualificationFilter === "TO_REVIEW"}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3 text-xs font-medium",
                qualificationFilter === "TO_REVIEW"
                  ? "bg-[var(--crm-riviera-bg-action)] text-white"
                  : "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-primary)]"
              )}
            >
              À qualifier
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter((current) => current === "SELLER" ? "ALL" : "SELLER")}
              aria-pressed={roleFilter === "SELLER"}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3 text-xs font-medium",
                roleFilter === "SELLER"
                  ? "bg-[var(--crm-riviera-bg-action)] text-white"
                  : "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-primary)]"
              )}
            >
              Vendeurs
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter((current) => current === "BUYER" ? "ALL" : "BUYER")}
              aria-pressed={roleFilter === "BUYER"}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3 text-xs font-medium",
                roleFilter === "BUYER"
                  ? "bg-[var(--crm-riviera-bg-action)] text-white"
                  : "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-primary)]"
              )}
            >
              Acquéreurs
            </button>
          </div>

          {feedback && !selectedContact ? (
            <p className="rounded-xl bg-[var(--crm-riviera-bg-accent)] p-3 text-sm text-[var(--crm-riviera-text-primary)]" aria-live="polite">
              {feedback}
            </p>
          ) : null}

          <div className="grid max-h-[38rem] gap-3 overflow-y-auto pr-0.5">
            {visibleContacts.length ? (
              visibleContacts.map((lead) => {
                const status = lead.qualificationStatus ?? "TO_REVIEW";
                const phoneAvailable = hasRealPhone(lead.phone);
                const roleLabel = lead.contactRole && lead.contactRole !== "UNKNOWN"
                  ? contactRoleLabels[lead.contactRole]
                  : lead.category;
                const readyForPipeline =
                  status === "QUALIFIED" &&
                  lead.activeProspect &&
                  lead.contactRole !== "UNKNOWN" &&
                  !lead.pipelineLeadId;
                const badgeLabel = lead.pipelineLeadId
                  ? "Dans le pipeline"
                  : readyForPipeline
                    ? "Prêt pipeline"
                    : contactQualificationStatusLabels[status];

                return (
                  <article
                    key={lead.id}
                    className="grid gap-2 rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] px-3.5 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate font-semibold text-[var(--crm-riviera-text-primary)]">{lead.name}</h4>
                        <p className="mt-1 truncate text-xs text-[var(--crm-riviera-text-secondary)]">
                          {roleLabel} · {formatReceivedAt(lead.createdAt)}
                        </p>
                      </div>
                      <RivieraStatusBadge tone={qualificationTone(status)} className="shrink-0">
                        {badgeLabel}
                      </RivieraStatusBadge>
                    </div>
                    <p className="truncate text-xs text-[var(--crm-riviera-text-secondary)]">
                      {lead.city} · {lead.email}
                    </p>
                    <div className="flex min-h-11 items-center justify-end gap-2 text-sm font-semibold text-[var(--crm-riviera-text-action)]">
                      {phoneAvailable ? (
                        <a
                          href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
                          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2"
                        >
                          <Phone className="size-4" />
                          Appeler
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openContact(lead.id)}
                        className="inline-flex min-h-11 items-center rounded-lg px-2"
                      >
                        Qualifier →
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl bg-[var(--crm-riviera-bg-accent)] px-5 py-10 text-center">
                <p className="font-semibold text-[var(--crm-riviera-text-primary)]">Aucun contact trouvé</p>
                <p className="mt-2 text-sm text-[var(--crm-riviera-text-secondary)]">Modifiez la recherche ou les filtres.</p>
              </div>
            )}
          </div>
        </RivieraPanel>

        {selectedContact ? (
          <QualificationPanel
            lead={selectedContact}
            connected={connected}
            pendingId={pendingId}
            feedback={feedback}
            onBack={() => onSelectedContactChange(null)}
            onUpdate={updateSelected}
            onSaveQualification={onSaveQualification}
            onCreateProspect={onCreateProspect}
            onPersist={onPersist}
            onOpenPipeline={onOpenPipeline}
          />
        ) : (
          <RivieraPanel as="aside" className="hidden content-start gap-4 p-5 lg:grid">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Qualification</h3>
              <RivieraStatusBadge>Aujourd&apos;hui</RivieraStatusBadge>
            </div>
            <RivieraMetric
              label="contacts attendent une validation humaine"
              value={metrics.toReview}
            />
            <p className="text-sm leading-5 text-[var(--crm-riviera-text-secondary)]">
              Priorité aux contacts récents avec un téléphone ou un email exploitable.
            </p>
            <h4 className="font-semibold text-[var(--crm-riviera-text-primary)]">Actions rapides</h4>
            <Button type="button" className={rivieraPrimaryButtonClass} onClick={selectNextToQualify} disabled={!metrics.toReview}>
              <UserRoundCheck className="size-4" />
              Qualifier le prochain
            </Button>
            <Button type="button" variant="secondary" className={rivieraSecondaryButtonClass} onClick={showDuplicates}>
              Afficher les doublons
            </Button>
          </RivieraPanel>
        )}
      </div>
    </div>
  );
}

function QualificationPanel({
  lead,
  connected,
  pendingId,
  feedback,
  onBack,
  onUpdate,
  onSaveQualification,
  onCreateProspect,
  onPersist,
  onOpenPipeline,
}: {
  lead: AdminCrmLead;
  connected: boolean;
  pendingId: string | null;
  feedback: string;
  onBack: () => void;
  onUpdate: (updates: Partial<AdminCrmLead>) => void;
  onSaveQualification: (lead: AdminCrmLead) => Promise<void>;
  onCreateProspect: (lead: AdminCrmLead) => Promise<void>;
  onPersist: (lead: AdminCrmLead, updates: Partial<AdminCrmLead>) => Promise<boolean>;
  onOpenPipeline: () => void;
}) {
  const role = lead.contactRole ?? "UNKNOWN";
  const qualificationStatus = lead.qualificationStatus ?? "TO_REVIEW";
  const qualificationDisablesProspect = ["DUPLICATE", "NO_CONTACT", "INACTIVE"].includes(qualificationStatus);
  const readyForPipeline =
    qualificationStatus === "QUALIFIED" &&
    lead.activeProspect &&
    role !== "UNKNOWN" &&
    !lead.pipelineLeadId;
  const phoneValid = hasRealPhone(lead.phone);
  const emailValid = hasRealEmail(lead.email);

  return (
    <RivieraPanel
      as="aside"
      className="fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] top-[176px] z-20 grid content-start gap-4 overflow-y-auto p-4 sm:p-5 lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-5 lg:z-auto lg:max-h-[calc(100dvh-2.5rem)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-[var(--crm-riviera-text-primary)]">
            Qualification commerciale
          </h3>
          <p className="mt-1 truncate text-xs text-[var(--crm-riviera-text-secondary)]">
            {lead.name} · {formatReceivedAt(lead.createdAt)}
          </p>
        </div>
        <RivieraStatusBadge tone={lead.pipelineLeadId ? "success" : "neutral"} className="shrink-0">
          {lead.pipelineLeadId ? "Étape 2/2" : "Étape 1/2"}
        </RivieraStatusBadge>
      </div>

      {feedback ? (
        <p className="rounded-xl bg-[var(--crm-riviera-bg-accent)] p-3 text-sm text-[var(--crm-riviera-text-primary)]" aria-live="polite">
          {feedback}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label>Rôle</Label>
        <Select value={role} onValueChange={(value) => onUpdate({ contactRole: value as ContactRole })}>
          <SelectTrigger className="w-full rounded-xl"><SelectValue>{(value) => contactRoleLabels[value as ContactRole]}</SelectValue></SelectTrigger>
          <SelectContent>
            {contactRoles.map((value) => <SelectItem key={value} value={value}>{contactRoleLabels[value]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>État de qualification</Label>
        <Select
          value={qualificationStatus}
          onValueChange={(value) => {
            const nextStatus = value as ContactQualificationStatus;
            onUpdate({
              qualificationStatus: nextStatus,
              activeProspect: ["DUPLICATE", "NO_CONTACT", "INACTIVE"].includes(nextStatus)
                ? false
                : lead.activeProspect,
            });
          }}
        >
          <SelectTrigger className="w-full rounded-xl"><SelectValue>{(value) => contactQualificationStatusLabels[value as ContactQualificationStatus]}</SelectValue></SelectTrigger>
          <SelectContent>
            {contactQualificationStatuses.map((value) => (
              <SelectItem key={value} value={value}>{contactQualificationStatusLabels[value]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ContactMethod valid={phoneValid} icon={<Phone className="size-4" />} label="Téléphone" />
        <ContactMethod valid={emailValid} icon={<Mail className="size-4" />} label="Email" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[var(--crm-riviera-border-default)] px-3 py-2.5">
          <p className="text-xs text-[var(--crm-riviera-text-secondary)]">Projet</p>
          <p className="mt-1 text-sm font-medium text-[var(--crm-riviera-text-primary)]">{lead.category}</p>
        </div>
        <div className="rounded-xl border border-[var(--crm-riviera-border-default)] px-3 py-2.5">
          <p className="text-xs text-[var(--crm-riviera-text-secondary)]">Secteur</p>
          <p className="mt-1 text-sm font-medium text-[var(--crm-riviera-text-primary)]">{lead.city}</p>
        </div>
      </div>

      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--crm-riviera-bg-accent)] px-3 py-2 text-sm font-semibold text-[var(--crm-riviera-text-primary)]">
        <span>Prospect commercial actif</span>
        <input
          type="checkbox"
          checked={lead.activeProspect}
          disabled={qualificationDisablesProspect}
          onChange={(event) => onUpdate({ activeProspect: event.target.checked })}
          className="size-5 accent-[var(--crm-riviera-bg-action)]"
        />
      </label>

      <p className="text-xs leading-5 text-[var(--crm-riviera-text-secondary)]">
        La validation rend le contact éligible au pipeline. Aucun prospect n&apos;est créé sans action humaine.
      </p>

      <Button
        type="button"
        variant="secondary"
        className={rivieraSecondaryButtonClass}
        disabled={pendingId === `qualification-${lead.id}`}
        onClick={() => void onSaveQualification(lead)}
      >
        <Save className="size-4" />
        {pendingId === `qualification-${lead.id}` ? "Validation…" : "Valider la qualification"}
      </Button>

      {lead.pipelineLeadId ? (
        <Button type="button" className={rivieraPrimaryButtonClass} onClick={onOpenPipeline}>
          <Target className="size-4" />
          Ouvrir le pipeline
        </Button>
      ) : (
        <Button
          type="button"
          className={rivieraPrimaryButtonClass}
          disabled={!readyForPipeline || pendingId === `pipeline-${lead.id}` || !connected}
          onClick={() => void onCreateProspect(lead)}
        >
          <Target className="size-4" />
          {pendingId === `pipeline-${lead.id}` ? "Création…" : "Créer un prospect →"}
        </Button>
      )}

      {!lead.pipelineLeadId && !readyForPipeline ? (
        <p className="text-xs leading-5 text-[var(--crm-riviera-text-secondary)]">
          Choisissez un rôle, passez l&apos;état à Qualifié et conservez le prospect actif.
        </p>
      ) : null}

      <details className="border-t border-[var(--crm-riviera-border-default)] pt-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--crm-riviera-text-action)]">
          Suivi interne
        </summary>
        <div className="grid gap-3 pb-1">
          <div className="grid gap-2">
            <Label>Statut commercial</Label>
            <Select
              value={lead.status}
              onValueChange={(value) => void onPersist(lead, { status: value as LeadStatus })}
            >
              <SelectTrigger className="w-full rounded-xl"><SelectValue>{(value) => leadStatusLabels[value as LeadStatus]}</SelectValue></SelectTrigger>
              <SelectContent>
                {leadStatuses.map((value) => <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`riviera-notes-${lead.id}`}>Notes internes</Label>
            <Textarea
              id={`riviera-notes-${lead.id}`}
              value={lead.notes}
              onChange={(event) => onUpdate({ notes: event.target.value })}
              placeholder="Prochaine action, budget, délai…"
              className="min-h-24 rounded-xl"
            />
          </div>
          <Button type="button" variant="secondary" className={rivieraSecondaryButtonClass} onClick={() => void onPersist(lead, { notes: lead.notes })}>
            <Save className="size-4" />
            Enregistrer les notes
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl border-[var(--crm-riviera-border-default)] text-[var(--crm-riviera-status-danger)]"
            onClick={() => {
              if (window.confirm(`Archiver le contact ${lead.name} ?`)) {
                void onPersist(lead, { archived: true }).then((success) => {
                  if (success) onBack();
                });
              }
            }}
          >
            <Archive className="size-4" />
            Archiver le contact
          </Button>
        </div>
      </details>
    </RivieraPanel>
  );
}

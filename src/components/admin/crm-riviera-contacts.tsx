"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ContactPagination } from "./contact-pagination";
import { getContactPagination, type ContactPageSize } from "@/lib/contact-pagination";
import type { AdminRole } from "@/types/admin";
import { contactPermissions, contactsCsv, contactNeedsFollowUp, findContactDuplicate, normalizeContactSearch } from "@/lib/contact-rules";
import { CommercialDialog } from "@/components/commercial/commercial-design-ui";
import { ContactActivities, ContactProjects, ContactRelated, ContactTasks, ContactTaskDialog, ContactWorkspaceStatus, useContactWorkspace } from "./contact-workspace";
import {
  Archive,
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Download,
  FileText,
  Grid2X2,
  List,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  UserRound,
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
  Activity,
  AdminTeamMember,
  AdminCrmLead,
  ContactQualificationStatus,
  ContactRole,
  LeadStatus,
  PipelineLead,
  PipelineTask,
} from "@/types/crm";
import type { Property } from "@/data/properties";
import {
  RivieraPanel,
  RivieraStatusBadge,
  rivieraPrimaryButtonClass,
  rivieraSecondaryButtonClass,
} from "./crm-riviera-ui";

type ContactFilter = "ALL" | "NEW" | "FOLLOW_UP" | "ARCHIVED" | ContactQualificationStatus;
type RoleFilter = "ALL" | ContactRole;
type BudgetFilter = "ALL" | "UNDER_300K" | "300K_700K" | "OVER_700K" | "UNKNOWN";
type ContactView = "list" | "cards";
type ContactDetailTab = "overview" | "project" | "activities" | "properties" | "visits" | "documents";
type ContactActionResult = { ok: boolean; message: string };


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

function formatContactDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function formatContactPrice(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function contactInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function exportContacts(leads: AdminCrmLead[]) {
  const blob = new Blob([contactsCsv(leads)], { type: "text/csv;charset=utf-8" });
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
        <span className="text-xs font-normal">{valid ? "Renseigné" : "À compléter"}</span>
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
  onCreateContact,
  activities,
  pipelineLeads,
  pipelineTasks,
  properties,
  team,
  userRole = "READ_ONLY",
  onDataChanged,
}: {
  onDataChanged?: () => Promise<void> | void;
  userRole?: AdminRole;
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
  onCreateContact: () => void;
  activities: Activity[];
  pipelineLeads: PipelineLead[];
  pipelineTasks: PipelineTask[];
  properties: Property[];
  team: AdminTeamMember[];
}) {
  const [qualificationFilter, setQualificationFilter] = useState<ContactFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>("ALL");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOwner, setBulkOwner] = useState("UNASSIGNED");
  const [bulkPending, setBulkPending] = useState(false);
  const [view, setView] = useState<ContactView>("list");
  const [page, setPage] = useState(1);
  const [contactsPerPage, setContactsPerPage] = useState<ContactPageSize>(20);
  const normalizedSearch = normalizeContactSearch(search);
  const permissions = contactPermissions(userRole);
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [sortByName, setSortByName] = useState(false);
  function resetFilters() { onSearchChange(""); setQualificationFilter("ALL"); setRoleFilter("ALL"); setOwnerFilter("ALL"); setSectorFilter("ALL"); setSourceFilter("ALL"); setBudgetFilter("ALL"); setPage(1); }
  const followUpIds = useMemo(() => new Set(leads.filter(lead => contactNeedsFollowUp(lead.id, pipelineLeads.filter(item => item.contactId === lead.id).map(item => item.id), pipelineTasks)).map(lead => lead.id)), [leads, pipelineLeads, pipelineTasks]);

  const contacts = useMemo(
    () => leads.filter((lead) => lead.kind === "contacts"),
    [leads]
  );
  const activeContacts = useMemo(() => contacts.filter((lead) => !lead.archived), [contacts]);
  const sectors = useMemo(() => Array.from(new Set(activeContacts.map((lead) => lead.city).filter(Boolean))).sort(), [activeContacts]);
  const sources = useMemo(() => Array.from(new Set(activeContacts.map((lead) => lead.contactSource).filter(Boolean))).sort(), [activeContacts]);
  const pipelineByContact = useMemo(() => new Map(pipelineLeads.filter((item) => item.contactId).map((item) => [item.contactId!, item])), [pipelineLeads]);
  const visibleContacts = useMemo(
    () =>
      contacts
        .filter((lead) => {
          const haystack = normalizeContactSearch(`${lead.name} ${lead.email} ${lead.phone} ${lead.city} ${lead.category}`);
          const matchesStatus =
            qualificationFilter === "ARCHIVED"
              ? lead.archived
              : !lead.archived && (
                  qualificationFilter === "ALL" ||
                  (qualificationFilter === "NEW" && lead.status === "NEW") ||
                  (qualificationFilter === "FOLLOW_UP" && followUpIds.has(lead.id)) ||
                  lead.qualificationStatus === qualificationFilter
                );
          const pipelineLead = pipelineByContact.get(lead.id);
          const budget = lead.estimatedBudget ?? pipelineLead?.budgetMax ?? null;
          const matchesBudget = budgetFilter === "ALL" ||
            (budgetFilter === "UNKNOWN" && budget == null) ||
            (budgetFilter === "UNDER_300K" && budget != null && budget < 300000) ||
            (budgetFilter === "300K_700K" && budget != null && budget >= 300000 && budget <= 700000) ||
            (budgetFilter === "OVER_700K" && budget != null && budget > 700000);
          return (
            (!normalizedSearch || haystack.includes(normalizedSearch)) &&
            matchesStatus &&
            (roleFilter === "ALL" || lead.contactRole === roleFilter) &&
            (ownerFilter === "ALL" || (ownerFilter === "UNASSIGNED" ? !lead.assignedTo : lead.assignedTo === ownerFilter)) &&
            (sectorFilter === "ALL" || lead.city === sectorFilter) &&
            (sourceFilter === "ALL" || lead.contactSource === sourceFilter) &&
            matchesBudget
          );
        })
        .sort((first, second) => {
          if (sortByName) return first.name.localeCompare(second.name, "fr");
          const firstRank = first.qualificationStatus
            ? qualificationOrder[first.qualificationStatus]
            : 99;
          const secondRank = second.qualificationStatus
            ? qualificationOrder[second.qualificationStatus]
            : 99;
          return firstRank - secondRank || new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
        }),
    [contacts, normalizedSearch, qualificationFilter, roleFilter, ownerFilter, sectorFilter, sourceFilter, budgetFilter, pipelineByContact, followUpIds, sortByName]
  );

  const selectedContact =
    contacts.find((lead) => lead.id === selectedContactId) ?? null;
  const duplicateCandidate = selectedContact ? findContactDuplicate(selectedContact, contacts) : null;

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
    new: activeContacts.filter((lead) => lead.status === "NEW").length,
    followUp: activeContacts.filter((lead) => followUpIds.has(lead.id)).length,
    qualified: activeContacts.filter((lead) => lead.qualificationStatus === "QUALIFIED").length,
    archived: contacts.filter((lead) => lead.archived).length,
  };

  const { currentPage, start, end } = getContactPagination(visibleContacts.length, page, contactsPerPage);
  const paginatedContacts = visibleContacts.slice(
    start,
    end
  );

  function openContact(id: string) {
    onSelectedContactChange(id);
  }

  function selectFilter(filter: ContactFilter) {
    setQualificationFilter(filter);
    setPage(1);
    onSelectedContactChange(null);
  }

  async function runContactAction(
    action: "merge-contacts" | "ignore-duplicate" | "delete-contact",
    primary: AdminCrmLead,
    secondary?: AdminCrmLead
  ): Promise<ContactActionResult> {
    if (!connected) {
      if (action === "merge-contacts" && secondary) {
        setLeads((current) => current.map((item) => item.id === secondary.id ? { ...item, archived: true, canonicalContactId: primary.id, dedupeStatus: "MERGED" } : item));
      } else if (action === "ignore-duplicate") {
        setLeads((current) => current.map((item) => item.id === primary.id || item.id === secondary?.id ? { ...item, dedupeStatus: "IGNORED" } : item));
      } else if (action === "delete-contact") {
        setLeads((current) => current.filter((item) => item.id !== primary.id));
      }
      return { ok: true, message: "Action conservée dans cette session locale." };
    }

    const response = await fetch("/api/admin/leads", {
      method: action === "delete-contact" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "delete-contact"
        ? { id: primary.id, confirmation: true }
        : { table: "contacts", id: primary.id, action, secondaryContactId: secondary?.id }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) as { message?: string } | null : null;
    if (!response?.ok) return { ok: false, message: payload?.message ?? "Cette action n'a pas pu être réalisée." };

    if (action === "merge-contacts" && secondary) {
      setLeads((current) => current.map((item) => item.id === secondary.id ? { ...item, archived: true, canonicalContactId: primary.id, dedupeStatus: "MERGED" } : item));
      await onDataChanged?.();
    } else if (action === "ignore-duplicate") {
      setLeads((current) => current.map((item) => item.id === primary.id || item.id === secondary?.id ? { ...item, dedupeStatus: "IGNORED" } : item));
    } else {
      setLeads((current) => current.filter((item) => item.id !== primary.id));
    }
    return { ok: true, message: payload?.message ?? "Action réalisée." };
  }

  const selectedContacts = contacts.filter((lead) => selectedIds.includes(lead.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function runBulk(action: (lead: AdminCrmLead) => Promise<boolean>) {
    if (bulkPending) return;
    setBulkPending(true);
    const failed: string[] = [];
    try {
      for (const lead of selectedContacts) {
        try { if (!await action(lead)) failed.push(lead.id); }
        catch { failed.push(lead.id); }
      }
      setSelectedIds(failed);
      setBulkFeedback(`${selectedContacts.length - failed.length} action(s) réussie(s).${failed.length ? ` ${failed.length} échec(s), contacts conservés dans la sélection pour réessayer.` : ""}`);
    } finally { setBulkPending(false); }
  }
  async function applyBulkOwner() {
    if (permissions.canAssign) await runBulk(lead => onPersist(lead, { assignedTo: bulkOwner === "UNASSIGNED" ? null : bulkOwner }));
  }
  async function archiveSelected() {
    if (permissions.canWrite) await runBulk(lead => onPersist(lead, { archived: qualificationFilter !== "ARCHIVED" }));
  }
  async function deleteSelected() {
    if (!permissions.canDelete || !window.confirm(`Supprimer définitivement ${selectedContacts.length} contact(s) ?`)) return;
    await runBulk(async lead => (await runContactAction("delete-contact", lead)).ok);
  }

  const filterItems: Array<{ value: ContactFilter; label: string; count: number }> = [
    { value: "ALL", label: "Tous", count: activeContacts.length },
    { value: "NEW", label: "Nouveaux", count: metrics.new },
    { value: "TO_REVIEW", label: "À qualifier", count: metrics.toReview },
    { value: "FOLLOW_UP", label: "À relancer", count: metrics.followUp },
    { value: "QUALIFIED", label: "Qualifiés", count: metrics.qualified },
    { value: "ARCHIVED", label: "Archivés", count: metrics.archived },
  ];

  return (
    <div className="grid gap-5 sm:gap-6">
      <div className={cn("hidden items-end justify-between gap-6 md:flex", selectedContact && "md:hidden")}>
        <div>
          <p className="mb-3 text-[13px] text-[var(--crm-riviera-text-secondary)]">CRM / <strong className="text-[var(--crm-riviera-text-primary)]">Contacts</strong></p>
          <h2 className="text-[28px] font-bold leading-9 text-[var(--crm-riviera-text-primary)]">Contacts</h2>
          <p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">
            Qualifier, dédupliquer et transformer les contacts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" className={rivieraSecondaryButtonClass} disabled={!permissions.canExport} onClick={() => exportContacts(visibleContacts)}>
            <Download className="size-4" /> Exporter
          </Button>
          <Button type="button" className={rivieraPrimaryButtonClass} disabled={!permissions.canWrite || !connected} onClick={onCreateContact}>
            <Plus className="size-4" /> Nouveau contact
          </Button>
        </div>
      </div>

      <div className={cn("flex gap-2 overflow-x-auto pb-1", selectedContact && "hidden")} role="group" aria-label="Filtres d'état des contacts">
        {filterItems.map((item) => {
          const active = qualificationFilter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => selectFilter(item.value)}
              aria-pressed={active}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors",
                active
                  ? "border-[var(--crm-riviera-bg-header)] bg-[var(--crm-riviera-bg-header)] text-white"
                  : "border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] text-[var(--crm-riviera-text-primary)]"
              )}
            >
              {item.label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", active ? "bg-[var(--crm-riviera-bg-action)]" : "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-action)]")}>{item.count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4">
        <RivieraPanel className={cn("grid content-start", selectedContact && "hidden")}>
          <div className="flex flex-col gap-3 border-b border-[var(--crm-riviera-border-default)] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--crm-riviera-text-secondary)]" />
                <Input
                  value={search}
                  onChange={(event) => { onSearchChange(event.target.value); setPage(1); }}
                  placeholder="Rechercher un contact…"
                  aria-label="Rechercher un contact"
                  className="h-10 rounded-lg bg-[var(--crm-riviera-bg-canvas)] pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={(value) => { setRoleFilter(value as RoleFilter); setPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-lg sm:w-[180px]" aria-label="Filtrer par rôle">
                  <SelectValue>{roleFilter === "ALL" ? "Tous les rôles" : contactRoleLabels[roleFilter]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les rôles</SelectItem>
                  {contactRoles.map((role) => <SelectItem key={role} value={role}>{contactRoleLabels[role]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ownerFilter} onValueChange={(value) => { if (value) setOwnerFilter(value); setPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-lg sm:w-[190px]" aria-label="Filtrer par vendeur"><SelectValue>{ownerFilter === "ALL" ? "Tous les vendeurs" : ownerFilter === "UNASSIGNED" ? "Non attribués" : team.find(member => member.id === ownerFilter)?.fullName ?? team.find(member => member.id === ownerFilter)?.email ?? "Conseiller indisponible"}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les vendeurs</SelectItem>
                  <SelectItem value="UNASSIGNED">Non attribués</SelectItem>
                  {team.filter((member) => member.isActive).map((member) => <SelectItem key={member.id} value={member.id}>{member.fullName ?? member.email}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" className="h-10 rounded-lg" aria-expanded={advancedFiltersOpen} onClick={() => setAdvancedFiltersOpen((value) => !value)}>
                <SlidersHorizontal className="size-4" /> Plus de filtres
              </Button>
              <Button type="button" variant="ghost" onClick={resetFilters}>Réinitialiser</Button>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs font-medium text-[var(--crm-riviera-text-secondary)]">{visibleContacts.length} résultat{visibleContacts.length > 1 ? "s" : ""}</span>
              <div className="flex rounded-lg bg-[var(--crm-riviera-bg-canvas)] p-0.5" role="group" aria-label="Présentation des contacts">
                <button type="button" onClick={() => setView("list")} aria-label="Vue liste" aria-pressed={view === "list"} className={cn("grid size-8 place-items-center rounded-md", view === "list" && "bg-[var(--crm-riviera-bg-surface)] text-[var(--crm-riviera-text-action)] shadow-sm")}><List className="size-4" /></button>
                <button type="button" onClick={() => setView("cards")} aria-label="Vue cartes" aria-pressed={view === "cards"} className={cn("grid size-8 place-items-center rounded-md", view === "cards" && "bg-[var(--crm-riviera-bg-surface)] text-[var(--crm-riviera-text-action)] shadow-sm")}><Grid2X2 className="size-4" /></button>
              </div>
            </div>
          </div>

          {advancedFiltersOpen ? (
            <div className="grid gap-3 border-b border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-canvas)] p-3 sm:grid-cols-3">
              <Select value={sectorFilter} onValueChange={(value) => { if (value) setSectorFilter(value); setPage(1); }}><SelectTrigger className="h-10 rounded-lg" aria-label="Filtrer par secteur"><SelectValue>{sectorFilter === "ALL" ? "Tous les secteurs" : sectorFilter}</SelectValue></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les secteurs</SelectItem>{sectors.map((sector) => <SelectItem key={sector} value={sector}>{sector}</SelectItem>)}</SelectContent></Select>
              <Select value={sourceFilter} onValueChange={(value) => { if (value) setSourceFilter(value); setPage(1); }}><SelectTrigger className="h-10 rounded-lg" aria-label="Filtrer par source"><SelectValue>{sourceFilter === "ALL" ? "Toutes les sources" : sourceFilter}</SelectValue></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les sources</SelectItem>{sources.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent></Select>
              <Select value={budgetFilter} onValueChange={(value) => { setBudgetFilter(value as BudgetFilter); setPage(1); }}><SelectTrigger className="h-10 rounded-lg" aria-label="Filtrer par budget"><SelectValue>{({ ALL: "Tous les budgets", UNDER_300K: "Moins de 300 000 €", "300K_700K": "300 000 à 700 000 €", OVER_700K: "Plus de 700 000 €", UNKNOWN: "Budget à préciser" })[budgetFilter]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les budgets</SelectItem><SelectItem value="UNDER_300K">Moins de 300 000 €</SelectItem><SelectItem value="300K_700K">300 000 à 700 000 €</SelectItem><SelectItem value="OVER_700K">Plus de 700 000 €</SelectItem><SelectItem value="UNKNOWN">Budget à préciser</SelectItem></SelectContent></Select>
            </div>
          ) : null}

          {selectedContacts.length ? (
            <div className="flex flex-col gap-3 border-b border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-accent)] p-3 lg:flex-row lg:items-center">
              <p className="mr-auto text-sm font-semibold text-[var(--crm-riviera-text-primary)]">{selectedContacts.length} contact(s) sélectionné(s)</p>
              <div className="flex flex-wrap gap-2">
                <Select value={bulkOwner} onValueChange={(value) => value && setBulkOwner(value)}><SelectTrigger className="h-9 w-[190px] bg-white" aria-label="Responsable groupé"><SelectValue>{bulkOwner === "UNASSIGNED" ? "Non attribué" : team.find(member => member.id === bulkOwner)?.fullName ?? team.find(member => member.id === bulkOwner)?.email ?? "Conseiller indisponible"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="UNASSIGNED">Non attribué</SelectItem>{team.filter((member) => member.isActive).map((member) => <SelectItem key={member.id} value={member.id}>{member.fullName ?? member.email}</SelectItem>)}</SelectContent></Select>
                <Button type="button" size="sm" variant="outline" disabled={bulkPending || !permissions.canAssign || !connected} onClick={() => void applyBulkOwner()}>Attribuer</Button>
                <Button type="button" size="sm" variant="outline" disabled={!permissions.canExport} onClick={() => exportContacts(selectedContacts)}><Download className="size-4" /> Exporter</Button>
                <Button type="button" size="sm" variant="outline" disabled={bulkPending || !permissions.canWrite || !connected} onClick={() => void archiveSelected()}><Archive className="size-4" /> {qualificationFilter === "ARCHIVED" ? "Restaurer" : "Archiver"}</Button>
                <Button type="button" size="sm" variant="outline" disabled={bulkPending || !permissions.canDelete || !connected} className="text-[var(--crm-riviera-status-danger)]" onClick={() => void deleteSelected()}><Trash2 className="size-4" /> Supprimer</Button>
              </div>
            </div>
          ) : null}

          {bulkFeedback ? <p role="status" className="m-4 rounded-xl bg-[var(--crm-riviera-bg-accent)] p-3 text-sm">{bulkFeedback}</p> : null}
          {feedback && !selectedContact ? (
            <p className="m-4 rounded-xl bg-[var(--crm-riviera-bg-accent)] p-3 text-sm text-[var(--crm-riviera-text-primary)]" aria-live="polite">
              {feedback}
            </p>
          ) : null}

          {paginatedContacts.length ? (
            <>
              {view === "list" ? (
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1320px] border-collapse text-left">
                    <thead className="bg-[var(--crm-riviera-bg-canvas)] text-xs font-semibold text-[var(--crm-riviera-text-secondary)]">
                      <tr><th className="px-3 py-3"><input type="checkbox" aria-label="Sélectionner la page" checked={paginatedContacts.length > 0 && paginatedContacts.every((lead) => selectedIds.includes(lead.id))} onChange={(event) => setSelectedIds(event.target.checked ? Array.from(new Set([...selectedIds, ...paginatedContacts.map((lead) => lead.id)])) : selectedIds.filter((id) => !paginatedContacts.some((lead) => lead.id === id)))} /></th><th className="px-3 py-3"><button type="button" aria-pressed={sortByName} onClick={() => setSortByName(value => !value)}>Contact {sortByName ? "↑" : "↕"}</button></th><th className="px-3 py-3">Rôle</th><th className="px-3 py-3">Projet</th><th className="px-3 py-3">Budget / Est.</th><th className="px-3 py-3">Secteur</th><th className="px-3 py-3">Statut</th><th className="px-3 py-3">Vendeur</th><th className="px-3 py-3">Activité</th><th className="px-3 py-3">Prochaine action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--crm-riviera-border-default)]">
                      {paginatedContacts.map((lead) => <ContactTableRow key={lead.id} lead={lead} checked={selectedIds.includes(lead.id)} onToggle={() => toggleSelected(lead.id)} onOpen={openContact} team={team} pipelineLeads={pipelineLeads} pipelineTasks={pipelineTasks} />)}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className={cn("grid gap-3 p-3 sm:p-4", view === "list" ? "md:hidden" : "sm:grid-cols-2 xl:grid-cols-3")}>
                {paginatedContacts.map((lead) => <ContactCard key={lead.id} lead={lead} onOpen={openContact} checked={selectedIds.includes(lead.id)} onToggle={() => toggleSelected(lead.id)} owner={team.find(member => member.id === lead.assignedTo)} />)}
              </div>
              <ContactPagination total={visibleContacts.length} page={currentPage} pageSize={contactsPerPage} onPageChange={setPage} onPageSizeChange={size => { setContactsPerPage(size); setPage(1); }} />
            </>
          ) : (
            <div className="m-4 rounded-2xl bg-[var(--crm-riviera-bg-accent)] px-5 py-10 text-center">
              <p className="font-semibold text-[var(--crm-riviera-text-primary)]">{!contacts.length ? "Aucun contact pour le moment" : "Aucun résultat"}</p>
              <p className="mt-2 text-sm text-[var(--crm-riviera-text-secondary)]">{!contacts.length ? "Ajoutez votre premier contact pour démarrer l'activité commerciale." : "Aucun contact ne correspond à votre recherche ou à vos filtres."}</p>
              {!contacts.length ? <Button type="button" className={cn(rivieraPrimaryButtonClass, "mt-5")} disabled={!permissions.canWrite || !connected} onClick={onCreateContact}><Plus className="size-4" />Créer un contact</Button> : null}
            </div>
          )}
        </RivieraPanel>

        {selectedContact ? (
          <QualificationPanel
            key={selectedContact.id}
            userRole={userRole}
            lead={selectedContact}
            connected={connected}
            pendingId={pendingId}
            feedback={feedback}
            onBack={() => { onSelectedContactChange(null); void onDataChanged?.(); }}
            onSaveQualification={onSaveQualification}
            onCreateProspect={onCreateProspect}
            onPersist={onPersist}
            onOpenPipeline={onOpenPipeline}
            activities={activities}
            pipelineLead={pipelineLeads.find((item) => item.contactId === selectedContact.id || item.id === selectedContact.pipelineLeadId) ?? null}
            pipelineTasks={pipelineTasks}
            properties={properties}
            team={team}
            duplicateCandidate={duplicateCandidate}
            onContactAction={runContactAction}
          />
        ) : null}
      </div>
    </div>
  );
}

function contactPresentation(lead: AdminCrmLead) {
  const status = lead.qualificationStatus ?? "TO_REVIEW";
  const role = lead.contactRole && lead.contactRole !== "UNKNOWN" ? contactRoleLabels[lead.contactRole] : "Rôle à confirmer";
  const readyForPipeline = status === "QUALIFIED" && lead.activeProspect && lead.contactRole !== "UNKNOWN" && !lead.pipelineLeadId;
  const badge = lead.archived ? "Archivé" : lead.pipelineLeadId ? "Dans le pipeline" : readyForPipeline ? "Prêt pipeline" : contactQualificationStatusLabels[status];
  return { status, role, badge };
}

function ContactTableRow({ lead, checked, onToggle, onOpen, team, pipelineLeads, pipelineTasks }: { lead: AdminCrmLead; checked: boolean; onToggle: () => void; onOpen: (id: string) => void; team: AdminTeamMember[]; pipelineLeads: PipelineLead[]; pipelineTasks: PipelineTask[] }) {
  const presentation = contactPresentation(lead);
  const pipelineLead = pipelineLeads.find((item) => item.contactId === lead.id || item.id === lead.pipelineLeadId) ?? null;
  const owner = team.find((member) => member.id === (lead.assignedTo ?? pipelineLead?.assignedTo)) ?? null;
  const nextTask = pipelineTasks
    .filter((task) => !task.completedAt && task.status !== "CANCELLED" && (task.contactId === lead.id || (pipelineLead && task.leadId === pipelineLead.id)))
    .sort((a, b) => new Date(a.dueAt ?? "9999-12-31").getTime() - new Date(b.dueAt ?? "9999-12-31").getTime())[0];
  const budget = lead.estimatedBudget ?? pipelineLead?.budgetMax ?? null;
  const nextAction = nextTask?.title ?? (lead.qualificationStatus === "TO_REVIEW" ? "Qualifier" : !owner ? "Attribuer" : lead.status === "CONTACTED" ? "Relancer" : "Ouvrir la fiche");
  return (
    <tr className="text-[13px] text-[var(--crm-riviera-text-primary)] hover:bg-[var(--crm-riviera-bg-canvas)]/70">
      <td className="px-3 py-3"><input type="checkbox" aria-label={`Sélectionner ${lead.name}`} checked={checked} onChange={onToggle} /></td>
      <td className="px-3 py-3"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--crm-riviera-bg-accent)] text-xs font-bold text-[var(--crm-riviera-text-action)]">{contactInitials(lead.name)}</span><div className="min-w-0"><button type="button" onClick={() => onOpen(lead.id)} className="max-w-[170px] truncate text-left font-semibold hover:underline">{lead.name}</button><p className="mt-0.5 max-w-[170px] truncate text-[11px] text-[var(--crm-riviera-text-secondary)]">{hasRealEmail(lead.email) ? lead.email : lead.phone}</p></div></div></td>
      <td className="px-3 py-3 font-medium">{presentation.role}</td>
      <td className="px-3 py-3 font-semibold">{lead.category || "À préciser"}</td>
      <td className="px-3 py-3">{budget != null ? formatContactPrice(budget) : "À préciser"}</td>
      <td className="px-3 py-3">{lead.city || "À préciser"}</td>
      <td className="px-3 py-3"><RivieraStatusBadge tone={lead.archived ? "neutral" : qualificationTone(presentation.status)}>{presentation.badge}</RivieraStatusBadge></td>
      <td className="px-3 py-3">{owner?.fullName ?? owner?.email ?? "Non attribué"}</td>
      <td className="px-3 py-3 text-[11px] text-[var(--crm-riviera-text-secondary)]">{lead.lastContactedAt ? formatContactDate(lead.lastContactedAt) : formatReceivedAt(lead.createdAt)}</td>
      <td className="px-3 py-3"><button type="button" onClick={() => onOpen(lead.id)} className="min-h-9 max-w-[170px] truncate rounded-lg bg-[var(--crm-riviera-bg-accent)] px-3 text-xs font-semibold text-[var(--crm-riviera-text-action)]">{nextAction}</button></td>
    </tr>
  );
}

function ContactCard({ lead, onOpen, checked, onToggle, owner }: { lead: AdminCrmLead; onOpen: (id: string) => void; checked: boolean; onToggle: () => void; owner?: AdminTeamMember }) {
  const presentation = contactPresentation(lead);
  return (
    <article className="grid min-w-0 gap-3 rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-4 shadow-[var(--crm-riviera-shadow-card)]">
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Sélectionner ${lead.name}`} />Sélectionner</label>
      <div className="flex items-center justify-between gap-3"><RivieraStatusBadge tone={lead.archived ? "neutral" : qualificationTone(presentation.status)}>{presentation.badge}</RivieraStatusBadge><span className="text-[11px] text-[var(--crm-riviera-text-secondary)]">{formatReceivedAt(lead.createdAt)}</span></div>
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--crm-riviera-bg-accent)] text-xs font-bold text-[var(--crm-riviera-text-action)]">{contactInitials(lead.name)}</span><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[var(--crm-riviera-text-primary)]">{lead.name}</h3><p className="mt-0.5 truncate text-[11px] text-[var(--crm-riviera-text-secondary)]">{hasRealEmail(lead.email) ? lead.email : "Email à compléter"}</p></div></div>
      <div className="h-px bg-[var(--crm-riviera-border-default)]" />
      <div className="min-w-0"><p className="flex items-center gap-1.5 truncate text-xs font-semibold text-[var(--crm-riviera-text-primary)]"><BriefcaseBusiness className="size-3.5 shrink-0 text-[var(--crm-riviera-text-action)]" />{lead.category || "Projet à préciser"}</p><div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--crm-riviera-text-secondary)]"><span className="truncate">{lead.city || "Secteur à préciser"}</span><span className="shrink-0 font-medium">{presentation.role}</span></div></div>
      <div className="h-px bg-[var(--crm-riviera-border-default)]" />
      <p className="text-sm font-semibold">{lead.estimatedBudget == null ? "Budget à préciser" : formatContactPrice(lead.estimatedBudget)}</p><p className="text-xs text-[var(--crm-riviera-text-secondary)]">Responsable : {owner?.fullName ?? owner?.email ?? "Non attribué"}</p>
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1 text-[var(--crm-riviera-text-secondary)]">{hasRealPhone(lead.phone) ? <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} aria-label={`Appeler ${lead.name}`} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--crm-riviera-bg-accent)]"><Phone className="size-4" /></a> : null}{hasRealEmail(lead.email) ? <a href={`mailto:${lead.email}`} aria-label={`Écrire à ${lead.name}`} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--crm-riviera-bg-accent)]"><Mail className="size-4" /></a> : null}</div><button type="button" onClick={() => onOpen(lead.id)} className="min-h-9 rounded-lg bg-[var(--crm-riviera-bg-accent)] px-3 text-xs font-semibold text-[var(--crm-riviera-text-action)]">Gérer</button></div>
    </article>
  );
}

function QualificationPanel({
  lead: savedLead,
  userRole,
  connected,
  pendingId,
  feedback,
  onBack,
  onSaveQualification,
  onCreateProspect,
  onPersist: persistContact,
  activities,
  pipelineLead,
  team,
  duplicateCandidate,
  onContactAction,
}: {
  lead: AdminCrmLead;
  connected: boolean;
  pendingId: string | null;
  feedback: string;
  onBack: () => void;
  userRole: AdminRole;
  onSaveQualification: (lead: AdminCrmLead) => Promise<void>;
  onCreateProspect: (lead: AdminCrmLead) => Promise<void>;
  onPersist: (lead: AdminCrmLead, updates: Partial<AdminCrmLead>) => Promise<boolean>;
  onOpenPipeline: () => void;
  activities: Activity[];
  pipelineLead: PipelineLead | null;
  pipelineTasks: PipelineTask[];
  properties: Property[];
  team: AdminTeamMember[];
  duplicateCandidate: AdminCrmLead | null;
  onContactAction: (
    action: "merge-contacts" | "ignore-duplicate" | "delete-contact",
    primary: AdminCrmLead,
    secondary?: AdminCrmLead
  ) => Promise<ContactActionResult>;
}) {
  const [draft, setDraft] = useState<Partial<AdminCrmLead>>({});
  const lead = { ...savedLead, ...draft };
  const onUpdate = (updates: Partial<AdminCrmLead>) => setDraft(current => ({ ...current, ...updates }));
  const permissions = contactPermissions(userRole);
  const canWrite = permissions.canWrite && connected && !savedLead.archived;
  const workspace = useContactWorkspace(savedLead.id, connected);
  const [taskOpen, setTaskOpen] = useState(false);
  async function onPersist(contact: AdminCrmLead, updates: Partial<AdminCrmLead>) {
    const ok = await persistContact(contact, updates);
    if (ok) workspace.reload();
    return ok;
  }
  const [activeTab, setActiveTab] = useState<ContactDetailTab>("overview");
  const [modal, setModalState] = useState<"actions" | "edit" | "owner" | "duplicate" | "archive" | "delete" | null>(null);
  const setModal: typeof setModalState = value => { setDraft({}); setModalState(value); };
  const [assignmentReason, setAssignmentReason] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [actionFeedback, setActionFeedback] = useState("");
  const [actionPending, setActionPending] = useState(false);
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
  const contactActivities = workspace.data?.activities ?? activities
    .filter(activity => activity.entity_id === lead.id)
    .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime());
  const owner = team.find((member) => member.id === (lead.assignedTo ?? pipelineLead?.assignedTo)) ?? null;
  const detailTabs: Array<{ value: ContactDetailTab; label: string }> = [
    { value: "overview", label: "Aperçu" },
    { value: "project", label: "Projet" },
    { value: "activities", label: "Activités" },
    { value: "properties", label: "Biens" },
    { value: "visits", label: "Visites" },
    { value: "documents", label: "Documents" },
  ];

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex items-center gap-2 text-[13px] text-[var(--crm-riviera-text-secondary)]">
        <button type="button" onClick={onBack} className="inline-flex min-h-9 items-center gap-1 rounded-lg pr-2 font-semibold text-[var(--crm-riviera-text-action)]"><ArrowLeft className="size-4" />Contacts</button>
        <span>/</span><span className="truncate font-semibold text-[var(--crm-riviera-text-primary)]">{lead.name}</span>
      </div>

      <RivieraPanel className="grid gap-5 p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--crm-riviera-bg-accent)] text-lg font-bold text-[var(--crm-riviera-text-action)]">{contactInitials(lead.name)}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-2xl font-bold text-[var(--crm-riviera-text-primary)] sm:text-[28px]">{lead.name}</h2>{role !== "UNKNOWN" ? <RivieraStatusBadge tone="success">{contactRoleLabels[role]}</RivieraStatusBadge> : null}<RivieraStatusBadge tone={qualificationTone(qualificationStatus)}>{contactQualificationStatusLabels[qualificationStatus]}</RivieraStatusBadge>{duplicateCandidate ? <button type="button" disabled={!canWrite} onClick={() => setModal("duplicate")} className="rounded-full bg-[#FFF1D6] px-3 py-1 text-xs font-semibold text-[#8A5A00]">Doublon potentiel</button> : null}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--crm-riviera-text-secondary)]">
                {phoneValid ? <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" />{lead.phone}</span> : null}
                {emailValid ? <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" />{lead.email}</span> : null}
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{lead.city || "Secteur à préciser"}{lead.postalCode ? ` (${lead.postalCode})` : ""}</span>
              </div>
              <button type="button" disabled={!permissions.canAssign || !canWrite} onClick={() => setModal("owner")} className="mt-2 text-left text-xs font-semibold text-[var(--crm-riviera-text-action)]">Responsable : {owner?.fullName ?? owner?.email ?? "Non attribué"}</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {phoneValid ? <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--crm-riviera-border-default)] px-4 text-sm font-semibold text-[var(--crm-riviera-text-primary)]"><Phone className="size-4" />Appeler</a> : null}
            {emailValid ? <a href={`mailto:${lead.email}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--crm-riviera-border-default)] px-4 text-sm font-semibold text-[var(--crm-riviera-text-primary)]"><Mail className="size-4" />Email</a> : null}
            <Button type="button" className={rivieraPrimaryButtonClass} disabled={!canWrite} onClick={() => setTaskOpen(true)}><Plus className="size-4" />Créer une tâche</Button>
            {lead.pipelineLeadId ? <Link href={`/commercial/pipeline?dossier=${lead.pipelineLeadId}`} className="inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-semibold">Ouvrir le dossier</Link> : <Button type="button" variant="outline" onClick={() => void onCreateProspect(lead)} disabled={!canWrite || !readyForPipeline || pendingId === `pipeline-${lead.id}`}><Target className="size-4" />Créer un prospect</Button>}
            <button type="button" aria-label="Plus d'actions" onClick={() => setModal("actions")} className="grid size-10 place-items-center rounded-xl border border-[var(--crm-riviera-border-default)]"><MoreHorizontal className="size-5" /></button>
          </div>
        </div>
        <div className="flex gap-6 overflow-x-auto border-t border-[var(--crm-riviera-border-default)] pt-1" role="tablist" aria-label="Sections de la fiche contact">
          {detailTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "min-h-11 shrink-0 border-b-2 px-1 text-sm font-medium",
                activeTab === tab.value
                  ? "border-[var(--crm-riviera-bg-action)] text-[var(--crm-riviera-text-primary)]"
                  : "border-transparent text-[var(--crm-riviera-text-secondary)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </RivieraPanel>

      <ContactWorkspaceStatus state={workspace} />
      {taskOpen && <ContactTaskDialog state={workspace} team={team.filter(member => member.isActive)} assignedTo={savedLead.assignedTo} canAssign={permissions.canAssign} onClose={() => setTaskOpen(false)} />}
      {savedLead.archived && <div className="rounded-xl bg-[var(--crm-riviera-bg-accent)] p-4 text-sm">Contact archivé. <Button type="button" variant="outline" disabled={!permissions.canWrite || !connected || actionPending} onClick={async () => { setActionPending(true); const ok = await onPersist(savedLead, { archived: false }); setActionPending(false); if (ok) setActionFeedback("Contact restauré."); }}>Restaurer le contact</Button></div>}
      {feedback ? <p className="rounded-xl bg-[var(--crm-riviera-bg-accent)] p-3 text-sm text-[var(--crm-riviera-text-primary)]" aria-live="polite">{feedback}</p> : null}

      {activeTab === "overview" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
          <div className="grid content-start gap-5">
            <RivieraPanel className="grid gap-4 p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold"><BriefcaseBusiness className="size-5" />Résumé du projet</h3>
              <p className="text-sm leading-6 text-[var(--crm-riviera-text-secondary)]">{lead.message || "Aucune description du projet n'a encore été renseignée."}</p>
            </RivieraPanel>
            <div className="grid gap-5 lg:grid-cols-2">
              <RivieraPanel className="grid content-start gap-4 p-5 sm:p-6">
                <h3 className="text-lg font-semibold">Coordonnées</h3>
                <DetailValue label="Téléphone" value={phoneValid ? lead.phone : "À compléter"} />
                <DetailValue label="Email" value={emailValid ? lead.email : "À compléter"} />
                <DetailValue label="Adresse" value={[lead.address, lead.postalCode, lead.city].filter(Boolean).join(", ") || "À compléter"} />
                <DetailValue label="Préférence de contact" value={lead.contactPreference || "À préciser"} />
              </RivieraPanel>
              <RivieraPanel className="grid content-start gap-4 p-5 sm:p-6">
                <h3 className="text-lg font-semibold">Données personnelles</h3>
                <DetailValue label="Situation" value={lead.personalSituation || "À préciser"} />
                <DetailValue label="Profession" value={lead.profession || "À préciser"} />
                <DetailValue label="Résidence actuelle" value={lead.currentResidence || "À préciser"} />
              </RivieraPanel>
            </div>
            <RivieraPanel className="grid gap-4 p-5 sm:p-6"><h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="size-5" />Historique récent</h3><ActivityTimeline lead={lead} activities={contactActivities.slice(0, 4)} /></RivieraPanel>
          </div>
          <aside className="grid content-start gap-5">
            <RivieraPanel className="grid content-start gap-4 p-5 sm:p-6">
              <h3 className="text-lg font-semibold">Informations du contact</h3>
              <DetailValue label="Source" value={lead.contactSource.replaceAll("_", " ")} />
              <DetailValue label="Date d'entrée" value={formatContactDate(lead.createdAt)} />
              <DetailValue label="Vendeur responsable" value={owner?.fullName ?? owner?.email ?? "Non attribué"} />
              <DetailValue label="Dernière activité" value={contactActivities[0] ? formatContactDate(contactActivities[0].created_at) : "Aucune activité"} />
            </RivieraPanel>
            <RivieraPanel className="grid content-start gap-4 p-5 sm:p-6">
              <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Score et intérêt</h3><strong className="text-2xl text-[var(--crm-riviera-text-action)]">{lead.interestScore == null ? "Non renseigné" : `${lead.interestScore}%`}</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--crm-riviera-bg-accent)]"><div className="h-full rounded-full bg-[var(--crm-riviera-bg-action)]" style={{ width: `${lead.interestScore ?? 0}%` }} /></div>
              <p className="text-sm text-[var(--crm-riviera-text-secondary)]">{lead.interestScore == null ? "Score à renseigner" : lead.interestScore >= 75 ? "Intérêt élevé" : lead.interestScore >= 40 ? "Intérêt moyen" : "Intérêt à développer"}</p>
            </RivieraPanel>
            <RivieraPanel className="grid content-start gap-4 p-5 sm:p-6"><h3 className="text-lg font-semibold">Qualification commerciale</h3><fieldset disabled={!canWrite} className="grid gap-4"><QualificationControls lead={lead} role={role} qualificationStatus={qualificationStatus} qualificationDisablesProspect={qualificationDisablesProspect} phoneValid={phoneValid} emailValid={emailValid} pendingId={pendingId} onUpdate={onUpdate} onSaveQualification={onSaveQualification} onPersist={onPersist} /></fieldset></RivieraPanel>
            <ContactTasks state={workspace} canWrite={canWrite} onCreate={() => setTaskOpen(true)} />
          </aside>
        </div>
      ) : null}

      {activeTab === "project" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <div className="grid content-start gap-5">
            <ContactProjects state={workspace} canWrite={canWrite} description={savedLead.message} budget={savedLead.estimatedBudget} />
            <RivieraPanel className="grid gap-4 p-5 sm:p-6"><h3 className="text-lg font-semibold">Timeline du projet</h3><ActivityTimeline lead={lead} activities={contactActivities} /></RivieraPanel>
          </div>
          <aside className="grid content-start gap-5">
            <RivieraPanel className="grid gap-4 p-5 sm:p-6"><h3 className="text-lg font-semibold">Intérêt et financement</h3><DetailValue label="Score de maturité" value={lead.interestScore == null ? "À préciser" : `${lead.interestScore}%`} /><DetailValue label="Statut commercial" value={leadStatusLabels[lead.status]} /><DetailValue label="Dossier pipeline" value={pipelineLead?.dossierReference ?? "Aucun dossier créé"} />{pipelineLead ? <DetailValue label="Responsable" value={pipelineLead.assignedToName ?? "Non attribué"} /> : null}</RivieraPanel>
            <RivieraPanel className="grid content-start gap-4 p-5 sm:p-6"><h3 className="text-lg font-semibold">Notes du commercial</h3><Textarea value={lead.notes} onChange={(event) => onUpdate({ notes: event.target.value })} placeholder="Budget, délai, critères, prochaine action…" className="min-h-36 rounded-xl" /><Button type="button" variant="secondary" className={rivieraSecondaryButtonClass} disabled={!canWrite} onClick={() => void onPersist(lead, { notes: lead.notes })}><Save className="size-4" />Enregistrer les notes</Button></RivieraPanel>
            <ContactTasks state={workspace} canWrite={canWrite} onCreate={() => setTaskOpen(true)} />
          </aside>
        </div>
      ) : null}

      {activeTab === "activities" && <ContactActivities state={workspace} canWrite={canWrite} />}
      {(activeTab === "properties" || activeTab === "visits" || activeTab === "documents") && <ContactRelated state={workspace} tab={activeTab} contactId={lead.id} canWrite={canWrite} />}

      {actionFeedback ? <p role="status" className="rounded-xl bg-[var(--crm-riviera-bg-accent)] p-3 text-sm font-semibold">{actionFeedback}</p> : null}

      {modal === "actions" ? (
        <ContactModal feedback={actionFeedback || feedback} title="Actions du contact" onClose={() => setModal(null)}>
          <div className="grid gap-2">
            <button type="button" disabled={!canWrite} onClick={() => setModal("edit")} className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--crm-riviera-border-default)] px-4 text-left text-sm font-semibold"><FileText className="size-4" />Modifier la fiche</button>
            <button type="button" disabled={!canWrite || !permissions.canAssign} onClick={() => setModal("owner")} className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--crm-riviera-border-default)] px-4 text-left text-sm font-semibold"><UserRound className="size-4" />Changer de responsable</button>
            {duplicateCandidate ? <button type="button" disabled={!canWrite} onClick={() => setModal("duplicate")} className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--crm-riviera-border-default)] px-4 text-left text-sm font-semibold"><AlertTriangle className="size-4 text-[var(--crm-riviera-status-warning)]" />Doublon détecté</button> : null}
            <button type="button" disabled={!canWrite} onClick={() => setModal("archive")} className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--crm-riviera-border-default)] px-4 text-left text-sm font-semibold"><Archive className="size-4" />Archiver ce contact</button>
            <button type="button" disabled={!permissions.canDelete || !connected} onClick={() => setModal("delete")} className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--crm-riviera-status-danger)] px-4 text-left text-sm font-semibold text-[var(--crm-riviera-status-danger)]"><Trash2 className="size-4" />Supprimer définitivement</button>
          </div>
        </ContactModal>
      ) : null}

      {modal === "edit" ? (
        <ContactModal feedback={actionFeedback || feedback} title="Modifier le contact" wide onClose={() => setModal(null)}>
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2"><Label htmlFor="edit-contact-name">Nom complet</Label><Input id="edit-contact-name" value={lead.name} onChange={(event) => onUpdate({ name: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="edit-contact-phone">Téléphone</Label><Input id="edit-contact-phone" value={lead.phone} onChange={(event) => onUpdate({ phone: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="edit-contact-email">Email</Label><Input id="edit-contact-email" type="email" value={hasRealEmail(lead.email) ? lead.email : ""} onChange={(event) => onUpdate({ email: event.target.value })} /></div>
              <div className="grid gap-2"><Label>Type de projet</Label><select aria-label="Type de projet" className="min-h-11 rounded-lg border px-3" value={lead.category} onChange={event => onUpdate({ category: event.target.value })}>{["Achat", "Vente", "Estimation", "Terrain", "Autre"].map(value => <option key={value} value={value}>{value}</option>)}</select></div>
              <div className="grid gap-2"><Label htmlFor="edit-contact-city">Secteur</Label><Input id="edit-contact-city" value={lead.city} onChange={(event) => onUpdate({ city: event.target.value })} /></div>
              <div className="grid gap-2"><Label htmlFor="edit-contact-budget">Budget estimé</Label><Input id="edit-contact-budget" type="number" min="0" step="1000" value={lead.estimatedBudget ?? ""} onChange={(event) => onUpdate({ estimatedBudget: event.target.value ? Number(event.target.value) : null })} /></div>
              <div className="grid gap-2"><Label>Priorité</Label><select aria-label="Priorité du contact" className="min-h-11 rounded-lg border px-3" value={lead.priority} onChange={event => onUpdate({ priority: event.target.value as AdminCrmLead["priority"] })}>{[["low", "Basse"], ["normal", "Normale"], ["high", "Haute"], ["urgent", "Urgente"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              {([["address", "Adresse"], ["postalCode", "Code postal"], ["contactPreference", "Préférence de contact"], ["personalSituation", "Situation personnelle"], ["profession", "Profession"], ["currentResidence", "Résidence actuelle"], ["contactSource", "Source"]] as const).map(([field, label]) => <div key={field} className="grid gap-2"><Label htmlFor={`edit-contact-${field}`}>{label}</Label><Input id={`edit-contact-${field}`} maxLength={250} value={lead[field]} onChange={event => onUpdate({ [field]: event.target.value })} /></div>)}
              <div className="grid gap-2"><Label htmlFor="edit-contact-score">Score d’intérêt déclaré (%)</Label><Input id="edit-contact-score" type="number" min="0" max="100" value={lead.interestScore ?? ""} onChange={event => onUpdate({ interestScore: event.target.value === "" ? null : Number(event.target.value) })} /></div>
              <div className="grid gap-2 sm:col-span-2"><Label htmlFor="edit-contact-message">Description du projet</Label><Textarea id="edit-contact-message" className="min-h-28" value={lead.message} onChange={(event) => onUpdate({ message: event.target.value })} /></div>
            </div>
            <ModalActions onCancel={() => setModal(null)} confirmLabel="Enregistrer" pending={actionPending} onConfirm={async () => { setActionPending(true); const success = await onPersist(lead, { name: lead.name, email: lead.email, phone: lead.phone, category: lead.category, city: lead.city, message: lead.message, estimatedBudget: lead.estimatedBudget, priority: lead.priority, address: lead.address, postalCode: lead.postalCode, contactPreference: lead.contactPreference, personalSituation: lead.personalSituation, profession: lead.profession, currentResidence: lead.currentResidence, contactSource: lead.contactSource, interestScore: lead.interestScore }); setActionPending(false); if (success) { setActionFeedback("Fiche contact mise à jour."); setModal(null); } }} />
          </div>
        </ContactModal>
      ) : null}

      {modal === "owner" ? (
        <ContactModal feedback={actionFeedback || feedback} title="Changer de responsable" onClose={() => setModal(null)}>
          <div className="grid gap-5">
            <p className="text-sm text-[var(--crm-riviera-text-secondary)]">Responsable actuel : <strong className="text-[var(--crm-riviera-text-primary)]">{owner?.fullName ?? owner?.email ?? "Non attribué"}</strong></p>
            <div className="grid gap-2"><Label>Attribuer à un nouveau conseiller</Label><select aria-label="Choisir le nouveau responsable" className="min-h-11 rounded-lg border px-3" value={lead.assignedTo ?? "UNASSIGNED"} onChange={event => onUpdate({ assignedTo: event.target.value === "UNASSIGNED" ? null : event.target.value })}><option value="UNASSIGNED">Non attribué</option>{team.filter(member => member.isActive).map(member => <option key={member.id} value={member.id}>{member.fullName ?? member.email}</option>)}</select></div>
            <div className="grid gap-2"><Label htmlFor="assignment-reason">Motif du changement (optionnel)</Label><Textarea id="assignment-reason" value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} placeholder="Secteur géographique plus adapté pour ce client…" className="min-h-24 rounded-xl" /></div>
            <ModalActions onCancel={() => setModal(null)} confirmLabel="Confirmer" pending={actionPending} onConfirm={async () => { setActionPending(true); const success = await onPersist(lead, { assignedTo: lead.assignedTo, assignmentReason } as Partial<AdminCrmLead>); setActionPending(false); if (success) { setActionFeedback("Responsable du contact modifié."); setModal(null); } }} />
          </div>
        </ContactModal>
      ) : null}

      {modal === "duplicate" && duplicateCandidate ? (
        <ContactModal feedback={actionFeedback || feedback} title="Doublon potentiel détecté" icon={<AlertTriangle className="size-5 text-[var(--crm-riviera-status-warning)]" />} onClose={() => setModal(null)}>
          <div className="grid gap-4">
            <DuplicateContactCard title="Contact actuel" lead={lead} counterpart={duplicateCandidate} />
            <DuplicateContactCard title="Contact existant" lead={duplicateCandidate} counterpart={lead} />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal py-2" onClick={async () => { setActionPending(true); const result = await onContactAction("ignore-duplicate", lead, duplicateCandidate); setActionPending(false); setActionFeedback(result.message); if (result.ok) { setModal(null); workspace.reload(); } }} disabled={actionPending}>Garder les deux</Button>
              <Button type="button" variant="outline" className="h-auto min-h-11" onClick={() => setModal(null)}>Ignorer</Button>
              <Button type="button" className={cn(rivieraPrimaryButtonClass, "col-span-2 h-auto min-h-11 whitespace-normal py-2")} onClick={async () => { setActionPending(true); const result = await onContactAction("merge-contacts", lead, duplicateCandidate); setActionPending(false); setActionFeedback(result.message); if (result.ok) { setModal(null); workspace.reload(); } }} disabled={actionPending}>Fusionner les contacts</Button>
            </div>
          </div>
        </ContactModal>
      ) : null}

      {modal === "archive" ? (
        <ContactModal feedback={actionFeedback || feedback} title="Archiver ce contact ?" icon={<Archive className="size-5 text-[var(--crm-riviera-status-warning)]" />} onClose={() => setModal(null)}>
          <p className="text-sm leading-6 text-[var(--crm-riviera-text-secondary)]">Vous êtes sur le point d’archiver {lead.name}. Le contact et ses données seront conservés mais ne seront plus visibles dans la liste active.</p>
          <ModalActions onCancel={() => setModal(null)} confirmLabel="Archiver" tone="warning" pending={actionPending} onConfirm={async () => { setActionPending(true); const success = await onPersist(lead, { archived: true }); setActionPending(false); if (success) { setModal(null); onBack(); } }} />
        </ContactModal>
      ) : null}

      {modal === "delete" ? (
        <ContactModal feedback={actionFeedback || feedback} title="Supprimer ce contact ?" icon={<Trash2 className="size-5 text-[var(--crm-riviera-status-danger)]" />} onClose={() => setModal(null)}>
          <div className="grid gap-5"><p className="text-sm leading-6 text-[var(--crm-riviera-text-secondary)]">Cette action est irréversible. Les données de {lead.name} seront supprimées. Si un dossier ou une offre existe, la suppression sera bloquée et l’archivage restera disponible.</p><label className="flex items-start gap-2 text-xs font-semibold"><input type="checkbox" checked={deleteConfirmed} onChange={(event) => setDeleteConfirmed(event.target.checked)} className="mt-0.5 size-4 accent-[var(--crm-riviera-status-danger)]" />Je comprends que cette action est irréversible</label><ModalActions onCancel={() => setModal(null)} confirmLabel="Supprimer" tone="danger" pending={actionPending} disabled={!deleteConfirmed} onConfirm={async () => { setActionPending(true); const result = await onContactAction("delete-contact", lead); setActionPending(false); setActionFeedback(result.message); if (result.ok) { setModal(null); onBack(); } }} /></div>
        </ContactModal>
      ) : null}
    </div>
  );
}

function ContactModal({ title, icon, children, onClose, feedback }: { title: string; icon?: React.ReactNode; children: React.ReactNode; onClose: () => void; wide?: boolean; feedback?: string }) {
  return <CommercialDialog title={title} onClose={onClose}>{icon}{feedback ? <p role="status" className="mb-4 rounded-lg bg-[var(--crm-riviera-bg-accent)] p-3 text-sm">{feedback}</p> : null}{children}</CommercialDialog>;
}

function ModalActions({ onCancel, onConfirm, confirmLabel, pending, disabled = false, tone = "default" }: { onCancel: () => void; onConfirm: () => void | Promise<void>; confirmLabel: string; pending: boolean; disabled?: boolean; tone?: "default" | "warning" | "danger" }) {
  const toneClass = tone === "danger" ? "bg-[var(--crm-riviera-status-danger)]" : tone === "warning" ? "bg-[#C28B2C]" : "bg-[var(--crm-riviera-bg-action)]";
  return <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onCancel}>Annuler</Button><Button type="button" className={cn("text-white", toneClass)} onClick={() => void onConfirm()} disabled={pending || disabled}>{pending ? "Traitement…" : confirmLabel}</Button></div>;
}

function DuplicateContactCard({ title, lead, counterpart }: { title: string; lead: AdminCrmLead; counterpart: AdminCrmLead }) {
  const emailMatch = Boolean(lead.normalizedEmail && lead.normalizedEmail === counterpart.normalizedEmail);
  const phoneMatch = Boolean(lead.normalizedPhone && lead.normalizedPhone === counterpart.normalizedPhone);
  return <article className="rounded-2xl border border-[var(--crm-riviera-border-default)] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-riviera-text-secondary)]">{title}</p><p className="mt-2 font-semibold">{lead.name}</p><p className="mt-2 text-xs text-[var(--crm-riviera-text-secondary)]">Tél : {lead.phone || "Non renseigné"}{phoneMatch ? " (correspondance)" : ""}</p><p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">Email : {lead.email}{emailMatch ? " (correspondance)" : ""}</p><p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">Secteur : {lead.city || "Non renseigné"}</p></article>;
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--crm-riviera-border-default)] px-4 py-3"><p className="text-xs text-[var(--crm-riviera-text-secondary)]">{label}</p><p className="mt-1 text-sm font-semibold text-[var(--crm-riviera-text-primary)]">{value}</p></div>;
}


function ActivityTimeline({ lead, activities }: { lead: AdminCrmLead; activities: Pick<Activity, "id" | "action" | "created_at" | "user_name">[] }) {
  const events = activities.map((activity) => ({ id: activity.id, title: activity.action, date: activity.created_at, user: activity.user_name }));
  return (
    <div className="grid gap-0">
      {events.map((event) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center"><span className="mt-1.5 size-2.5 rounded-full bg-[var(--crm-riviera-bg-action)]" /><span className="h-full min-h-10 w-px bg-[var(--crm-riviera-border-default)]" /></div>
          <div className="pb-5"><p className="text-sm font-semibold">{event.title}</p><p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">{formatContactDate(event.date)} · {event.user || "Système"}</p></div>
        </div>
      ))}
      <div className="flex gap-3"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[var(--crm-riviera-border-default)]" /><div><p className="text-sm font-semibold">Création du contact</p><p className="mt-1 text-xs text-[var(--crm-riviera-text-secondary)]">{formatContactDate(lead.createdAt)}</p></div></div>
    </div>
  );
}

function QualificationControls({
  lead,
  role,
  qualificationStatus,
  qualificationDisablesProspect,
  phoneValid,
  emailValid,
  pendingId,
  onUpdate,
  onSaveQualification,
  onPersist,
}: {
  lead: AdminCrmLead;
  role: ContactRole;
  qualificationStatus: ContactQualificationStatus;
  qualificationDisablesProspect: boolean;
  phoneValid: boolean;
  emailValid: boolean;
  pendingId: string | null;
  onUpdate: (updates: Partial<AdminCrmLead>) => void;
  onSaveQualification: (lead: AdminCrmLead) => Promise<void>;
  onPersist: (lead: AdminCrmLead, updates: Partial<AdminCrmLead>) => Promise<boolean>;
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label>Rôle</Label>
        <Select value={role} onValueChange={(value) => onUpdate({ contactRole: value as ContactRole })}>
          <SelectTrigger className="w-full rounded-xl" aria-label="Choisir le rôle du contact"><SelectValue>{(value) => contactRoleLabels[value as ContactRole]}</SelectValue></SelectTrigger>
          <SelectContent>{contactRoles.map((value) => <SelectItem key={value} value={value}>{contactRoleLabels[value]}</SelectItem>)}</SelectContent>
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
              activeProspect: ["DUPLICATE", "NO_CONTACT", "INACTIVE"].includes(nextStatus) ? false : lead.activeProspect,
            });
          }}
        >
          <SelectTrigger className="w-full rounded-xl" aria-label="Choisir l'état de qualification"><SelectValue>{(value) => contactQualificationStatusLabels[value as ContactQualificationStatus]}</SelectValue></SelectTrigger>
          <SelectContent>{contactQualificationStatuses.map((value) => <SelectItem key={value} value={value}>{contactQualificationStatusLabels[value]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ContactMethod valid={phoneValid} icon={<Phone className="size-4" />} label="Téléphone" />
        <ContactMethod valid={emailValid} icon={<Mail className="size-4" />} label="Email" />
      </div>
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--crm-riviera-bg-accent)] px-3 py-2 text-sm font-semibold">
        <span>Prospect actif</span>
        <input type="checkbox" checked={lead.activeProspect} disabled={qualificationDisablesProspect} onChange={(event) => onUpdate({ activeProspect: event.target.checked })} className="size-5 accent-[var(--crm-riviera-bg-action)]" />
      </label>
      <Button type="button" variant="secondary" className={rivieraSecondaryButtonClass} disabled={pendingId === `qualification-${lead.id}`} onClick={() => void onSaveQualification(lead)}>
        <Save className="size-4" />
        {pendingId === `qualification-${lead.id}` ? "Validation…" : "Valider la qualification"}
      </Button>
      <div className="grid gap-2 border-t border-[var(--crm-riviera-border-default)] pt-4">
        <Label>Statut commercial</Label>
        <Select value={lead.status} onValueChange={(value) => void onPersist(lead, { status: value as LeadStatus })}>
          <SelectTrigger className="w-full rounded-xl" aria-label="Choisir le statut commercial"><SelectValue>{(value) => leadStatusLabels[value as LeadStatus]}</SelectValue></SelectTrigger>
          <SelectContent>{leadStatuses.map((value) => <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </>
  );
}

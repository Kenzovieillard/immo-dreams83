"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { commercialHrefForTab } from "@/lib/commercial-navigation";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  ContactRound,
  Clock,
  FileSignature,
  Info,
  ImagePlus,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  Target,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BentoCard } from "@/components/admin/bento/bento-card";
import { BentoGrid } from "@/components/admin/bento/bento-grid";
import { BentoKpiCard } from "@/components/admin/bento/bento-kpi-card";
import {
  BentoCardSkeleton,
  BentoEmptyState,
  BentoErrorState,
} from "@/components/admin/bento/bento-states";
import {
  CrmMobileNavigation,
  type CrmTab,
} from "@/components/admin/crm-mobile-navigation";
import { CrmRivieraContacts } from "@/components/admin/crm-riviera-contacts";
import { CrmRivieraHeader } from "@/components/admin/crm-riviera-header";
import { StatisticsSidebarLinks, StatisticsWorkspace } from "@/components/admin/statistics/statistics-workspace";
import { SettingsWorkspace } from "@/components/admin/settings/settings-workspace";
import { CrmRivieraOnboarding } from "@/components/admin/crm-riviera-onboarding";
import { PropertyWorkspace } from "@/components/admin/properties/property-workspace";
import { AgendaWorkspace } from "@/components/admin/agenda/agenda-workspace";
import { OfferComposer } from "@/components/admin/offer-composer";
import { PipelineDossierDrawer } from "@/components/admin/pipeline-dossier-drawer";
import { PipelineReminderComposer } from "@/components/admin/pipeline-reminder-composer";
import {
  CrmRivieraOverview,
  type RivieraOverviewMetrics,
} from "@/components/admin/crm-riviera-overview";
import {
  RivieraMetric,
  RivieraPanel,
  RivieraStatusBadge,
  rivieraSecondaryButtonClass,
} from "@/components/admin/crm-riviera-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DiagnosticBar } from "@/components/site/diagnostic-bar";
import {
  formatNumber,
  formatPrice,
  type Property,
  type PropertyPublicationStatus,
  type PropertyStatus,
  type PropertyType,
  propertyPublicationStatusBadgeClasses,
  propertyPublicationStatusLabels,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/data/properties";
import {
  contactQualificationStatuses,
  contactQualificationStatusLabels,
  contactRoleLabels,
  contactRoles,
  commercialOfferStatusLabels,
  deriveContactRole,
  hasUsableContactMethod,
  leadPriorities,
  leadPriorityBadgeClasses,
  leadPriorityLabels,
  leadStatusLabels,
  leadStatuses,
} from "@/lib/crm";
import {
  getPipelineColumnId,
  getPropertyOfferIneligibility,
  matchesPipelineDossierSearch,
} from "@/lib/crm-pipeline-rules";
import {
  buildCrmDailyPriorities,
  type CrmDailyPriority,
} from "@/lib/crm-dashboard";
import {
  formatClimateDiagnostic,
  formatEnergyDiagnostic,
  parseDiagnosticValue,
} from "@/lib/dpe";
import type {
  LegacyCrmReviewSummary,
  MatchCategory,
  PlannedAction,
  SimulatedPayload,
} from "@/lib/legacy-crm-review";
import { cn } from "@/lib/utils";
import type { AdminRole } from "@/types/admin";
import type {
  Activity,
  AdminCrmLead,
  AdminTeamMember,
  ContactQualificationStatus,
  ContactLead,
  ContactRole,
  CrmOnboardingProgress,
  CrmOnboardingStepKey,
  CrmOverviewSnapshot,
  CommercialOffer,
  CommercialOfferStatus,
  EstimationLead,
  LeadPriority,
  LeadStatus,
  PipelineLead,
  PipelineMetrics,
  PipelinePermissions,
  PipelineTask,
  TaskEmailReminderStatus,
  TaskRecurrenceRule,
  TaskReminderChannel,
} from "@/types/crm";

const contactRequestTypes = ["Achat", "Vente", "Estimation", "Terrain", "Autre"] as const;
const propertyTypes = ["apartment", "house", "land", "commercial", "parking", "other"] as const satisfies PropertyType[];
const propertyStatuses = ["available", "under_offer", "sold"] as const satisfies PropertyStatus[];
const propertyPublicationStatuses = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const satisfies PropertyPublicationStatus[];
type AdminTab = CrmTab;
type ActivityEntityTypeFilter = "ALL" | "contact" | "estimation" | "property" | "other";
type ActivityActionFilter = "ALL" | "created" | "updated" | "archived" | "uploaded" | "deleted" | "other";
type ActivityPeriodFilter = "ALL" | "today" | "last7days" | "last30days";
type ActivityVisibilityFilter = "business" | "all" | "recipe";
type LegacyMatchFilter = "ALL" | MatchCategory;
type LegacyReviewStatusFilter = "ALL" | "PENDING" | "REVIEWED";
type LegacyReviewDecision = "READY_FOR_MIGRATION" | "MANUAL_REVIEW" | "DO_NOT_MERGE";

const taskRecurrenceLabels: Record<TaskRecurrenceRule, string> = {
  NONE: "Aucune",
  WEEKLY: "Hebdomadaire",
  MONTHLY: "Mensuelle",
};

const taskReminderChannelLabels: Record<TaskReminderChannel, string> = {
  NONE: "Aucune notification",
  EMAIL: "Email prepare",
};

const taskEmailReminderStatusLabels: Record<TaskEmailReminderStatus, string> = {
  NOT_SCHEDULED: "Non planifie",
  PENDING: "A envoyer",
  SENT: "Envoye",
  FAILED: "Erreur",
};

type LegacyReviewRecord = {
  id: string;
  createdAt: string;
  decision: LegacyReviewDecision | null;
  decisionLabel: string;
  actorEmail: string | null;
  note: string | null;
};

type LegacyReviewCandidate = SimulatedPayload & {
  review: LegacyReviewRecord | null;
};

type LegacyReviewResponse = {
  success: boolean;
  message?: string;
  generatedAt?: string;
  summary?: LegacyCrmReviewSummary;
  candidates?: LegacyReviewCandidate[];
  reviewSummary?: {
    reviewed: number;
    pending: number;
    readyForMigration: number;
    manualReview: number;
    doNotMerge: number;
  };
};

type PipelineResponse = {
  success?: boolean;
  message?: string;
  leads?: PipelineLead[];
  tasks?: PipelineTask[];
  offers?: CommercialOffer[];
  team?: AdminTeamMember[];
  metrics?: PipelineMetrics;
  permissions?: PipelinePermissions;
};

const emptyPipelinePermissions: PipelinePermissions = {
  canAssignDossiers: false,
  canCreateOffers: false,
  canDecideOffers: false,
};

const emptyPipelineMetrics: PipelineMetrics = {
  visits: 0,
  offers: 0,
  mandates: 0,
  sources: {
    visits: "missing",
    offers: "missing",
    mandates: "missing",
  },
};

export type RivieraPipelineLeadItem = {
  lead: PipelineLead;
  nextTask: PipelineTask | null;
};

export type RivieraPipelineColumn = {
  id: string;
  title: string;
  count: number;
  leads: RivieraPipelineLeadItem[];
};

function escapePipelineCsvValue(value: string | number | null | undefined) {
  const normalizedValue = value == null ? "" : String(value);
  return `"${normalizedValue.replaceAll('"', '""')}"`;
}

function getPipelineLeadStageLabel(lead: PipelineLead) {
  if (lead.hasActiveOffer) return "Offre";
  if (lead.hasActiveMandate) return "Mandat";
  if (lead.hasActiveAppointment) return "Rendez-vous";
  return leadStatusLabels[lead.status];
}

function getPipelineTaskTimeLabel(task: PipelineTask | null) {
  if (!task?.dueAt) return "Sans échéance";
  const dueAt = new Date(task.dueAt);
  if (Number.isNaN(dueAt.getTime())) return "Sans échéance";
  if (isTaskOverdue(task)) {
    return `En retard · ${dueAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`;
  }
  if (isTaskDueToday(task)) {
    return dueAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return dueAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

type OverviewResponse = {
  success?: boolean;
  message?: string;
  overview?: CrmOverviewSnapshot;
};

type OnboardingResponse = {
  success?: boolean;
  message?: string;
  progress?: CrmOnboardingProgress | null;
};

const activityEntityTypeLabels: Record<ActivityEntityTypeFilter, string> = {
  ALL: "Tous les types",
  contact: "Contact",
  estimation: "Estimation",
  property: "Bien",
  other: "Autre",
};

const activityActionLabels: Record<ActivityActionFilter, string> = {
  ALL: "Toutes les actions",
  created: "Création",
  updated: "Mise à jour",
  archived: "Archivage",
  uploaded: "Photo ajoutée",
  deleted: "Suppression",
  other: "Autre",
};

const activityPeriodLabels: Record<ActivityPeriodFilter, string> = {
  ALL: "Toutes les dates",
  today: "Aujourd'hui",
  last7days: "7 derniers jours",
  last30days: "30 derniers jours",
};

const activityVisibilityLabels: Record<ActivityVisibilityFilter, string> = {
  business: "Activité métier",
  all: "Tout afficher",
  recipe: "Recette uniquement",
};

const legacyMatchCategoryLabels: Record<MatchCategory, string> = {
  "MATCH CERTAIN": "Match certain",
  "MATCH PROBABLE": "Match probable",
  AMBIGU: "Ambigu",
  "AUCUN MATCH": "Aucun match",
};

const legacyMatchCategoryClasses: Record<MatchCategory, string> = {
  "MATCH CERTAIN": "border-0 bg-emerald-100 text-emerald-800",
  "MATCH PROBABLE": "border-0 bg-yellow-100 text-yellow-800",
  AMBIGU: "border-0 bg-orange-100 text-orange-800",
  "AUCUN MATCH": "border-0 bg-gray-100 text-gray-700",
};

const legacyPlannedActionLabels: Record<PlannedAction, string> = {
  CREATE_OR_REUSE_CONTACT: "Reutiliser ou creer le contact",
  CREATE_CONTACT_WITH_LEAD: "Creer contact + demande",
  MANUAL_REVIEW: "Revue manuelle obligatoire",
};

const legacyReviewDecisionLabels: Record<LegacyReviewDecision, string> = {
  READY_FOR_MIGRATION: "Pret pour migration future",
  MANUAL_REVIEW: "A revoir manuellement",
  DO_NOT_MERGE: "Ne pas fusionner",
};

const legacyMatchFilters = ["ALL", "MATCH CERTAIN", "MATCH PROBABLE", "AMBIGU", "AUCUN MATCH"] as const;
const landSaleOptions = [
  {
    label: "Surface cadastrale et bornage",
    description: "Limites, références cadastrales et bornes à confirmer.",
  },
  {
    label: "Constructibilité / PLU / CU",
    description: "Constructibilité à vérifier avec le PLU ou certificat d'urbanisme.",
  },
  {
    label: "Viabilisation réseaux",
    description: "Eau, électricité, télécoms et raccordements à préciser.",
  },
  {
    label: "Étude de sol",
    description: "À prévoir selon le secteur, le sol et le projet.",
  },
  {
    label: "Servitudes",
    description: "Passage, réseaux, vue ou contraintes privées à identifier.",
  },
  {
    label: "Accès véhicule",
    description: "Accès direct, chemin, voie publique ou servitude d'accès.",
  },
  {
    label: "Zone de risques",
    description: "Inondation, incendie, argile, bruit ou autre contrainte éventuelle.",
  },
  {
    label: "Libre constructeur",
    description: "Information utile si aucun constructeur n'est imposé.",
  },
  {
    label: "Assainissement",
    description: "Tout-à-l'égout, fosse ou raccordement à confirmer.",
  },
  {
    label: "Lotissement / permis d'aménager",
    description: "Règlement de lotissement ou autorisation à vérifier si concerné.",
  },
];
const landSaleOptionLabels = landSaleOptions.map((option) => option.label);

type AdminLead = AdminCrmLead;

const crmRivieraStyle = {
  "--crm-riviera-bg-canvas": "#f6f4ef",
  "--crm-riviera-bg-surface": "#fbfaf7",
  "--crm-riviera-bg-header": "#17221e",
  "--crm-riviera-bg-action": "#2f493a",
  "--crm-riviera-bg-accent": "#dce5d7",
  "--crm-riviera-text-primary": "#18211f",
  "--crm-riviera-text-secondary": "#59645f",
  "--crm-riviera-text-action": "#2f493a",
  "--crm-riviera-border-default": "#dfddd4",
  "--crm-riviera-status-success": "#4d7a5c",
  "--crm-riviera-status-warning": "#c28b2c",
  "--crm-riviera-status-danger": "#a94d43",
  "--crm-riviera-shadow-card": "0 2px 8px rgb(23 34 30 / 0.07)",
  overflowAnchor: "none",
} as CSSProperties;

type ContactFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  requestType: (typeof contactRequestTypes)[number];
  city: string;
  estimatedBudget: string;
  source: string;
  assignedTo: string;
  message: string;
};

const emptyContactForm: ContactFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  requestType: "Achat",
  city: "",
  estimatedBudget: "",
  source: "AGENCY",
  assignedTo: "UNASSIGNED",
  message: "",
};

type PropertyFormState = {
  title: string;
  type: PropertyType;
  status: PropertyStatus;
  publicationStatus: PropertyPublicationStatus;
  city: string;
  postalCode: string;
  price: string;
  surface: string;
  landSurface: string;
  rooms: string;
  bedrooms: string;
  bathrooms: string;
  energyClass: string;
  climateClass: string;
  descriptionShort: string;
  descriptionLong: string;
  featuresText: string;
  landOptions: string[];
  featured: boolean;
};

type PropertyDisplayMode = "list" | "grid";
type UploadedPropertyPhoto = {
  url: string;
  path: string;
  name: string;
  size: number;
  type: string;
};

function getStatusSelectLabel(value: unknown) {
  if (value === "ALL") return "Tous les statuts";
  if (typeof value === "string" && leadStatuses.includes(value as LeadStatus)) {
    return leadStatusLabels[value as LeadStatus];
  }

  return "Tous les statuts";
}

function getPrioritySelectLabel(value: unknown) {
  if (typeof value === "string" && leadPriorities.includes(value as LeadPriority)) {
    return leadPriorityLabels[value as LeadPriority];
  }

  return "Priorite";
}

function getTaskRecurrenceLabel(value: unknown) {
  if (value === "WEEKLY" || value === "MONTHLY" || value === "NONE") {
    return taskRecurrenceLabels[value];
  }

  return taskRecurrenceLabels.NONE;
}

function getTaskReminderChannelLabel(value: unknown) {
  if (value === "EMAIL" || value === "NONE") {
    return taskReminderChannelLabels[value];
  }

  return taskReminderChannelLabels.NONE;
}

function getTaskEmailStatusLabel(value: unknown) {
  if (value === "PENDING" || value === "SENT" || value === "FAILED" || value === "NOT_SCHEDULED") {
    return taskEmailReminderStatusLabels[value];
  }

  return taskEmailReminderStatusLabels.NOT_SCHEDULED;
}

function getTeamMemberLabel(member?: AdminTeamMember | null) {
  if (!member) return "Non assigne";
  return member.fullName || member.email;
}

function formatPipelineBudget(min: number | null, max: number | null) {
  if (min && max) return `${formatPrice(min)} - ${formatPrice(max)}`;
  if (max) return `jusqu'a ${formatPrice(max)}`;
  if (min) return `a partir de ${formatPrice(min)}`;
  return "Non renseigne";
}

function isOpenTask(task: PipelineTask) {
  return !task.completedAt;
}

function isTaskDueToday(task: PipelineTask) {
  if (!task.dueAt || task.completedAt) return false;
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function isTaskOverdue(task: PipelineTask) {
  if (!task.dueAt || task.completedAt) return false;
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

function getWeekStart(date = new Date()) {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getWeekEnd(date = new Date()) {
  const end = getWeekStart(date);
  end.setDate(end.getDate() + 7);
  return end;
}

function isTaskDueThisWeek(task: PipelineTask) {
  if (!task.dueAt || task.completedAt) return false;
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return due >= getWeekStart() && due < getWeekEnd();
}

function getTaskDueTone(task: PipelineTask) {
  if (isTaskOverdue(task)) return "text-red-700";
  if (isTaskDueToday(task)) return "text-orange-700";
  return "text-gray-600";
}

function getTaskDueLabel(task: PipelineTask) {
  if (isTaskOverdue(task)) return "En retard";
  if (isTaskDueToday(task)) return "Aujourd'hui";
  if (!task.dueAt) return "A planifier";
  return "Planifié";
}

function sortTasksByUrgency(tasks: PipelineTask[]) {
  return [...tasks].sort((a, b) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}

function groupTasksByLead(tasks: PipelineTask[]) {
  return tasks.reduce((map, task) => {
    if (!task.leadId) return map;
    const current = map.get(task.leadId) ?? [];
    current.push(task);
    map.set(task.leadId, current);
    return map;
  }, new Map<string, PipelineTask[]>());
}

function exportPipelineCsv(leads: PipelineLead[], tasks: PipelineTask[]) {
  const openTasksByLead = groupTasksByLead(tasks.filter(isOpenTask));
  const rows = leads.map((lead) => {
    const nextTask = sortTasksByUrgency(openTasksByLead.get(lead.id) ?? [])[0];

    return [
      lead.dossierReference,
      lead.contactName,
      lead.requestType,
      lead.city,
      lead.linkedPropertyTitle ?? "",
      getPipelineLeadStageLabel(lead),
      leadPriorityLabels[lead.priority],
      lead.assignedToName ?? "Non attribué",
      lead.offerCount,
      nextTask?.title ?? "Aucune prochaine action",
      nextTask?.dueAt ? formatDateTime(nextTask.dueAt) : "",
    ];
  });
  const csv = [
    [
      "Référence dossier",
      "Contact",
      "Projet",
      "Ville",
      "Bien lié",
      "Étape",
      "Priorité",
      "Responsable",
      "Nombre d'offres",
      "Prochaine action",
      "Échéance",
    ],
    ...rows,
  ]
    .map((row) => row.map(escapePipelineCsvValue).join(";"))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = `pipeline-commercial-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

function getLeadNextOpenTask(tasks: PipelineTask[]) {
  return sortTasksByUrgency(tasks.filter(isOpenTask))[0] ?? null;
}

function buildWeeklyTaskGroups(tasks: PipelineTask[], leadById: Map<string, PipelineLead>) {
  const start = getWeekStart();
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const dayKey = day.toISOString().slice(0, 10);

    return {
      day,
      dayKey,
      tasks: sortTasksByUrgency(
        tasks.filter((task) => {
          if (!task.dueAt) return false;
          const due = new Date(task.dueAt);
          if (Number.isNaN(due.getTime())) return false;
          return due.toISOString().slice(0, 10) === dayKey;
        })
      ).map((task) => ({ task, lead: task.leadId ? leadById.get(task.leadId) ?? null : null })),
    };
  });
}

type PipelineAgentStat = {
  id: string;
  label: string;
  isUnassigned: boolean;
  leadCount: number;
  newLeadCount: number;
  appointmentCount: number;
  mandateCount: number;
  urgentLeadCount: number;
  openTaskCount: number;
  todayTaskCount: number;
  overdueTaskCount: number;
};

function buildPipelineAgentStats(
  leads: PipelineLead[],
  openTasks: PipelineTask[],
  team: AdminTeamMember[]
) {
  const teamById = new Map(team.map((member) => [member.id, member]));
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const stats = new Map<string, PipelineAgentStat>();

  function ensureStat(id: string | null | undefined) {
    const safeId = id || "UNASSIGNED";
    const member = safeId === "UNASSIGNED" ? null : teamById.get(safeId);
    const existing = stats.get(safeId);

    if (existing) return existing;

    const created: PipelineAgentStat = {
      id: safeId,
      label: member ? getTeamMemberLabel(member) : "Non assigné",
      isUnassigned: safeId === "UNASSIGNED",
      leadCount: 0,
      newLeadCount: 0,
      appointmentCount: 0,
      mandateCount: 0,
      urgentLeadCount: 0,
      openTaskCount: 0,
      todayTaskCount: 0,
      overdueTaskCount: 0,
    };
    stats.set(safeId, created);
    return created;
  }

  team.forEach((member) => ensureStat(member.id));
  ensureStat("UNASSIGNED");

  leads.forEach((lead) => {
    const stat = ensureStat(lead.assignedTo);
    stat.leadCount += 1;
    if (lead.status === "NEW") stat.newLeadCount += 1;
    if (lead.status === "APPOINTMENT") stat.appointmentCount += 1;
    if (lead.status === "MANDATE_SIGNED") stat.mandateCount += 1;
    if (lead.priority === "high" || lead.priority === "urgent") stat.urgentLeadCount += 1;
  });

  openTasks.forEach((task) => {
    const linkedLead = task.leadId ? leadById.get(task.leadId) : null;
    const stat = ensureStat(task.assignedTo ?? linkedLead?.assignedTo);
    stat.openTaskCount += 1;
    if (isTaskDueToday(task) && !isTaskOverdue(task)) stat.todayTaskCount += 1;
    if (isTaskOverdue(task)) stat.overdueTaskCount += 1;
  });

  return Array.from(stats.values())
    .filter((stat) => stat.leadCount > 0 || stat.openTaskCount > 0 || stat.isUnassigned)
    .sort((a, b) => {
      if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? -1 : 1;
      const aWorkload = a.leadCount + a.openTaskCount + a.overdueTaskCount;
      const bWorkload = b.leadCount + b.openTaskCount + b.overdueTaskCount;
      return bWorkload - aWorkload;
    });
}

export function CrmRivieraPipeline({
  activeLeads,
  dailyTasks,
  columns,
  totalLeads,
  metrics,
  urgentCount,
  team,
  assignee,
  onAssigneeChange,
  onRefresh,
  onExport,
  onOpenLead,
  onStartReminder,
  onCompleteTask,
  pendingId,
  error,
  feedback,
}: {
  activeLeads: PipelineLead[];
  dailyTasks: Array<{ task: PipelineTask; lead: PipelineLead | null }>;
  columns: RivieraPipelineColumn[];
  totalLeads: number;
  metrics: PipelineMetrics;
  urgentCount: number;
  team: AdminTeamMember[];
  assignee: string;
  onAssigneeChange: (assignee: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  onOpenLead: (lead: PipelineLead) => void;
  onStartReminder: (leadId?: string) => void;
  onCompleteTask: (task: PipelineTask) => void;
  pendingId: string | null;
  error: string;
  feedback: string;
}) {
  const commercialAgentCount = team.length;
  const mobileTaskRows = dailyTasks.slice(0, 2);
  const mobileUnassignedLeads = activeLeads
    .filter((lead) => lead.status === "NEW" && !lead.assignedTo)
    .slice(0, Math.max(0, 2 - mobileTaskRows.length));
  const mobileActionCount = dailyTasks.length + activeLeads.filter(
    (lead) => lead.status === "NEW" && !lead.assignedTo
  ).length;

  return (
    <div className="grid min-w-0 gap-4 sm:gap-5">
      <div className="hidden items-center justify-between gap-6 md:flex">
        <div>
          <h2 className="text-3xl font-bold leading-10 text-[var(--crm-riviera-text-primary)]">
            Pipeline commercial
          </h2>
          <p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">
            Prospects, étapes, rappels et assignations
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className={rivieraSecondaryButtonClass}
          onClick={onExport}
          aria-label="Exporter les dossiers affichés au format CSV"
          title="Exporter les dossiers affichés au format CSV"
        >
          <ArrowDown className="size-4" />
          Exporter
        </Button>
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {feedback ? <p className="rounded-xl bg-[var(--crm-riviera-bg-accent)] p-3 text-sm text-[var(--crm-riviera-text-primary)]">{feedback}</p> : null}

      <div className="grid gap-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-[var(--crm-riviera-text-primary)]">À traiter aujourd&apos;hui</h2>
          <RivieraStatusBadge>{mobileActionCount} action{mobileActionCount > 1 ? "s" : ""}</RivieraStatusBadge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <RivieraMetric label="Leads" value={totalLeads} className="px-3 py-3" />
          <RivieraMetric label="Visites" value={metrics.visits} className="px-3 py-3" />
          <RivieraMetric label="Offres" value={metrics.offers} className="px-3 py-3" />
        </div>

        <Select value={assignee} onValueChange={(value) => onAssigneeChange(String(value))}>
          <SelectTrigger
            aria-label="Filtrer les dossiers par responsable"
            className="min-h-11 rounded-2xl border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)]"
          >
            <SelectValue>
              {(value) =>
                value === "ALL"
                  ? "Toute l'équipe"
                  : value === "UNASSIGNED"
                    ? "Dossiers non attribués"
                    : getTeamMemberLabel(team.find((member) => member.id === value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toute l&apos;équipe</SelectItem>
            {team.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {getTeamMemberLabel(member)}
              </SelectItem>
            ))}
            <SelectItem value="UNASSIGNED">Non attribués</SelectItem>
          </SelectContent>
        </Select>

        {mobileActionCount ? (
          <>
          {mobileTaskRows.map(({ task, lead }) => (
            <article
              key={task.id}
              className="grid gap-3 rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-4 shadow-[var(--crm-riviera-shadow-card)]"
            >
              <div className="flex items-center justify-between gap-3">
                <RivieraStatusBadge tone={isTaskOverdue(task) ? "danger" : "warning"}>
                  {isTaskOverdue(task) ? "En retard" : "À rappeler"}
                </RivieraStatusBadge>
                <span className="text-xs font-medium text-[var(--crm-riviera-text-secondary)]">
                  {getPipelineTaskTimeLabel(task)}
                </span>
              </div>
              <div>
                <p className="font-semibold text-[var(--crm-riviera-text-primary)]">
                  {lead?.contactName ?? task.title}
                </p>
                <p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">
                  {lead
                    ? `${lead.requestType} · ${lead.city ?? "Ville non renseignée"}`
                    : task.title}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--crm-riviera-text-action)]">
                  <UserRound className="size-3.5" aria-hidden="true" />
                  {task.assignedToName ?? lead?.assignedToName ?? "Non attribué"}
                </p>
              </div>
              {lead ? (
                <button
                  type="button"
                  onClick={() => onOpenLead(lead)}
                  className="ml-auto min-h-9 text-sm font-semibold text-[var(--crm-riviera-text-action)]"
                >
                  Ouvrir le dossier →
                </button>
              ) : null}
            </article>
          ))}
          {mobileUnassignedLeads.map((lead) => (
            <article
              key={lead.id}
              className="grid gap-3 rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-4 shadow-[var(--crm-riviera-shadow-card)]"
            >
              <div className="flex items-center justify-between gap-3">
                <RivieraStatusBadge tone="warning">À attribuer</RivieraStatusBadge>
                <span className="font-mono text-[10px] text-[var(--crm-riviera-text-secondary)]">
                  {lead.dossierReference}
                </span>
              </div>
              <div>
                <p className="font-semibold text-[var(--crm-riviera-text-primary)]">{lead.contactName}</p>
                <p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">
                  {lead.requestType} · {lead.city ?? "Ville non renseignée"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenLead(lead)}
                className="ml-auto min-h-9 text-sm font-semibold text-[var(--crm-riviera-text-action)]"
              >
                Ouvrir le dossier →
              </button>
            </article>
          ))}
          </>
        ) : (
          <div className="rounded-2xl bg-[var(--crm-riviera-bg-accent)] px-5 py-6 text-center">
            <p className="font-semibold text-[var(--crm-riviera-text-primary)]">Aucune action urgente</p>
            <p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">
              Les prochaines échéances apparaîtront ici.
            </p>
          </div>
        )}

        <Button
          type="button"
          className="min-h-12 w-full bg-[var(--crm-riviera-bg-action)] text-white hover:bg-[var(--crm-riviera-bg-header)]"
          onClick={() => onStartReminder(activeLeads[0]?.id)}
          disabled={!activeLeads.length}
        >
          <Plus className="size-4" />
          Créer un rappel
        </Button>
      </div>

      <div className="hidden gap-4 md:grid lg:grid-cols-12 lg:gap-5">
        <RivieraPanel className="grid gap-4 p-4 lg:col-span-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-[var(--crm-riviera-text-primary)]">Progression du pipeline</h3>
            <RivieraStatusBadge>{totalLeads} actifs</RivieraStatusBadge>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <RivieraMetric label="Leads" value={totalLeads} />
            <RivieraMetric label="Visites" value={metrics.visits} />
            <RivieraMetric label="Offres" value={metrics.offers} />
            <RivieraMetric label="Mandats" value={metrics.mandates} />
          </div>
          {Object.values(metrics.sources).includes("missing") ? (
            <p className="text-xs font-medium text-[var(--crm-riviera-text-secondary)]">
              Certaines sources métier ne sont pas encore connectées. Les valeurs concernées restent à zéro.
            </p>
          ) : null}
        </RivieraPanel>

        <RivieraPanel className="grid content-start gap-3 p-4 lg:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-[var(--crm-riviera-text-primary)]">Rappels prioritaires</h3>
            <RivieraStatusBadge tone={urgentCount ? "warning" : "success"}>
              {urgentCount} urgence{urgentCount > 1 ? "s" : ""}
            </RivieraStatusBadge>
          </div>
          {dailyTasks.length ? (
            <div className="grid gap-2">
              {dailyTasks.slice(0, 3).map(({ task, lead }) => (
                <div key={task.id} className="grid gap-1 rounded-xl bg-[var(--crm-riviera-bg-surface)] py-1.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[var(--crm-riviera-text-primary)]">
                      {task.dueAt ? new Date(task.dueAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "A planifier"}
                    </span>
                    <button
                      type="button"
                      disabled={pendingId === task.id}
                      onClick={() => onCompleteTask(task)}
                      className="text-xs font-semibold text-[var(--crm-riviera-text-action)]"
                    >
                      Terminer
                    </button>
                  </div>
                  <p className="text-xs text-[var(--crm-riviera-text-secondary)]">
                    {task.title} {lead ? `· ${lead.contactName}` : ""}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--crm-riviera-text-action)]">
                    <UserRound className="size-3.5" aria-hidden="true" />
                    {task.assignedToName ?? lead?.assignedToName ?? "Non attribué"}
                  </p>
                </div>
              ))}
              <button type="button" onClick={onRefresh} className="w-fit min-h-9 text-sm font-semibold text-[var(--crm-riviera-text-action)]">
                Ouvrir les {dailyTasks.length} tâches →
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--crm-riviera-text-secondary)]">Aucun rappel prioritaire.</p>
          )}
        </RivieraPanel>

        <RivieraPanel className="grid gap-4 p-4 lg:col-span-12">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-[var(--crm-riviera-text-primary)]">Dossiers actifs</h3>
            <div className="flex items-center gap-2">
              <RivieraStatusBadge>
                {commercialAgentCount} agent{commercialAgentCount > 1 ? "s" : ""}
              </RivieraStatusBadge>
              <Select value={assignee} onValueChange={(value) => onAssigneeChange(String(value))}>
                <SelectTrigger
                  aria-label="Filtrer les dossiers par responsable"
                  className="h-9 min-w-40 rounded-full border-0 bg-[var(--crm-riviera-bg-accent)] px-3 text-xs font-semibold"
                >
                  <SelectValue>
                    {(value) =>
                      value === "ALL"
                        ? "Vue équipe"
                        : value === "UNASSIGNED"
                          ? "Non attribués"
                          : getTeamMemberLabel(team.find((member) => member.id === value))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Vue équipe</SelectItem>
                  {team.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {getTeamMemberLabel(member)}
                    </SelectItem>
                  ))}
                  <SelectItem value="UNASSIGNED">Non attribués</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {activeLeads.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {columns.map((column) => (
                <section key={column.id} className="grid min-w-0 content-start gap-3 rounded-2xl bg-[#f1eee6] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--crm-riviera-text-primary)]">{column.title}</h4>
                    <RivieraStatusBadge>{column.count}</RivieraStatusBadge>
                  </div>
                  <div className="grid max-h-[36rem] gap-3 overflow-y-auto pr-1">
                  {column.leads.map(({ lead, nextTask }) => (
                    <article key={lead.id} className="grid gap-2 rounded-2xl bg-[var(--crm-riviera-bg-surface)] p-3 shadow-[var(--crm-riviera-shadow-card)]">
                      <div className="flex items-center justify-between gap-2">
                        <RivieraStatusBadge
                          tone={
                            nextTask && isTaskOverdue(nextTask)
                              ? "danger"
                              : lead.priority === "urgent" || lead.priority === "high"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {nextTask && isTaskOverdue(nextTask)
                            ? "En retard"
                            : lead.priority === "urgent" || lead.priority === "high"
                              ? "À suivre"
                              : getPipelineLeadStageLabel(lead)}
                        </RivieraStatusBadge>
                        <span className="text-xs text-[var(--crm-riviera-text-secondary)]">
                          {getPipelineTaskTimeLabel(nextTask)}
                        </span>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-[var(--crm-riviera-text-secondary)]">
                          {lead.dossierReference}
                        </p>
                        <p className="font-semibold text-[var(--crm-riviera-text-primary)]">{lead.contactName}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--crm-riviera-text-secondary)]">
                          {lead.requestType} · {lead.city ?? "Ville non renseignée"}
                        </p>
                        <p className="mt-2 line-clamp-2 text-xs font-medium text-[var(--crm-riviera-text-primary)]">
                          {nextTask?.title ?? "Aucune prochaine action planifiée"}
                        </p>
                        {lead.linkedPropertyTitle ? (
                          <p className="mt-1 line-clamp-1 text-xs text-[var(--crm-riviera-text-secondary)]">
                            Bien : {lead.linkedPropertyTitle}
                          </p>
                        ) : null}
                        {lead.latestOfferStatus ? (
                          <p className="mt-1 text-xs font-semibold text-[var(--crm-riviera-text-action)]">
                            {lead.offerCount} offre{lead.offerCount > 1 ? "s" : ""} · {commercialOfferStatusLabels[lead.latestOfferStatus]}
                          </p>
                        ) : null}
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--crm-riviera-text-action)]">
                          <UserRound className="size-3.5" aria-hidden="true" />
                          {lead.assignedToName ?? "Non attribué"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenLead(lead)}
                        className="w-fit min-h-8 text-xs font-semibold text-[var(--crm-riviera-text-action)]"
                      >
                        Voir le dossier →
                      </button>
                    </article>
                  ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartReminder(column.leads[0]?.lead.id)}
                    className="hidden min-h-8 w-fit text-xs font-semibold text-[var(--crm-riviera-text-action)] md:inline-flex md:items-center"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Créer un rappel
                  </button>
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--crm-riviera-bg-accent)] px-5 py-8 text-center">
              <p className="font-semibold text-[var(--crm-riviera-text-primary)]">Aucun dossier actif</p>
              <p className="mt-2 text-sm text-[var(--crm-riviera-text-secondary)]">Les prochains prospects apparaîtront ici.</p>
            </div>
          )}
        </RivieraPanel>
      </div>
    </div>
  );
}

function parseMultilineValues(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getPropertyFeatureList(form: PropertyFormState) {
  return uniqueValues([
    ...parseMultilineValues(form.featuresText),
    ...(form.type === "land" ? form.landOptions : []),
  ]);
}

function getCommercialStatusFromLegacy(status: PropertyStatus) {
  if (status === "under_offer") return "UNDER_OFFER" as const;
  if (status === "sold") return "SOLD" as const;
  return "AVAILABLE" as const;
}

function toNumberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getNumericDiagnosticInput(value: string) {
  const parsed = parseDiagnosticValue(value);
  return parsed === null ? "" : String(parsed);
}

function propertyToForm(property: Property): PropertyFormState {
  const landOptions = property.features.filter((feature) => landSaleOptionLabels.includes(feature));
  const manualFeatures = property.features.filter((feature) => !landSaleOptionLabels.includes(feature));

  return {
    title: property.title,
    type: property.type,
    status: property.status,
    publicationStatus: property.publicationStatus ?? "DRAFT",
    city: property.city,
    postalCode: property.postalCode,
    price: String(property.price || ""),
    surface: String(property.surface || ""),
    landSurface: property.landSurface ? String(property.landSurface) : "",
    rooms: property.rooms ? String(property.rooms) : "",
    bedrooms: property.bedrooms ? String(property.bedrooms) : "",
    bathrooms: property.bathrooms ? String(property.bathrooms) : "",
    energyClass: property.type === "land" ? "" : getNumericDiagnosticInput(property.energyClass),
    climateClass: property.type === "land" ? "" : getNumericDiagnosticInput(property.climateClass),
    descriptionShort: property.descriptionShort,
    descriptionLong: property.descriptionLong,
    featuresText: manualFeatures.join("\n"),
    landOptions,
    featured: property.featured,
  };
}

function buildUpdatedProperty(property: Property, form: PropertyFormState, photoUrls = property.photos): Property {
  const now = new Date().toISOString();
  const isLand = form.type === "land";

  return {
    ...property,
    title: form.title.trim(),
    type: form.type,
    status: form.status,
    commercialStatus: getCommercialStatusFromLegacy(form.status),
    publicationStatus: form.publicationStatus,
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    price: toNumberOrNull(form.price) ?? property.price,
    surface: toNumberOrNull(form.surface) ?? property.surface,
    landSurface: isLand ? toNumberOrNull(form.surface) : toNumberOrNull(form.landSurface),
    rooms: isLand ? null : toNumberOrNull(form.rooms),
    bedrooms: isLand ? null : toNumberOrNull(form.bedrooms),
    bathrooms: isLand ? null : toNumberOrNull(form.bathrooms),
    energyClass: isLand ? "Non soumis" : formatEnergyDiagnostic(form.energyClass),
    climateClass: isLand ? "Non soumis" : formatClimateDiagnostic(form.climateClass),
    descriptionShort: form.descriptionShort.trim(),
    descriptionLong: form.descriptionLong.trim() || form.descriptionShort.trim(),
    features: getPropertyFeatureList(form),
    photos: photoUrls,
    featured: form.featured,
    publishedAt: form.publicationStatus === "PUBLISHED" ? property.publishedAt ?? now : property.publishedAt ?? null,
    archivedAt: form.publicationStatus === "ARCHIVED" ? property.archivedAt ?? now : null,
  };
}

function getActiveLeads(leads: AdminLead[]) {
  return leads.filter((lead) => !lead.archived);
}

function getAverage(values: number[]) {
  const cleanValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (cleanValues.length === 0) return 0;
  return cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length;
}

function formatPercentage(value: number) {
  if (!Number.isFinite(value)) return "Non calculable";
  return `${Math.round(value)} %`;
}

function formatDateTime(value?: string) {
  if (!value) return "Non renseigné";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigné";
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function includesText(value: string, terms: string[]) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return terms.some((term) => normalized.includes(term));
}

function hasMissingDiagnostics(property: Property) {
  if (property.type === "land") return false;
  const energy = property.energyClass.trim().toLowerCase();
  const climate = property.climateClass.trim().toLowerCase();

  return (
    !energy ||
    !climate ||
    energy.includes("non renseign") ||
    climate.includes("non renseign") ||
    energy === "-" ||
    climate === "-"
  );
}

function getPropertyQualityIssues(property: Property) {
  const issues: string[] = [];
  const isPublic = property.publicationStatus === "PUBLISHED" && property.status !== "sold";

  if (!property.title.trim()) issues.push("Titre");
  if (property.photos.length === 0) issues.push("Photo principale");
  if (!Number.isFinite(property.price) || property.price <= 0) issues.push("Prix");
  if (!property.status) issues.push("Statut");
  if (!property.publicationStatus) issues.push("Publication");
  if (hasMissingDiagnostics(property)) issues.push("DPE/GES");
  if (property.featured && !isPublic) issues.push("A la une non publiee");

  return issues;
}

function getCityStats(properties: Property[], leads: AdminLead[]) {
  const propertyMap = new Map<string, { city: string; count: number; totalPrice: number }>();
  const leadMap = new Map<string, { city: string; count: number }>();

  properties.forEach((property) => {
    const key = property.city.trim().toLowerCase() || "non renseigné";
    const current = propertyMap.get(key) ?? { city: property.city || "Non renseignée", count: 0, totalPrice: 0 };
    current.count += 1;
    current.totalPrice += property.price;
    propertyMap.set(key, current);
  });

  leads.forEach((lead) => {
    const city = lead.city.replace(/\s*\([^)]*\)/g, "").trim() || "Non renseignée";
    const key = city.toLowerCase();
    const current = leadMap.get(key) ?? { city, count: 0 };
    current.count += 1;
    leadMap.set(key, current);
  });

  return {
    propertiesByCity: Array.from(propertyMap.values())
      .map((item) => ({
        ...item,
        averagePrice: item.count > 0 ? Math.round(item.totalPrice / item.count) : 0,
      }))
      .sort((a, b) => b.count - a.count),
    leadsByCity: Array.from(leadMap.values()).sort((a, b) => b.count - a.count),
  };
}

function getActivityActionBucket(action: string): Exclude<ActivityActionFilter, "ALL"> {
  if (includesText(action, ["supprim", "delete", "deleted"])) return "deleted";
  if (includesText(action, ["photo", "upload", "ajout"])) return "uploaded";
  if (includesText(action, ["archive"])) return "archived";
  if (includesText(action, ["mise", "mis a jour", "statut", "note", "update"])) return "updated";
  if (includesText(action, ["cree", "creation", "nouvelle", "new"])) return "created";
  return "other";
}

function getActivityEntityBucket(entityType: string): ActivityEntityTypeFilter {
  if (entityType === "contact" || entityType === "estimation" || entityType === "property") {
    return entityType;
  }

  return "other";
}

function isRecipeActivity(activity: Activity) {
  return includesText(activity.action, [
    "test rappel phase 3",
    "recette phase 3",
    "recette production",
  ]);
}

function isActivityInPeriod(activity: Activity, period: ActivityPeriodFilter) {
  if (period === "ALL") return true;

  const date = new Date(activity.created_at);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "today") return date >= start;

  const days = period === "last7days" ? 7 : 30;
  const threshold = new Date(now);
  threshold.setDate(now.getDate() - days);
  return date >= threshold;
}

function filterActivities(
  activities: Activity[],
  search: string,
  entityType: ActivityEntityTypeFilter,
  action: ActivityActionFilter,
  period: ActivityPeriodFilter,
  visibility: ActivityVisibilityFilter
) {
  const normalizedSearch = search.trim().toLowerCase();

  return activities.filter((activity) => {
    const recipeActivity = isRecipeActivity(activity);
    if (visibility === "business" && recipeActivity) return false;
    if (visibility === "recipe" && !recipeActivity) return false;

    const formattedDate = formatDateTime(activity.created_at);
    const haystack = [
      activity.action,
      activity.entity_type,
      activity.user_name,
      formattedDate,
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!normalizedSearch || haystack.includes(normalizedSearch)) &&
      (entityType === "ALL" || getActivityEntityBucket(activity.entity_type) === entityType) &&
      (action === "ALL" || getActivityActionBucket(activity.action) === action) &&
      isActivityInPeriod(activity, period)
    );
  });
}

function buildAdminMetrics(
  contactLeads: AdminLead[],
  estimationLeads: AdminLead[],
  propertyItems: Property[],
  activities: Activity[]
) {
  const activeContacts = getActiveLeads(contactLeads);
  const activeEstimations = getActiveLeads(estimationLeads);
  const contactsToQualify = activeContacts.filter(
    (lead) => lead.qualificationStatus === "TO_REVIEW"
  ).length;
  const contactsReadyForPipeline = activeContacts.filter(
    (lead) =>
      lead.qualificationStatus === "QUALIFIED" &&
      lead.activeProspect &&
      lead.contactRole !== "UNKNOWN" &&
      !lead.pipelineLeadId
  ).length;
  const contactsWithoutMethod = activeContacts.filter(
    (lead) => lead.qualificationStatus === "NO_CONTACT"
  ).length;
  const activeLeads = [...activeContacts, ...activeEstimations];
  const allLeads = [...contactLeads, ...estimationLeads];
  const statusCounts = leadStatuses.reduce(
    (acc, status) => ({
      ...acc,
      [status]: activeLeads.filter((lead) => lead.status === status).length,
    }),
    {} as Record<LeadStatus, number>
  );
  const averagePrice = getAverage(propertyItems.map((property) => property.price));
  const averageSurface = getAverage(propertyItems.map((property) => property.surface));
  const averagePricePerSquareMeter = getAverage(
    propertyItems
      .filter((property) => property.surface > 0 && property.price > 0)
      .map((property) => property.price / property.surface)
  );
  const cityStats = getCityStats(propertyItems, allLeads);
  const latestLeads = [...activeLeads].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const latestSubmission = [...allLeads].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
  const totalLeads = activeLeads.length;
  const conversionRate =
    totalLeads > 0 ? (statusCounts.MANDATE_SIGNED / totalLeads) * 100 : Number.NaN;

  return {
    totalLeads,
    contacts: activeContacts.length,
    contactsToQualify,
    contactsReadyForPipeline,
    contactsWithoutMethod,
    estimations: activeEstimations.length,
    newLeads: statusCounts.NEW,
    contactedLeads: statusCounts.CONTACTED,
    appointments: statusCounts.APPOINTMENT,
    mandateSigned: statusCounts.MANDATE_SIGNED,
    lostLeads: statusCounts.LOST,
    conversionRate,
    totalProperties: propertyItems.length,
    availableProperties: propertyItems.filter((property) => property.status === "available").length,
    underOfferProperties: propertyItems.filter((property) => property.status === "under_offer").length,
    soldProperties: propertyItems.filter((property) => property.status === "sold").length,
    featuredProperties: propertyItems.filter((property) => property.featured).length,
    apartments: propertyItems.filter((property) => property.type === "apartment").length,
    houses: propertyItems.filter((property) => property.type === "house").length,
    lands: propertyItems.filter((property) => property.type === "land").length,
    commercialProperties: propertyItems.filter((property) => property.type === "commercial").length,
    parkingProperties: propertyItems.filter((property) => property.type === "parking").length,
    otherProperties: propertyItems.filter((property) => property.type === "other").length,
    averagePrice,
    averageSurface,
    averagePricePerSquareMeter,
    propertiesWithoutPhotos: propertyItems.filter((property) => property.photos.length === 0).length,
    propertiesWithoutDiagnostics: propertyItems.filter(hasMissingDiagnostics).length,
    propertiesNotFeatured: propertyItems.filter((property) => !property.featured).length,
    latestActivityCount: activities.slice(0, 5).length,
    latestLeads: latestLeads.slice(0, 5),
    latestActivities: activities.slice(0, 5),
    contactSubmissions: contactLeads.length,
    estimationSubmissions: estimationLeads.length,
    estimationContactRatio: contactLeads.length > 0 ? estimationLeads.length / contactLeads.length : Number.NaN,
    latestSubmissionDate: latestSubmission?.createdAt,
    totalActivities: activities.length,
    activitiesByEntity: ["contact", "estimation", "property", "other"].map((entity) => ({
      label: entity === "other" ? "Autre" : activityEntityTypeLabels[entity as ActivityEntityTypeFilter],
      count: activities.filter((activity) => getActivityEntityBucket(activity.entity_type) === entity).length,
    })),
    latestActivityDate: activities[0]?.created_at,
    ...cityStats,
  };
}

type AdminMetrics = ReturnType<typeof buildAdminMetrics>;

function KpiCard({
  label,
  value,
  description,
  tone = "dark",
}: {
  label: string;
  value: ReactNode;
  description?: string;
  tone?: "dark" | "orange";
}) {
  return <BentoKpiCard label={label} value={value} description={description} tone={tone} />;
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(6, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div className="h-2 overflow-hidden rounded-full bg-orange-100">
      <div className="h-full rounded-full bg-orange-500" style={{ width: `${width}%` }} />
    </div>
  );
}

function MetricLine({ label, value, max }: { label: string; value: ReactNode; max?: number }) {
  const numericValue = typeof value === "number" ? value : 0;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-gray-600">{label}</span>
        <strong className="text-[#111111]">{value}</strong>
      </div>
      {typeof max === "number" ? <MiniBar value={numericValue} max={max} /> : null}
    </div>
  );
}

function LeadPreview({ lead }: { lead: AdminLead }) {
  return (
    <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-[#111111]">{lead.name}</p>
          <p className="mt-1 text-xs text-gray-500">{lead.category} · {lead.city}</p>
        </div>
        <Badge className="border-0 bg-white text-orange-700">{leadStatusLabels[lead.status]}</Badge>
      </div>
      <p className="mt-3 text-xs text-gray-500">{formatDateTime(lead.createdAt)}</p>
    </div>
  );
}

function ActivityPreview({ activity }: { activity: Activity }) {
  return (
    <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-[#111111]">{activity.action}</p>
        <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">
          {activity.entity_type}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-gray-500">{activity.user_name} · {formatDateTime(activity.created_at)}</p>
    </div>
  );
}

function BentoDesignDashboard({
  metrics,
  overview,
  setActiveTab,
  priorities,
  pipelineTasks,
  onPriorityAction,
  onCreateContact,
  onboardingProgress,
  onboardingSavingStep,
  onboardingError,
  onToggleOnboardingStep,
}: {
  metrics: AdminMetrics;
  overview?: CrmOverviewSnapshot | null;
  setActiveTab: (tab: AdminTab) => void;
  priorities?: CrmDailyPriority[];
  pipelineTasks?: PipelineTask[];
  onPriorityAction?: (priority: CrmDailyPriority) => void;
  onCreateContact?: () => void;
  onboardingProgress?: CrmOnboardingProgress | null;
  onboardingSavingStep?: CrmOnboardingStepKey | null;
  onboardingError?: string;
  onToggleOnboardingStep?: (step: CrmOnboardingStepKey, completed: boolean) => void;
}) {
  if (priorities && pipelineTasks && onPriorityAction && onCreateContact) {
    const overviewMetrics: RivieraOverviewMetrics = {
      totalLeads: overview?.metrics.totalLeads ?? metrics.totalLeads,
      newLeads: overview?.metrics.newLeads ?? metrics.newLeads,
      visits: overview?.metrics.visits ?? metrics.appointments,
      offers: overview?.metrics.offers ?? metrics.underOfferProperties,
      availableProperties: overview?.metrics.availableProperties ?? metrics.availableProperties,
      propertiesWithoutPhotos: overview?.metrics.propertiesWithoutPhotos ?? metrics.propertiesWithoutPhotos,
      contactsToQualify: overview?.metrics.contactsToQualify ?? metrics.contactsToQualify,
      openTasks: overview?.metrics.openTasks ?? pipelineTasks.filter((task) => !task.completedAt).length,
      todayTasks: overview?.metrics.todayTasks ?? pipelineTasks.filter((task) => isTaskDueToday(task)).length,
    };
    const isEmptyWorkspace =
      overviewMetrics.totalLeads === 0 &&
      overviewMetrics.availableProperties === 0 &&
      overviewMetrics.visits === 0 &&
      overviewMetrics.offers === 0 &&
      overviewMetrics.openTasks === 0;

    if (!onboardingProgress?.completedAt && (isEmptyWorkspace || Boolean(onboardingProgress))) {
      return (
        <CrmRivieraOnboarding
          profileCompleted={onboardingProgress?.profileCompleted ?? false}
          contactsCompleted={onboardingProgress?.contactsCompleted ?? false}
          pipelineCompleted={onboardingProgress?.pipelineCompleted ?? false}
          appointmentCompleted={onboardingProgress?.appointmentCompleted ?? false}
          savingStep={onboardingSavingStep}
          saveError={onboardingError}
          onToggleStep={onToggleOnboardingStep}
          onOpenProfile={() => setActiveTab("settings")}
          onOpenContacts={() => {
            onCreateContact();
            setActiveTab("contacts");
          }}
          onOpenPipeline={() => setActiveTab("pipeline")}
          onPlanAppointment={() => setActiveTab("agenda")}
        />
      );
    }

    return (
      <CrmRivieraOverview
        metrics={overviewMetrics}
        priorities={priorities}
        tasks={pipelineTasks}
        onPriorityAction={onPriorityAction}
        onOpenPipeline={() => setActiveTab("pipeline")}
        onOpenContacts={() => setActiveTab("contacts")}
        onOpenProperties={() => setActiveTab("properties")}
        onOpenEstimations={() => setActiveTab("estimations")}
        onCreateContact={onCreateContact}
        overview={overview}
      />
    );
  }

  const pipelineMax = Math.max(
    metrics.contactsToQualify,
    metrics.contactsReadyForPipeline,
    metrics.newLeads,
    metrics.contactedLeads,
    metrics.appointments,
    metrics.mandateSigned,
    metrics.lostLeads,
    1
  );
  const propertyMax = Math.max(metrics.availableProperties, metrics.underOfferProperties, metrics.soldProperties, metrics.featuredProperties, 1);
  const priorityItems = [
    {
      label: "Contacts à qualifier",
      value: metrics.contactsToQualify,
      description: "Rôle et potentiel commercial à confirmer.",
      action: () => setActiveTab("contacts"),
    },
    {
      label: "Prêts pour le pipeline",
      value: metrics.contactsReadyForPipeline,
      description: "Contacts qualifiés à transformer en prospects.",
      action: () => setActiveTab("contacts"),
    },
    {
      label: "Sans moyen de contact",
      value: metrics.contactsWithoutMethod,
      description: "Coordonnées à retrouver ou dossier à classer.",
      action: () => setActiveTab("contacts"),
    },
    {
      label: "Nouveaux leads",
      value: metrics.newLeads,
      description: "A qualifier en priorite.",
      action: () => setActiveTab("pipeline"),
    },
    {
      label: "Biens sans photos",
      value: metrics.propertiesWithoutPhotos,
      description: "A completer avant mise en avant.",
      action: () => setActiveTab("properties"),
    },
    {
      label: "Diagnostics incomplets",
      value: metrics.propertiesWithoutDiagnostics,
      description: "DPE/GES a verifier.",
      action: () => setActiveTab("properties"),
    },
  ];
  const activePriorityItems = priorityItems.filter((item) => item.value > 0);

  return (
    <BentoGrid>
      <BentoCard
        span="wide"
        variant="highlight"
        eyebrow="Aujourd'hui"
        title="À traiter aujourd'hui"
        description="Les actions opérationnelles les plus utiles, classées avant les statistiques secondaires."
        action={
          <Button type="button" size="sm" className="hidden bg-orange-500 text-white hover:bg-orange-600 sm:inline-flex" onClick={() => setActiveTab("pipeline")}>
            Traiter les leads
          </Button>
        }
      >
        {activePriorityItems.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activePriorityItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="rounded-lg border border-[#e8d4b7] bg-white p-4 text-left transition-colors hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 motion-reduce:transition-none"
              >
                <span className="text-sm font-semibold text-gray-600">{item.label}</span>
                <span className="mt-2 block text-3xl font-black text-orange-600">{item.value}</span>
                <span className="mt-2 block text-xs leading-5 text-gray-500">{item.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <BentoEmptyState
            title="Aucune priorite bloquante"
            description="Qualifications, conversions, nouveaux leads et qualité des biens sont sous contrôle."
          />
        )}
      </BentoCard>

      <BentoCard span="medium" title="Leads urgents" description="Demandes non traitees ou a recontacter.">
        <MetricLine label="Contacts à qualifier" value={metrics.contactsToQualify} max={pipelineMax} />
        <MetricLine label="Prêts pour le pipeline" value={metrics.contactsReadyForPipeline} max={pipelineMax} />
        <MetricLine label="Nouveaux" value={metrics.newLeads} max={pipelineMax} />
        <MetricLine label="Contactes" value={metrics.contactedLeads} max={pipelineMax} />
        <MetricLine label="Rendez-vous" value={metrics.appointments} max={pipelineMax} />
        {metrics.newLeads === 0 ? (
          <BentoEmptyState title="Aucun lead urgent" description="Aucune demande nouvelle non traitee." />
        ) : null}
      </BentoCard>

      <BentoCard span="medium" title="Agenda" description="Visites et rendez-vous du jour.">
        <Button variant="outline" onClick={() => setActiveTab("agenda")}>Ouvrir l’agenda</Button>
      </BentoCard>

      <BentoCard span="medium" title="Mandats" description="Suivi des echeances commerciales.">
        <BentoEmptyState title="Mandats a connecter" description="Les mandats seront suivis dans la phase transactions." />
      </BentoCard>

      <BentoCard span="large" title="Dernieres demandes" description="Les derniers prospects actifs a garder sous les yeux.">
        {metrics.latestLeads.length ? (
          metrics.latestLeads.map((lead) => <LeadPreview key={`${lead.kind}-${lead.id}`} lead={lead} />)
        ) : (
          <BentoEmptyState title="Aucune demande active" description="Les prochaines demandes apparaitront ici automatiquement." />
        )}
      </BentoCard>

      <BentoCard span="wide" title="Pipeline commercial" description="Progression des prospects actifs vers le mandat.">
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard label="Leads actifs" value={metrics.totalLeads} />
          <KpiCard label="Mandats signes" value={metrics.mandateSigned} tone="orange" />
        </div>
        <MetricLine label="Nouveaux" value={metrics.newLeads} max={pipelineMax} />
        <MetricLine label="Contactes" value={metrics.contactedLeads} max={pipelineMax} />
        <MetricLine label="Rendez-vous" value={metrics.appointments} max={pipelineMax} />
        <MetricLine label="Mandats signes" value={metrics.mandateSigned} max={pipelineMax} />
      </BentoCard>

      <BentoCard span="medium" title="Résumé de performance" description="Lecture secondaire de l'activité commerciale.">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Leads actifs" value={metrics.totalLeads} />
          <KpiCard label="Conversion" value={formatPercentage(metrics.conversionRate)} tone="orange" />
        </div>
        <MetricLine label="Dernière demande" value={formatDateTime(metrics.latestSubmissionDate)} />
        <MetricLine label="Dernière activité" value={formatDateTime(metrics.latestActivityDate)} />
      </BentoCard>

      <BentoCard span="medium" title="Sources de leads" description="Origine des demandes actuellement structurees.">
        <MetricLine label="Formulaire contact" value={metrics.contactSubmissions} />
        <MetricLine label="Formulaire estimation" value={metrics.estimationSubmissions} />
        <MetricLine label="Appel direct" value="A structurer" />
        <MetricLine label="Agence" value="A structurer" />
      </BentoCard>

      <BentoCard span="large" title="Portefeuille de biens" description="Disponibilite, exposition et qualite du catalogue.">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Biens" value={metrics.totalProperties} />
          <KpiCard label="Prix moyen" value={formatPrice(Math.round(metrics.averagePrice))} tone="orange" />
        </div>
        <MetricLine label="Disponibles" value={metrics.availableProperties} max={propertyMax} />
        <MetricLine label="Sous offre" value={metrics.underOfferProperties} max={propertyMax} />
        <MetricLine label="Vendus" value={metrics.soldProperties} max={propertyMax} />
        <MetricLine label="A la une" value={metrics.featuredProperties} max={propertyMax} />
      </BentoCard>

      <BentoCard span="large" title="Activite recente" description="Derniers mouvements enregistres dans le CRM.">
        {metrics.latestActivities.length ? (
          metrics.latestActivities.map((activity) => <ActivityPreview key={activity.id} activity={activity} />)
        ) : (
          <BentoEmptyState title="Aucune activite recente" description="Les prochaines actions CRM apparaitront ici." />
        )}
      </BentoCard>

      <BentoCard span="full" variant="muted" title="Statistiques secondaires" description="Ces indicateurs restent utiles, mais ne doivent pas prendre le dessus sur les actions du jour.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricLine label="Biens sans photos" value={metrics.propertiesWithoutPhotos} />
          <MetricLine label="Biens sans DPE/GES" value={metrics.propertiesWithoutDiagnostics} />
          <MetricLine label="Biens non mis a la une" value={metrics.propertiesNotFeatured} />
          <MetricLine label="GA4" value="A connecter" />
        </div>
      </BentoCard>
    </BentoGrid>
  );
}

function ActivityPanel({
  activities,
  filteredActivities,
  recipeActivitiesCount,
  activitySearch,
  setActivitySearch,
  activityEntityType,
  setActivityEntityType,
  activityAction,
  setActivityAction,
  activityPeriod,
  setActivityPeriod,
  activityVisibility,
  setActivityVisibility,
}: {
  activities: Activity[];
  filteredActivities: Activity[];
  recipeActivitiesCount: number;
  activitySearch: string;
  setActivitySearch: React.Dispatch<React.SetStateAction<string>>;
  activityEntityType: ActivityEntityTypeFilter;
  setActivityEntityType: React.Dispatch<React.SetStateAction<ActivityEntityTypeFilter>>;
  activityAction: ActivityActionFilter;
  setActivityAction: React.Dispatch<React.SetStateAction<ActivityActionFilter>>;
  activityPeriod: ActivityPeriodFilter;
  setActivityPeriod: React.Dispatch<React.SetStateAction<ActivityPeriodFilter>>;
  activityVisibility: ActivityVisibilityFilter;
  setActivityVisibility: React.Dispatch<React.SetStateAction<ActivityVisibilityFilter>>;
}) {
  return (
    <BentoCard
      span="full"
      title="Journal d'activité"
      description="Recherche, filtres et lecture rapide des actions CRM."
      contentClassName="gap-5"
    >
        <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_180px_190px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-gray-400" />
            <Input
              value={activitySearch}
              onChange={(event) => setActivitySearch(event.target.value)}
              placeholder="Rechercher une action, un type, un utilisateur ou une date"
              className="pl-9"
            />
          </div>
          <Select value={activityEntityType} onValueChange={(value) => setActivityEntityType((value ?? "ALL") as ActivityEntityTypeFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(activityEntityTypeLabels) as ActivityEntityTypeFilter[]).map((value) => (
                <SelectItem key={value} value={value}>{activityEntityTypeLabels[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={activityAction} onValueChange={(value) => setActivityAction((value ?? "ALL") as ActivityActionFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(activityActionLabels) as ActivityActionFilter[]).map((value) => (
                <SelectItem key={value} value={value}>{activityActionLabels[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={activityPeriod} onValueChange={(value) => setActivityPeriod((value ?? "ALL") as ActivityPeriodFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(activityPeriodLabels) as ActivityPeriodFilter[]).map((value) => (
                <SelectItem key={value} value={value}>{activityPeriodLabels[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={activityVisibility} onValueChange={(value) => setActivityVisibility((value ?? "business") as ActivityVisibilityFilter)}>
            <SelectTrigger><SelectValue>{activityVisibilityLabels[activityVisibility]}</SelectValue></SelectTrigger>
            <SelectContent>
              {(Object.keys(activityVisibilityLabels) as ActivityVisibilityFilter[]).map((value) => (
                <SelectItem key={value} value={value}>{activityVisibilityLabels[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-0 bg-orange-100 text-orange-800">
            {filteredActivities.length} résultat{filteredActivities.length > 1 ? "s" : ""}
          </Badge>
          <span className="text-sm text-gray-500">sur {activities.length} activité{activities.length > 1 ? "s" : ""}</span>
          {activityVisibility === "business" && recipeActivitiesCount > 0 ? (
            <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">
              {recipeActivitiesCount} trace{recipeActivitiesCount > 1 ? "s" : ""} de recette masquée{recipeActivitiesCount > 1 ? "s" : ""}
            </Badge>
          ) : null}
        </div>

        {filteredActivities.length ? (
          <div className="grid gap-3">
            {filteredActivities.map((activity) => (
              <div key={activity.id} className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#111111]">{activity.action}</p>
                    <p className="mt-1 text-xs text-gray-500">{activity.user_name} · {formatDateTime(activity.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">
                      {activityEntityTypeLabels[getActivityEntityBucket(activity.entity_type)]}
                    </Badge>
                    <Badge variant="outline" className="border-orange-200 bg-white text-gray-700">
                      {activityActionLabels[getActivityActionBucket(activity.action)]}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <BentoEmptyState
            icon={<ListChecks className="size-5" />}
            title="Aucune activité ne correspond à votre recherche."
            description="Ajustez la recherche, le type, l'action ou la période."
            className="py-12"
          />
        )}
    </BentoCard>
  );
}

type Props = {
  contacts: ContactLead[];
  estimations: EstimationLead[];
  activities: Activity[];
  properties: Property[];
  connected: boolean;
  userName: string;
  agencyName?: string;
  userRole: AdminRole;
  initialTab?: AdminTab;
  initialContactId?: string | null;
  initialPropertyId?: string | null;
  canWriteProperties?: boolean;
  initialSearch?: string;
};

function normalizeContacts(items: ContactLead[]): AdminLead[] {
  return items.map((lead) => ({
    id: lead.id,
    kind: "contacts",
    createdAt: lead.created_at,
    name: lead.name,
    email: lead.email,
    phone: lead.phone ?? "Non renseigné",
    category: lead.request_type,
    city: lead.city ?? "Non renseignée",
    message: lead.message,
    status: lead.status,
    notes: lead.notes ?? "",
    archived: lead.archived,
    contactRole: lead.contact_role ?? deriveContactRole(lead.request_type),
    qualificationStatus:
      lead.qualification_status ??
      (hasUsableContactMethod(lead.email, lead.phone) ? "TO_REVIEW" : "NO_CONTACT"),
    qualificationSource: lead.qualification_source ?? "AUTO",
    activeProspect:
      lead.active_prospect ??
      (!lead.archived && lead.status !== "LOST" && hasUsableContactMethod(lead.email, lead.phone)),
    qualifiedAt: lead.qualified_at ?? null,
    pipelineLeadId: lead.pipeline_lead_id ?? null,
    assignedTo: lead.assigned_to ?? null,
    address: lead.address ?? "",
    postalCode: lead.postal_code ?? "",
    contactPreference: lead.contact_preference ?? "",
    personalSituation: lead.personal_situation ?? "",
    profession: lead.profession ?? "",
    currentResidence: lead.current_residence ?? "",
    interestScore: lead.interest_score ?? null,
    estimatedBudget: lead.estimated_budget ?? null,
    priority: lead.priority ?? "normal",
    contactSource: lead.contact_source ?? "LEGACY_IMPORT",
    lastContactedAt: lead.last_contacted_at ?? null,
    normalizedEmail: lead.normalized_email ?? null,
    normalizedPhone: lead.normalized_phone ?? null,
    canonicalContactId: lead.canonical_contact_id ?? null,
    dedupeStatus: lead.dedupe_status ?? "UNREVIEWED",
  }));
}

function normalizeEstimations(items: EstimationLead[]): AdminLead[] {
  return items.map((lead) => ({
    id: lead.id,
    kind: "estimations",
    createdAt: lead.created_at,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    category: `${lead.property_type} · ${lead.surface} m²`,
    city: `${lead.city}${lead.postal_code ? ` (${lead.postal_code})` : ""}`,
    message: lead.message ?? "Aucun détail complémentaire.",
    status: lead.status,
    notes: lead.notes ?? "",
    archived: lead.archived,
    contactRole: null,
    qualificationStatus: null,
    qualificationSource: null,
    activeProspect: false,
    qualifiedAt: null,
    pipelineLeadId: null,
    assignedTo: null,
    address: "",
    postalCode: lead.postal_code ?? "",
    contactPreference: "",
    personalSituation: "",
    profession: "",
    currentResidence: "",
    interestScore: null,
    estimatedBudget: null,
    priority: "normal",
    contactSource: "ESTIMATION_FORM",
    lastContactedAt: null,
    normalizedEmail: null,
    normalizedPhone: null,
    canonicalContactId: null,
    dedupeStatus: "UNREVIEWED",
  }));
}

function CreateContactCard({
  setLeads,
  connected,
  open,
  onOpenChange,
  onCreated,
  team,
}: {
  setLeads: React.Dispatch<React.SetStateAction<AdminLead[]>>;
  connected: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  team: AdminTeamMember[];
}) {
  const [form, setForm] = useState<ContactFormState>(emptyContactForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function updateField(field: keyof ContactFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function createLocalLead() {
    const now = new Date().toISOString();
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `local-contact-${Date.now()}`;

    setLeads((current) => [
      {
        id,
        kind: "contacts",
        createdAt: now,
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || "Non renseigné",
        category: form.requestType,
        city: form.city.trim() || "Non renseignée",
        message: form.message.trim(),
        status: "NEW",
        notes: "",
        archived: false,
        contactRole: deriveContactRole(form.requestType),
        qualificationStatus: hasUsableContactMethod(form.email, form.phone) ? "TO_REVIEW" : "NO_CONTACT",
        qualificationSource: "AUTO",
        activeProspect: hasUsableContactMethod(form.email, form.phone),
        qualifiedAt: null,
        pipelineLeadId: null,
        assignedTo: form.assignedTo === "UNASSIGNED" ? null : form.assignedTo,
        address: "",
        postalCode: "",
        contactPreference: "",
        personalSituation: "",
        profession: "",
        currentResidence: "",
        interestScore: null,
        estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) : null,
        priority: "normal",
        contactSource: form.source,
        lastContactedAt: null,
        normalizedEmail: form.email.trim().toLowerCase() || null,
        normalizedPhone: form.phone.replace(/\D/g, "") || null,
        canonicalContactId: null,
        dedupeStatus: "UNREVIEWED",
      },
      ...current,
    ]);
  }

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!form.lastName.trim() || !form.phone.trim() || !form.message.trim()) {
      setFeedback({
        type: "error",
        message: "Nom, téléphone et description du projet sont nécessaires pour créer un contact.",
      });
      return;
    }

    if (!connected) {
      createLocalLead();
      setForm(emptyContactForm);
      setFeedback({ type: "success", message: "Contact créé dans cette session locale." });
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/admin/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as {
          message?: string;
          contact?: ContactLead;
        } | null)
      : null;
    setSubmitting(false);

    if (!response?.ok || !payload?.contact) {
      setFeedback({
        type: "error",
        message: payload?.message ?? "Le contact n'a pas pu être créé.",
      });
      return;
    }

    setLeads((current) => [normalizeContacts([payload.contact!])[0], ...current]);
    setForm(emptyContactForm);
    setFeedback({ type: "success", message: payload.message ?? "Contact créé." });
    onOpenChange(false);
    onCreated(payload.contact.id);
  }

  return (
    <BentoCard
      id="crm-create-contact"
      span="full"
      title="Nouveau contact"
      description="Ajoutez les coordonnées et le projet immobilier du contact."
      action={
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)]"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" /> Annuler
        </Button>
      }
    >
      {feedback ? (
        <p
          className={
            feedback.type === "success"
              ? "rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-800"
              : "rounded-md bg-red-50 p-3 text-sm font-medium text-red-700"
          }
        >
          {feedback.message}
        </p>
      ) : null}
      {open ? (
        <form id="crm-create-contact-form" onSubmit={(event) => void submitContact(event)} className="grid gap-6">
          <section className="grid gap-5 rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-4 sm:p-6">
            <div><h3 className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Coordonnées</h3><p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">Informations nécessaires pour joindre le contact.</p></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="contact-first-name">Prénom</Label>
                <Input id="contact-first-name" value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} placeholder="Camille" className="h-11 rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-last-name">Nom *</Label>
                <Input id="contact-last-name" value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} placeholder="Martin" required className="h-11 rounded-xl" />
              </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="prospect@email.fr"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-phone">Téléphone</Label>
              <Input
                id="contact-phone"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="06 00 00 00 00"
                className="h-11 rounded-xl"
              />
            </div>
            </div>
          </section>
          <section className="grid gap-5 rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-4 sm:p-6">
            <div><h3 className="text-lg font-semibold text-[var(--crm-riviera-text-primary)]">Projet immobilier</h3><p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">Demande initiale, secteur et informations utiles.</p></div>
            <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Type de demande</Label>
              <Select
                value={form.requestType}
                onValueChange={(value) =>
                  updateField("requestType", value as ContactFormState["requestType"])
                }
              >
                <SelectTrigger className="h-11 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contactRequestTypes.map((requestType) => (
                    <SelectItem key={requestType} value={requestType}>
                      {requestType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-city">Ville concernée</Label>
              <Input
                id="contact-city"
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="Solliès-Pont, Toulon, Hyères..."
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-budget">Budget estimé</Label>
              <Input
                id="contact-budget"
                type="number"
                min="0"
                step="1000"
                value={form.estimatedBudget}
                onChange={(event) => updateField("estimatedBudget", event.target.value)}
                placeholder="450000"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(value) => value && updateField("source", value)}>
                <SelectTrigger className="h-11 w-full rounded-xl" aria-label="Source du contact"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENCY">Agence</SelectItem>
                  <SelectItem value="WEBSITE">Site web</SelectItem>
                  <SelectItem value="REFERRAL">Recommandation</SelectItem>
                  <SelectItem value="PORTAL">Portail immobilier</SelectItem>
                  <SelectItem value="SOCIAL">Réseaux sociaux</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Vendeur responsable</Label>
              <Select value={form.assignedTo} onValueChange={(value) => value && updateField("assignedTo", value)}>
                <SelectTrigger className="h-11 w-full rounded-xl" aria-label="Vendeur responsable"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNASSIGNED">Non attribué</SelectItem>
                  {team.filter((member) => member.isActive).map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.fullName ?? member.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-message">Description du projet</Label>
            <Textarea
              id="contact-message"
              value={form.message}
              onChange={(event) => updateField("message", event.target.value)}
              placeholder="Besoin exprimé, budget, délai, informations utiles..."
              className="min-h-32 rounded-xl"
            />
          </div>
          </section>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 rounded-xl border-[var(--crm-riviera-border-default)]" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={submitting} className="h-11 rounded-xl bg-[var(--crm-riviera-bg-action)] px-5 text-white hover:bg-[var(--crm-riviera-bg-header)]"><ContactRound className="size-4" />{submitting ? "Enregistrement…" : "Enregistrer le contact"}</Button>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-accent)] p-4 text-sm leading-6 text-[var(--crm-riviera-text-secondary)]">
          Le formulaire est replié pour garder la vue Contacts lisible. Cliquez sur Créer pour ajouter un contact manuellement.
        </div>
      )}
    </BentoCard>
  );
}

function PropertyEditorCard({
  property,
  connected,
  onPersist,
  onCreateOffer,
  canCreateOffers,
  displayMode,
  initiallyEditing = false,
}: {
  property: Property;
  connected: boolean;
  onPersist: (property: Property) => Promise<boolean>;
  onCreateOffer: (property: Property) => void;
  canCreateOffers: boolean;
  displayMode: PropertyDisplayMode;
  initiallyEditing?: boolean;
}) {
  const [editing, setEditing] = useState(initiallyEditing);
  const [form, setForm] = useState<PropertyFormState>(() => propertyToForm(property));
  const [photoOrder, setPhotoOrder] = useState<string[]>(() => property.photos);
  const [removedPhotoUrls, setRemovedPhotoUrls] = useState<string[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const isLand = form.type === "land";
  const mainPhoto = property.photos[0] ?? null;
  const qualityIssues = getPropertyQualityIssues(property);
  const isQualityReady = qualityIssues.length === 0;

  function updateField(field: keyof PropertyFormState, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePropertyType(value: PropertyType) {
    setForm((current) => ({
      ...current,
      type: value,
      ...(value === "land"
        ? {
            landSurface: "",
            rooms: "",
            bedrooms: "",
            bathrooms: "",
            energyClass: "",
            climateClass: "",
          }
        : {
            landOptions: [],
          }),
    }));
  }

  function toggleLandOption(option: string) {
    setForm((current) => ({
      ...current,
      landOptions: current.landOptions.includes(option)
        ? current.landOptions.filter((item) => item !== option)
        : [...current.landOptions, option],
    }));
  }

  function resetEditor() {
    setForm(propertyToForm(property));
    setPhotoOrder(property.photos);
    setRemovedPhotoUrls([]);
    setSelectedPhotos([]);
    setPhotoInputKey((current) => current + 1);
    setFeedback(null);
    setEditing(false);
  }

  function movePhoto(index: number, direction: -1 | 1) {
    setPhotoOrder((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const [photo] = next.splice(index, 1);
      next.splice(nextIndex, 0, photo);
      return next;
    });
  }

  function setMainPhoto(index: number) {
    setPhotoOrder((current) => {
      if (index <= 0 || index >= current.length) return current;

      const next = [...current];
      const [photo] = next.splice(index, 1);
      return [photo, ...next];
    });
  }

  function removePhoto(photoUrl: string) {
    setPhotoOrder((current) => current.filter((photo) => photo !== photoUrl));
    setRemovedPhotoUrls((current) => (
      current.includes(photoUrl) ? current : [...current, photoUrl]
    ));
  }

  async function uploadAdditionalPhotos() {
    if (selectedPhotos.length === 0) return photoOrder;

    if (!connected) {
      setFeedback("Le stockage Supabase doit être connecté pour ajouter des photos.");
      return null;
    }

    const uploadBody = new FormData();
    selectedPhotos.forEach((file) => uploadBody.append("photos", file));
    const response = await fetch("/api/admin/property-photos", {
      method: "POST",
      body: uploadBody,
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as {
          message?: string;
          photos?: UploadedPropertyPhoto[];
        } | null)
      : null;

    if (!response?.ok || !payload?.photos) {
      setFeedback(payload?.message ?? "Les nouvelles photos n'ont pas pu être envoyées.");
      return null;
    }

    return [...photoOrder, ...payload.photos.map((photo) => photo.url)];
  }

  async function deleteRemovedPhotos(savedPhotoUrls: string[]) {
    const urlsToDelete = Array.from(
      new Set(removedPhotoUrls.filter((photoUrl) => !savedPhotoUrls.includes(photoUrl)))
    );

    if (urlsToDelete.length === 0 || !connected) return true;

    const response = await fetch("/api/admin/property-photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: urlsToDelete }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;

    if (!response?.ok) {
      setFeedback(payload?.message ?? "Le bien est enregistré, mais les photos supprimées n'ont pas pu être retirées du stockage.");
      return false;
    }

    return true;
  }

  async function saveEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!form.title.trim() || !form.city.trim() || !form.postalCode.trim() || !form.price.trim() || !form.surface.trim()) {
      setFeedback("Titre, ville, code postal, prix et surface sont obligatoires.");
      return;
    }

    setSaving(true);
    const photoUrls = await uploadAdditionalPhotos();
    if (!photoUrls) {
      setSaving(false);
      return;
    }

    const updatedProperty = buildUpdatedProperty(property, form, photoUrls);
    const saved = await onPersist(updatedProperty);

    if (!saved) {
      setSaving(false);
      return;
    }

    const deletedFromStorage = await deleteRemovedPhotos(photoUrls);
    setSaving(false);

    if (!deletedFromStorage) return;

    setRemovedPhotoUrls([]);
    setSelectedPhotos([]);
    setPhotoInputKey((current) => current + 1);
    setEditing(false);
  }

  async function quickUpdate(updates: Partial<Pick<Property, "status" | "featured" | "publicationStatus">>) {
    setFeedback(null);
    const nextProperty = { ...property, ...updates };
    await onPersist(nextProperty);
  }

  return (
    <Card className={cn("border-orange-100 bg-white", displayMode === "grid" && "overflow-hidden")}>
      {displayMode === "grid" ? (
        <div className="relative aspect-[4/3] bg-orange-50">
          {mainPhoto ? (
            <Image
              src={mainPhoto}
              alt={property.title}
              fill
              sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 95vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-orange-600">
              <ImagePlus className="size-10" />
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <Badge className="border-0 bg-orange-100 text-orange-800">{propertyStatusLabels[property.status]}</Badge>
            <Badge className={cn("w-fit", propertyPublicationStatusBadgeClasses[property.publicationStatus ?? "DRAFT"])}>
              {propertyPublicationStatusLabels[property.publicationStatus ?? "DRAFT"]}
            </Badge>
          </div>
        </div>
      ) : null}
      <CardContent className="grid gap-4 p-4 sm:p-5">
        <div className={cn("flex items-start justify-between gap-4", displayMode === "list" && "sm:grid sm:grid-cols-[96px_1fr_auto]")}>
          {displayMode === "list" ? (
            <div className="relative hidden aspect-[4/3] overflow-hidden rounded-lg border border-orange-100 bg-orange-50 sm:block">
              {mainPhoto ? (
                <Image
                  src={mainPhoto}
                  alt={property.title}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-orange-600">
                  <ImagePlus className="size-6" />
                </div>
              )}
            </div>
          ) : null}
          <div>
            <p className="font-mono text-xs text-gray-500">Réf. {property.reference} · Mandat {property.mandateNumber}</p>
            <p className="mt-1 font-bold text-[#111111]">{property.title}</p>
            <p className="mt-1 text-sm text-gray-600">{property.city} · {formatNumber(property.surface)} m² · {propertyTypeLabels[property.type]}</p>
          </div>
          <div className={cn("flex-col gap-2 sm:items-end", displayMode === "grid" ? "hidden" : "flex")}>
            <Badge className="border-0 bg-orange-100 text-orange-800">{propertyStatusLabels[property.status]}</Badge>
            <Badge className={cn("w-fit", propertyPublicationStatusBadgeClasses[property.publicationStatus ?? "DRAFT"])}>
              {propertyPublicationStatusLabels[property.publicationStatus ?? "DRAFT"]}
            </Badge>
          </div>
        </div>

        <div className={cn(
          "grid gap-2 text-sm text-gray-700",
          displayMode === "grid" ? "grid-cols-2" : "sm:grid-cols-5"
        )}>
          <p><strong>Prix</strong><br />{formatPrice(property.price)}</p>
          <p><strong>Pièces</strong><br />{property.rooms ?? "Non renseigné"}</p>
          <p><strong>Photos</strong><br />{property.photos.length}</p>
          <p><strong>Publication</strong><br />{propertyPublicationStatusLabels[property.publicationStatus ?? "DRAFT"]}</p>
          <p><strong>Mise en avant</strong><br />{property.featured ? "Oui" : "Non"}</p>
        </div>

        <div
          className={cn(
            "grid gap-3 rounded-lg border border-orange-100 bg-orange-50/60 p-3",
            displayMode === "list" ? "sm:grid-cols-2" : "grid-cols-1"
          )}
        >
          <DiagnosticBar kind="energy" value={property.energyClass} compact />
          <DiagnosticBar kind="climate" value={property.climateClass} compact />
        </div>

        <div className="grid gap-3 rounded-lg border border-orange-100 bg-white p-3 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-[#111111]">Controle qualite affichage site</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Verifie titre, photo principale, prix, statut, publication, DPE/GES et mise en avant.
              </p>
            </div>
            <Badge
              className={cn(
                "w-fit border-0",
                isQualityReady ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"
              )}
            >
              {isQualityReady ? "Pret site" : `${qualityIssues.length} point(s) a corriger`}
            </Badge>
          </div>
          {!isQualityReady ? (
            <div className="flex flex-wrap gap-2">
              {qualityIssues.map((issue) => (
                <Badge key={issue} variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">
                  {issue}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-lg border border-orange-100 bg-orange-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Disponibilité</Label>
              <Select
                value={property.status}
                onValueChange={(value) => void quickUpdate({ status: value as PropertyStatus })}
              >
                <SelectTrigger className="h-12 w-full sm:h-10">
                  <span className="flex flex-1 text-left text-gray-900">
                    {propertyStatusLabels[property.status]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {propertyStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {propertyStatusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Publication</Label>
              <Select
                value={property.publicationStatus ?? "DRAFT"}
                onValueChange={(value) => void quickUpdate({ publicationStatus: value as PropertyPublicationStatus })}
              >
                <SelectTrigger className="h-12 w-full sm:h-10">
                  <span className="flex flex-1 text-left text-gray-900">
                    {propertyPublicationStatusLabels[property.publicationStatus ?? "DRAFT"]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {propertyPublicationStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {propertyPublicationStatusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-orange-100 bg-white px-3 py-2 text-sm font-semibold text-[#111111]">
              <input
                type="checkbox"
                checked={property.featured}
                onChange={(event) => void quickUpdate({ featured: event.target.checked })}
                className="size-4 accent-orange-500"
              />
              Afficher à la une
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              disabled={
                !canCreateOffers ||
                getPropertyOfferIneligibility(property) !== null
              }
              className="h-12 bg-[#2f493a] text-white hover:bg-[#16251e] sm:h-10"
              onClick={() => onCreateOffer(property)}
            >
              <FileSignature className="size-4" />
              Créer une offre
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 border-orange-200 bg-white sm:h-10"
              onClick={() => {
                setForm(propertyToForm(property));
                setPhotoOrder(property.photos);
                setRemovedPhotoUrls([]);
                setEditing((current) => !current);
              }}
            >
              {editing ? <X className="size-4" /> : <Pencil className="size-4" />}
              {editing ? "Fermer" : "Modifier"}
            </Button>
          </div>
        </div>

        {editing ? (
          <form onSubmit={(event) => void saveEditor(event)} className="grid gap-5 rounded-xl border border-orange-100 bg-white p-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid gap-2 lg:col-span-2">
                <Label>Titre</Label>
                <Input value={form.title} onChange={(event) => updateField("title", event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(value) => updatePropertyType(value as PropertyType)}>
                  <SelectTrigger className="h-12 w-full sm:h-10">
                    <span className="flex flex-1 text-left text-gray-900">
                      {propertyTypeLabels[form.type]}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypes.map((type) => (
                      <SelectItem key={type} value={type}>{propertyTypeLabels[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Ville</Label>
                <Input value={form.city} onChange={(event) => updateField("city", event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Code postal</Label>
                <Input value={form.postalCode} onChange={(event) => updateField("postalCode", event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Prix affiché honoraires inclus</Label>
                <Input inputMode="numeric" value={form.price} onChange={(event) => updateField("price", event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>{isLand ? "Surface du terrain" : "Surface habitable"}</Label>
                <Input inputMode="decimal" value={form.surface} onChange={(event) => updateField("surface", event.target.value)} />
              </div>
              {!isLand ? (
                <>
                  <div className="grid gap-2">
                    <Label>Pièces</Label>
                    <Input inputMode="numeric" value={form.rooms} onChange={(event) => updateField("rooms", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Chambres</Label>
                    <Input inputMode="numeric" value={form.bedrooms} onChange={(event) => updateField("bedrooms", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Salles d&apos;eau</Label>
                    <Input inputMode="numeric" value={form.bathrooms} onChange={(event) => updateField("bathrooms", event.target.value)} />
                  </div>
                </>
              ) : null}
            </div>

            {isLand ? (
              <div className="grid gap-2 rounded-lg border border-orange-100 bg-orange-50 p-3 sm:grid-cols-2">
                {landSaleOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => toggleLandOption(option.label)}
                    className={cn(
                      "rounded-md border p-3 text-left text-sm transition",
                      form.landOptions.includes(option.label)
                        ? "border-orange-300 bg-white text-[#111111]"
                        : "border-orange-100 bg-white/70 text-gray-700"
                    )}
                  >
                    <strong>{option.label}</strong>
                    <span className="mt-1 block text-xs leading-5 text-gray-500">{option.description}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <Label>Description courte</Label>
                <Textarea value={form.descriptionShort} onChange={(event) => updateField("descriptionShort", event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Description complète</Label>
                <Textarea value={form.descriptionLong} onChange={(event) => updateField("descriptionLong", event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Atouts libres</Label>
                <Textarea value={form.featuresText} onChange={(event) => updateField("featuresText", event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Ajouter des photos</Label>
                <Input
                  key={photoInputKey}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(event) => setSelectedPhotos(Array.from(event.target.files ?? []))}
                  className="h-auto cursor-pointer py-2"
                />
                <p className="text-xs text-gray-500">
                  Les nouvelles photos seront ajoutées aux {photoOrder.length} photo(s) conservée(s).
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-orange-100 bg-orange-50 p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#111111]">Galerie du bien</p>
                  <p className="text-xs leading-5 text-gray-600">
                    La première photo devient automatiquement la photo principale du site.
                  </p>
                </div>
                <Badge className="w-fit border-0 bg-white text-gray-700">
                  {photoOrder.length} photo(s)
                </Badge>
              </div>

              {removedPhotoUrls.length > 0 ? (
                <p className="rounded-md border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-700">
                  {removedPhotoUrls.length} photo(s) en attente de suppression définitive après sauvegarde.
                </p>
              ) : null}

              {photoOrder.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {photoOrder.map((photo, index) => (
                    <div key={photo} className="overflow-hidden rounded-lg border border-orange-100 bg-white">
                      <div className="relative aspect-[4/3] bg-orange-100">
                        <Image
                          src={photo}
                          alt={`${property.title} - photo ${index + 1}`}
                          fill
                          sizes="(min-width: 1280px) 220px, (min-width: 640px) 45vw, 90vw"
                          className="object-cover"
                        />
                        {index === 0 ? (
                          <Badge className="absolute left-2 top-2 border-0 bg-orange-500 text-white">
                            Photo principale
                          </Badge>
                        ) : null}
                      </div>
                      <div className="grid gap-2 p-3">
                        <p className="truncate font-mono text-[11px] text-gray-500">
                          Position {index + 1}
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={index === 0}
                            title="Monter la photo"
                            onClick={() => movePhoto(index, -1)}
                            className="size-11 border-orange-200 sm:size-9"
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={index === photoOrder.length - 1}
                            title="Descendre la photo"
                            onClick={() => movePhoto(index, 1)}
                            className="size-11 border-orange-200 sm:size-9"
                          >
                            <ArrowDown className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={index === 0}
                            title="Définir comme photo principale"
                            onClick={() => setMainPhoto(index)}
                            className="size-11 border-orange-200 sm:size-9"
                          >
                            <Star className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Supprimer cette photo de la fiche et du stockage après sauvegarde"
                            onClick={() => removePhoto(photo)}
                            className="size-11 border-red-200 text-red-600 hover:bg-red-50 sm:size-9"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-orange-200 bg-white p-6 text-center">
                  <ImagePlus className="mx-auto size-8 text-orange-500" />
                  <p className="mt-2 text-sm font-semibold text-[#111111]">Aucune photo conservée</p>
                  <p className="mt-1 text-xs text-gray-500">Ajoutez au moins une photo pour une fiche plus attractive.</p>
                </div>
              )}
            </div>

            {feedback ? <p className="rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">{feedback}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={saving} className="h-12 bg-orange-500 text-white hover:bg-orange-600 sm:h-10">
                <Save className="size-4" />
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
              <Button type="button" variant="outline" className="h-12 border-orange-200 sm:h-10" onClick={resetEditor}>
                Annuler
              </Button>
            </div>
          </form>
        ) : null}

        {property.photos.length > 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-orange-50 p-3 text-xs text-gray-700">
            <ImagePlus className="size-4 text-orange-600" />
            Photo principale : {property.photos[0]}
          </div>
        ) : null}
        {property.history?.length ? (
          <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Historique recent</p>
            <div className="mt-2 grid gap-2">
              {property.history.slice(0, 4).map((item) => (
                <p key={item.id} className="text-xs leading-5 text-gray-700">
                  <strong>{item.action}</strong> - {new Date(item.createdAt).toLocaleString("fr-FR")}
                  {item.actorEmail ? ` - ${item.actorEmail}` : ""}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        {property.sourceUrl ? (
          <a href={property.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-orange-700 hover:text-orange-900">
            Voir l&apos;annonce source
          </a>
        ) : (
          <p className="text-sm font-semibold text-orange-700">Bien créé dans le CRM</p>
        )}
      </CardContent>
    </Card>
  );
}

type PipelineTaskDraft = {
  title: string;
  dueAt: string;
  priority: LeadPriority;
  recurrenceRule: TaskRecurrenceRule;
  reminderChannel: TaskReminderChannel;
};

const emptyPipelineTaskDraft: PipelineTaskDraft = {
  title: "",
  dueAt: "",
  priority: "normal",
  recurrenceRule: "NONE",
  reminderChannel: "NONE",
};

function PipelinePanel({
  leads,
  setLeads,
  tasks,
  setTasks,
  offers,
  team,
  metrics,
  permissions,
  connected,
  error,
  onRefresh,
  onCreateOffer,
}: {
  leads: PipelineLead[];
  setLeads: React.Dispatch<React.SetStateAction<PipelineLead[]>>;
  tasks: PipelineTask[];
  setTasks: React.Dispatch<React.SetStateAction<PipelineTask[]>>;
  offers: CommercialOffer[];
  team: AdminTeamMember[];
  metrics: PipelineMetrics;
  permissions: PipelinePermissions;
  connected: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onCreateOffer: (lead: PipelineLead) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [assignee, setAssignee] = useState("ALL");
  const [feedback, setFeedback] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedPipelineLeadId, setSelectedPipelineLeadId] = useState<string | null>(null);
  const router = useRouter();
  const [reminderComposerOpen, setReminderComposerOpen] = useState(false);
  const [reminderLeadId, setReminderLeadId] = useState<string | null>(null);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, PipelineTaskDraft>>({});
  const teamById = useMemo(() => new Map(team.map((member) => [member.id, member])), [team]);
  const leadsById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const tasksByLead = useMemo(() => groupTasksByLead(tasks), [tasks]);
  const activeLeads = leads.filter((lead) => !lead.archived && lead.status !== "LOST");
  const openTasks = tasks.filter(isOpenTask);
  const overdueTasks = sortTasksByUrgency(openTasks.filter(isTaskOverdue));
  const todayTasks = sortTasksByUrgency(openTasks.filter(isTaskDueToday));
  const weeklyTasks = sortTasksByUrgency(openTasks.filter(isTaskDueThisWeek));
  const weeklyTaskGroups = buildWeeklyTaskGroups(weeklyTasks, leadsById);
  const todayRemainingTasks = todayTasks.filter((task) => !isTaskOverdue(task));
  const recurringTasks = sortTasksByUrgency(openTasks.filter((task) => task.recurrenceRule !== "NONE"));
  const emailPreparedTasks = sortTasksByUrgency(
    openTasks.filter((task) => task.reminderChannel === "EMAIL" || task.emailReminderEnabled)
  );
  const pendingEmailTasks = emailPreparedTasks.filter((task) => task.emailReminderStatus === "PENDING");
  const failedEmailTasks = emailPreparedTasks.filter((task) => task.emailReminderStatus === "FAILED");
  const unassignedLeads = activeLeads.filter((lead) => !lead.assignedTo);
  const agentStats = buildPipelineAgentStats(activeLeads, openTasks, team);
  const maxAgentWorkload = Math.max(
    ...agentStats.map((stat) => stat.leadCount + stat.openTaskCount),
    1
  );
  const visibleLeads = activeLeads.filter((lead) => {
    const matchesSearch = !search.trim() || matchesPipelineDossierSearch(lead, search);
    const matchesStatus = status === "ALL" || lead.status === status;
    const matchesAssignee =
      assignee === "ALL" ||
      (assignee === "UNASSIGNED" ? !lead.assignedTo : lead.assignedTo === assignee);

    return matchesSearch && matchesStatus && matchesAssignee;
  });
  const dailyTasks = sortTasksByUrgency([...overdueTasks, ...todayRemainingTasks]).slice(0, 8);
  const unassignedPreview = unassignedLeads.slice(0, 6);
  const activePipelineLeads = visibleLeads;
  const toPipelineItem = (lead: PipelineLead): RivieraPipelineLeadItem => ({
    lead,
    nextTask: getLeadNextOpenTask(tasksByLead.get(lead.id) ?? []),
  });
  const pipelineColumns: RivieraPipelineColumn[] = [
    {
      id: "new",
      title: "Nouveaux",
      count: activePipelineLeads.filter((lead) => getPipelineColumnId(lead) === "new").length,
      leads: activePipelineLeads.filter((lead) => getPipelineColumnId(lead) === "new").map(toPipelineItem),
    },
    {
      id: "contacted",
      title: "Contactés",
      count: activePipelineLeads.filter((lead) => getPipelineColumnId(lead) === "contacted").length,
      leads: activePipelineLeads.filter((lead) => getPipelineColumnId(lead) === "contacted").map(toPipelineItem),
    },
    {
      id: "appointment",
      title: "Rendez-vous",
      count: activePipelineLeads.filter((lead) => getPipelineColumnId(lead) === "appointment").length,
      leads: activePipelineLeads.filter((lead) => getPipelineColumnId(lead) === "appointment").map(toPipelineItem),
    },
    {
      id: "offers",
      title: "Offres",
      count: activePipelineLeads.filter((lead) => getPipelineColumnId(lead) === "offers").length,
      leads: activePipelineLeads.filter((lead) => getPipelineColumnId(lead) === "offers").map(toPipelineItem),
    },
  ];
  const dailyTaskRows = dailyTasks.map((task) => ({
    task,
    lead: task.leadId ? leadsById.get(task.leadId) ?? null : null,
  }));
  const selectedPipelineLead = selectedPipelineLeadId
    ? leadsById.get(selectedPipelineLeadId) ?? null
    : null;
  const reminderLead = reminderLeadId
    ? leadsById.get(reminderLeadId) ?? null
    : activePipelineLeads[0] ?? null;
  const selectedPipelineLeadNextTask = selectedPipelineLead
    ? getLeadNextOpenTask(tasksByLead.get(selectedPipelineLead.id) ?? [])
    : null;
  const assignableAgents = team;

  function getDraft(leadId: string) {
    return taskDrafts[leadId] ?? emptyPipelineTaskDraft;
  }

  function updateDraft(leadId: string, updates: Partial<PipelineTaskDraft>) {
    setTaskDrafts((current) => ({
      ...current,
      [leadId]: { ...getDraft(leadId), ...updates },
    }));
  }

  async function persistLead(lead: PipelineLead, updates: Partial<PipelineLead>) {
    const previousLeads = leads;
    setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, ...updates } : item)));

    if (!connected) {
      setFeedback("Modification conservee dans cette session locale.");
      return;
    }

    setPendingId(lead.id);
    const response = await fetch("/api/admin/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-lead",
        id: lead.id,
        status: updates.status,
        priority: updates.priority,
        assignedTo: updates.assignedTo,
        notes: updates.notes,
        archived: updates.archived,
      }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    setPendingId(null);

    if (!response?.ok) {
      setLeads(previousLeads);
      if (response?.status === 401) router.push("/admin/login");
      setFeedback(payload?.message ?? "La mise a jour du pipeline a echoue.");
      return;
    }

    setFeedback(payload?.message ?? "Pipeline mis a jour.");
  }

  async function createTask(lead: PipelineLead) {
    const draft = getDraft(lead.id);
    if (!draft.title.trim()) {
      setFeedback("Ajoute un titre de rappel avant de l'enregistrer.");
      return;
    }

    if (!connected) {
      setFeedback("Rappel conserve dans cette session locale.");
      return;
    }

    setPendingId(`task-${lead.id}`);
    const response = await fetch("/api/admin/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-task",
        leadId: lead.id,
        title: draft.title,
        dueAt: draft.dueAt,
        priority: draft.priority,
        assignedTo: lead.assignedTo,
        recurrenceRule: draft.recurrenceRule,
        reminderChannel: draft.reminderChannel,
      }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    setPendingId(null);

    if (!response?.ok) {
      if (response?.status === 401) router.push("/admin/login");
      setFeedback(payload?.message ?? "Le rappel n'a pas pu etre cree.");
      return;
    }

    setTaskDrafts((current) => ({ ...current, [lead.id]: emptyPipelineTaskDraft }));
    await onRefresh();
    setFeedback(payload?.message ?? "Rappel cree.");
  }

  async function completeTask(task: PipelineTask, completed: boolean) {
    const previousTasks = tasks;
    const now = completed ? new Date().toISOString() : null;
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, completedAt: now } : item))
    );

    if (!connected) {
      setFeedback(completed ? "Rappel coche en local." : "Rappel rouvert en local.");
      return;
    }

    setPendingId(task.id);
    const response = await fetch("/api/admin/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete-task", id: task.id, completed }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    setPendingId(null);

    if (!response?.ok) {
      setTasks(previousTasks);
      if (response?.status === 401) router.push("/admin/login");
      setFeedback(payload?.message ?? "Le rappel n'a pas pu etre mis a jour.");
      return;
    }

    setFeedback(payload?.message ?? "Rappel mis a jour.");
  }

  async function updateOfferStatus(
    offer: CommercialOffer,
    nextStatus: CommercialOfferStatus,
    options?: { reason?: string; confirmPropertyUnderOffer?: boolean }
  ) {
    if (!connected) {
      setFeedback("Supabase doit être connecté pour modifier une offre réelle.");
      return;
    }

    setPendingId(`offer-${offer.id}`);
    const response = await fetch("/api/admin/offers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: offer.id,
        status: nextStatus,
        reason: options?.reason,
        confirmPropertyUnderOffer: options?.confirmPropertyUnderOffer,
      }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    setPendingId(null);

    if (!response?.ok) {
      if (response?.status === 401) router.push("/admin/login");
      setFeedback(payload?.message ?? "Le statut de l'offre n'a pas pu être modifié.");
      return;
    }

    await onRefresh();
    setFeedback(payload?.message ?? "Offre mise à jour.");
  }

  const useRivieraPipeline = true;

  if (useRivieraPipeline) {
    return (
      <>
        <CrmRivieraPipeline
          activeLeads={activePipelineLeads}
          dailyTasks={dailyTaskRows}
          columns={pipelineColumns}
          totalLeads={activePipelineLeads.length}
          metrics={metrics}
          urgentCount={overdueTasks.length}
          team={team}
          assignee={assignee}
          onAssigneeChange={setAssignee}
          onRefresh={() => void onRefresh()}
          onExport={() => {
            exportPipelineCsv(activePipelineLeads, openTasks);
            setFeedback(`${activePipelineLeads.length} dossier${activePipelineLeads.length > 1 ? "s" : ""} exporté${activePipelineLeads.length > 1 ? "s" : ""} au format CSV.`);
          }}
          onOpenLead={(lead) => {
            setSelectedPipelineLeadId(lead.id);
          }}
          onStartReminder={(leadId) => {
            setReminderLeadId(leadId ?? activePipelineLeads[0]?.id ?? null);
            setReminderComposerOpen(true);
          }}
          onCompleteTask={(task) => void completeTask(task, true)}
          pendingId={pendingId}
          error={error}
          feedback={feedback}
        />

        <PipelineDossierDrawer
          lead={selectedPipelineLead}
          open={Boolean(selectedPipelineLead)}
          onOpenChange={(open) => {
            if (!open) setSelectedPipelineLeadId(null);
          }}
          tasks={tasks}
          offers={offers}
          team={team}
          permissions={permissions}
          pending={Boolean(pendingId)}
          onUpdateLead={persistLead}
          onCreateReminder={(leadId) => {
            setSelectedPipelineLeadId(null);
            setReminderLeadId(leadId);
            setReminderComposerOpen(true);
          }}
          onCreateOffer={(lead) => {
            setSelectedPipelineLeadId(null);
            onCreateOffer(lead);
          }}
          onUpdateOfferStatus={updateOfferStatus}
        />

        <PipelineReminderComposer
          open={reminderComposerOpen}
          onOpenChange={setReminderComposerOpen}
          leads={activeLeads}
          team={team}
          initialLeadId={reminderLeadId}
          connected={connected}
          onSaved={onRefresh}
          onFeedback={setFeedback}
        />

        <Sheet
          open={false}
          onOpenChange={(open) => {
            if (!open) setSelectedPipelineLeadId(null);
          }}
        >
          <SheetContent className="w-[min(94vw,32rem)] overflow-y-auto bg-[var(--crm-riviera-bg-surface)] sm:max-w-lg">
            {selectedPipelineLead ? (
              <>
                <SheetHeader>
                  <SheetTitle>{selectedPipelineLead.contactName}</SheetTitle>
                  <SheetDescription>
                    {selectedPipelineLead.requestType} · {selectedPipelineLead.city ?? "Ville non renseignée"}
                  </SheetDescription>
                </SheetHeader>

                <div className="grid gap-5 px-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[var(--crm-riviera-bg-accent)] p-3">
                      <p className="text-xs text-[var(--crm-riviera-text-secondary)]">Étape</p>
                      <p className="mt-1 font-semibold text-[var(--crm-riviera-text-primary)]">
                        {getPipelineLeadStageLabel(selectedPipelineLead)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[var(--crm-riviera-bg-accent)] p-3">
                      <p className="text-xs text-[var(--crm-riviera-text-secondary)]">Priorité</p>
                      <p className="mt-1 font-semibold text-[var(--crm-riviera-text-primary)]">
                        {leadPriorityLabels[selectedPipelineLead.priority]}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Responsable</Label>
                    <Select
                      value={selectedPipelineLead.assignedTo ?? "UNASSIGNED"}
                      onValueChange={(value) =>
                        void persistLead(selectedPipelineLead, {
                          assignedTo: value === "UNASSIGNED" ? null : String(value),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {(value) =>
                            value === "UNASSIGNED"
                              ? "Non attribué"
                              : getTeamMemberLabel(teamById.get(String(value)))}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNASSIGNED">Non attribué</SelectItem>
                        {assignableAgents.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {getTeamMemberLabel(member)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Statut du dossier</Label>
                    <Select
                      value={selectedPipelineLead.status}
                      onValueChange={(value) =>
                        void persistLead(selectedPipelineLead, { status: value as LeadStatus })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{(value) => leadStatusLabels[value as LeadStatus]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {leadStatuses.map((value) => (
                          <SelectItem key={value} value={value}>
                            {leadStatusLabels[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-2xl border border-[var(--crm-riviera-border-default)] p-4">
                    <p className="text-xs font-semibold uppercase text-[var(--crm-riviera-text-secondary)]">
                      Prochaine action
                    </p>
                    <p className="mt-2 font-semibold text-[var(--crm-riviera-text-primary)]">
                      {selectedPipelineLeadNextTask?.title ?? "Aucune action planifiée"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--crm-riviera-text-secondary)]">
                      {getPipelineTaskTimeLabel(selectedPipelineLeadNextTask)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[var(--crm-riviera-border-default)] p-4">
                    <p className="text-xs font-semibold uppercase text-[var(--crm-riviera-text-secondary)]">
                      Bien lié
                    </p>
                    <p className="mt-2 font-semibold text-[var(--crm-riviera-text-primary)]">
                      {selectedPipelineLead.linkedPropertyTitle ?? "Aucun bien lié au dossier"}
                    </p>
                    {selectedPipelineLead.hasActiveOffer ? (
                      <p className="mt-2 text-xs text-[var(--crm-riviera-text-secondary)]">
                        L&apos;offre est rattachée à ce dossier. Sa création et ses conditions seront gérées depuis la fiche du bien.
                      </p>
                    ) : null}
                  </div>
                </div>

                <SheetFooter>
                  <Button
                    type="button"
                    onClick={() => {
                      setSelectedPipelineLeadId(null);
                      setReminderLeadId(selectedPipelineLead.id);
                      setReminderComposerOpen(true);
                    }}
                    className="bg-[var(--crm-riviera-bg-action)] text-white hover:bg-[var(--crm-riviera-bg-header)]"
                  >
                    <Plus className="size-4" />
                    Créer la prochaine action
                  </Button>
                </SheetFooter>
              </>
            ) : null}
          </SheetContent>
        </Sheet>

        <Sheet open={false} onOpenChange={() => undefined}>
          <SheetContent className="w-[min(92vw,28rem)] overflow-y-auto bg-[var(--crm-riviera-bg-surface)] sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Créer un rappel</SheetTitle>
              <SheetDescription>
                Assignez une prochaine action datée à un dossier d&apos;Antoine ou Michel.
              </SheetDescription>
            </SheetHeader>

            {reminderLead ? (
              <div className="grid gap-5 px-4">
                <div className="grid gap-2">
                  <Label>Dossier</Label>
                  <Select value={reminderLead.id} onValueChange={(value) => setReminderLeadId(String(value))}>
                    <SelectTrigger>
                      <SelectValue>{(value) => activeLeads.find((lead) => lead.id === value)?.contactName ?? "Choisir un dossier"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {activeLeads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.contactName} · {lead.assignedToName ?? "Non attribué"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="riviera-reminder-title">Action à réaliser</Label>
                  <Input
                    id="riviera-reminder-title"
                    value={getDraft(reminderLead.id).title}
                    onChange={(event) => updateDraft(reminderLead.id, { title: event.target.value })}
                    placeholder="Appeler pour qualifier le projet"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="riviera-reminder-due">Échéance</Label>
                  <Input
                    id="riviera-reminder-due"
                    type="datetime-local"
                    value={getDraft(reminderLead.id).dueAt}
                    onChange={(event) => updateDraft(reminderLead.id, { dueAt: event.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Priorité</Label>
                  <Select
                    value={getDraft(reminderLead.id).priority}
                    onValueChange={(value) => updateDraft(reminderLead.id, { priority: value as LeadPriority })}
                  >
                    <SelectTrigger>
                      <SelectValue>{(value) => getPrioritySelectLabel(value)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {leadPriorities.map((value) => (
                        <SelectItem key={value} value={value}>
                          {leadPriorityLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <p className="px-4 text-sm text-[var(--crm-riviera-text-secondary)]">
                Aucun dossier actif disponible pour créer un rappel.
              </p>
            )}

            <SheetFooter>
              <Button
                type="button"
                disabled={
                  !reminderLead ||
                  !getDraft(reminderLead.id).title.trim() ||
                  !getDraft(reminderLead.id).dueAt ||
                  pendingId === `task-${reminderLead.id}`
                }
                onClick={() => {
                  if (reminderLead) void createTask(reminderLead);
                }}
                className="bg-[var(--crm-riviera-bg-action)] text-white hover:bg-[var(--crm-riviera-bg-header)]"
              >
                <Plus className="size-4" />
                Enregistrer le rappel
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <BentoGrid>
      <div className="grid gap-4 md:col-span-6 md:grid-cols-2 lg:col-span-12 lg:grid-cols-4">
        <KpiCard label="Leads actifs" value={activeLeads.length} description="Demandes normalisees non archivees." />
        <KpiCard label="A traiter aujourd'hui" value={todayRemainingTasks.length} description="Rappels encore ouverts aujourd'hui." tone="orange" />
        <KpiCard label="En retard" value={overdueTasks.length} description="Rappels passes non termines." tone={overdueTasks.length ? "orange" : "dark"} />
        <KpiCard label="Non assignes" value={unassignedLeads.length} description="Leads sans responsable." />
      </div>

      <BentoCard
        span="wide"
        title="Plan de journée"
        description="Rappels en retard et rappels du jour, classes dans l'ordre de traitement."
        action={
          <Button type="button" variant="outline" size="sm" className="border-orange-200 bg-white" onClick={() => void onRefresh()}>
            Actualiser
          </Button>
        }
      >
        {dailyTasks.length ? (
          <div className="grid gap-3">
            {dailyTasks.map((task) => {
              const lead = task.leadId ? leadsById.get(task.leadId) : null;

              return (
                <article key={task.id} className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm shadow-orange-100/40">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-[#111111]">{task.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{lead?.contactName ?? "Lead non lie"}</p>
                      <p className={cn("mt-2 text-sm font-semibold", getTaskDueTone(task))}>
                        {task.dueAt ? formatDateTime(task.dueAt) : "Sans date"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {task.recurrenceRule !== "NONE" ? (
                          <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">
                            {getTaskRecurrenceLabel(task.recurrenceRule)}
                          </Badge>
                        ) : null}
                        {task.reminderChannel === "EMAIL" ? (
                          <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">
                            Email · {getTaskEmailStatusLabel(task.emailReminderStatus)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "w-fit border-orange-200 bg-white",
                        isTaskOverdue(task) ? "border-red-200 text-red-700" : "text-orange-700"
                      )}
                    >
                      {getTaskDueLabel(task)}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pendingId === task.id}
                      onClick={() => void completeTask(task, true)}
                    >
                      <CheckCircle2 className="size-4" />Terminer
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <BentoEmptyState
            icon={<CalendarClock className="size-5" />}
            title="Aucun rappel urgent"
            description="Les rappels du jour et en retard apparaitront ici."
            className="py-10"
          />
        )}
      </BentoCard>

      <BentoCard
        span="wide"
        title="Vue hebdomadaire"
        description="Rappels ouverts de la semaine, du lundi au dimanche."
      >
        {weeklyTasks.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {weeklyTaskGroups.map((group) => (
              <div key={group.dayKey} className="rounded-xl border border-orange-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-[#111111]">
                    {group.day.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "short" })}
                  </p>
                  <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">
                    {group.tasks.length}
                  </Badge>
                </div>
                {group.tasks.length ? (
                  <div className="mt-3 grid gap-2">
                    {group.tasks.slice(0, 3).map(({ task, lead }) => (
                      <div key={task.id} className="rounded-lg bg-orange-50 p-3 text-sm">
                        <p className="font-semibold text-[#111111]">{task.title}</p>
                        <p className="mt-1 text-gray-600">{lead?.contactName ?? "Lead non lie"}</p>
                        <p className={cn("mt-1 font-semibold", getTaskDueTone(task))}>
                          {task.dueAt ? formatDateTime(task.dueAt) : "Sans date"}
                        </p>
                      </div>
                    ))}
                    {group.tasks.length > 3 ? (
                      <p className="text-xs font-semibold text-orange-700">+ {group.tasks.length - 3} autre(s) rappel(s)</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">Aucun rappel.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <BentoEmptyState
            icon={<CalendarClock className="size-5" />}
            title="Aucun rappel cette semaine"
            description="Les rappels planifies sur les sept prochains jours apparaitront ici."
            className="py-10"
          />
        )}
      </BentoCard>

      <BentoCard span="medium" title="Filtres pipeline" description="Vue simple pour chercher un prospect ou un agent.">
        <div className="grid gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom, ville, telephone, projet"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value ?? "ALL")}>
            <SelectTrigger>
              <SelectValue>{(value) => getStatusSelectLabel(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {leadStatuses.map((value) => (
                <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={(value) => setAssignee(value ?? "ALL")}>
            <SelectTrigger>
              <SelectValue>{(value) => value === "ALL" ? "Tous les agents" : value === "UNASSIGNED" ? "Non assignes" : getTeamMemberLabel(teamById.get(String(value)))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les agents</SelectItem>
              <SelectItem value="UNASSIGNED">Non assignes</SelectItem>
              {team.map((member) => (
                <SelectItem key={member.id} value={member.id}>{getTeamMemberLabel(member)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </BentoCard>

      <BentoCard span="medium" title="Rappels récurrents" description="Suivi des relances qui devront revenir automatiquement.">
        {recurringTasks.length ? (
          <div className="grid gap-3">
            {recurringTasks.slice(0, 5).map((task) => {
              const lead = task.leadId ? leadsById.get(task.leadId) : null;

              return (
                <div key={task.id} className="rounded-xl border border-orange-100 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-0 bg-orange-100 text-orange-800">{getTaskRecurrenceLabel(task.recurrenceRule)}</Badge>
                    {task.reminderChannel === "EMAIL" ? (
                      <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">Email</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 font-bold text-[#111111]">{task.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{lead?.contactName ?? "Lead non lie"}</p>
                  <p className={cn("mt-2 text-sm font-semibold", getTaskDueTone(task))}>
                    {task.dueAt ? formatDateTime(task.dueAt) : "Sans date"}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <BentoEmptyState
            icon={<Clock className="size-5" />}
            title="Aucun rappel récurrent"
            description="Les relances hebdomadaires ou mensuelles apparaitront ici."
            className="py-10"
          />
        )}
      </BentoCard>

      <BentoCard span="medium" title="Notifications email" description="Préparation des relances email, sans envoi automatique pour l'instant.">
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-orange-50 p-3">
              <p className="text-2xl font-black text-[#111111]">{emailPreparedTasks.length}</p>
              <p className="text-xs font-semibold text-gray-500">Préparées</p>
            </div>
            <div className="rounded-lg bg-yellow-50 p-3">
              <p className="text-2xl font-black text-yellow-700">{pendingEmailTasks.length}</p>
              <p className="text-xs font-semibold text-gray-500">À envoyer</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-2xl font-black text-red-700">{failedEmailTasks.length}</p>
              <p className="text-xs font-semibold text-gray-500">Erreurs</p>
            </div>
          </div>
          <p className="rounded-lg border border-orange-100 bg-white p-3 text-sm leading-6 text-gray-600">
            Aucun email n&apos;est envoyé automatiquement tant que le fournisseur email n&apos;est pas branché. Le CRM conserve seulement l&apos;intention de relance.
          </p>
        </div>
      </BentoCard>

      <BentoCard
        span="medium"
        variant={overdueTasks.length ? "danger" : "success"}
        title="Rappels en retard"
        description="Actions a rattraper avant les nouveaux dossiers."
      >
        {overdueTasks.length ? (
          <div className="grid gap-3">
            {overdueTasks.slice(0, 5).map((task) => {
              const lead = task.leadId ? leadsById.get(task.leadId) : null;

              return (
                <div key={task.id} className="rounded-xl border border-red-100 bg-white p-4">
                  <p className="font-bold text-[#111111]">{task.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{lead?.contactName ?? "Lead non lie"}</p>
                  <p className="mt-2 text-sm font-semibold text-red-700">{task.dueAt ? formatDateTime(task.dueAt) : "Sans date"}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full border-red-200 bg-white sm:w-auto"
                    disabled={pendingId === task.id}
                    onClick={() => void completeTask(task, true)}
                  >
                    <CheckCircle2 className="size-4" />Terminer
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <BentoEmptyState
            icon={<CheckCircle2 className="size-5" />}
            title="Aucun retard"
            description="Les rappels passes sont tous traites."
            className="py-10"
          />
        )}
      </BentoCard>

      <BentoCard span="medium" title="Assignation rapide" description="Donner un responsable aux nouveaux leads sans ouvrir chaque fiche.">
        {unassignedPreview.length && team.length ? (
          <div className="grid gap-3">
            {unassignedPreview.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-orange-100 bg-white p-3">
                <p className="font-bold text-[#111111]">{lead.contactName}</p>
                <p className="mt-1 text-xs text-gray-500">{lead.requestType} · {lead.city ?? "Ville non renseignee"}</p>
                <Select value="UNASSIGNED" onValueChange={(value) => void persistLead(lead, { assignedTo: value === "UNASSIGNED" ? null : value })}>
                  <SelectTrigger className="mt-3">
                    <SelectValue>Choisir un agent</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNASSIGNED">Non assigne</SelectItem>
                    {team.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{getTeamMemberLabel(member)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ) : (
          <BentoEmptyState
            icon={<UserRound className="size-5" />}
            title={team.length ? "Tous les leads ont un responsable" : "Aucun agent actif"}
            description={team.length ? "Les prochains leads non assignes apparaitront ici." : "Ajoutez un profil actif pour utiliser l'assignation rapide."}
            className="py-10"
          />
        )}
      </BentoCard>

      <BentoCard span="wide" title="Suivi commercial par agent" description="Charge active, rappels ouverts et retards par responsable.">
        <div className="grid gap-3">
          {agentStats.map((stat) => (
            <div key={stat.id} className="rounded-xl border border-orange-100 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-[#111111]">{stat.label}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {stat.leadCount} lead{stat.leadCount > 1 ? "s" : ""} · {stat.openTaskCount} rappel{stat.openTaskCount > 1 ? "s" : ""} ouvert{stat.openTaskCount > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stat.isUnassigned ? <Badge className="border-0 bg-orange-100 text-orange-800">A assigner</Badge> : null}
                  {stat.overdueTaskCount ? <Badge className="border-0 bg-red-100 text-red-700">{stat.overdueTaskCount} retard</Badge> : null}
                  {stat.urgentLeadCount ? <Badge className="border-0 bg-yellow-100 text-yellow-800">{stat.urgentLeadCount} urgent</Badge> : null}
                </div>
              </div>
              <div className="mt-4">
                <MiniBar value={stat.leadCount + stat.openTaskCount} max={maxAgentWorkload} />
              </div>
              <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-4">
                <span><strong className="text-[#111111]">{stat.newLeadCount}</strong><br />Nouveaux</span>
                <span><strong className="text-[#111111]">{stat.todayTaskCount}</strong><br />Aujourd&apos;hui</span>
                <span><strong className="text-[#111111]">{stat.appointmentCount}</strong><br />Rendez-vous</span>
                <span><strong className="text-[#111111]">{stat.mandateCount}</strong><br />Mandats</span>
              </div>
            </div>
          ))}
        </div>
      </BentoCard>

      <BentoCard span="full" title="Pipeline commercial" description="Suivi quotidien des prospects, rappels et assignations." contentClassName="gap-5">
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {feedback ? <p className="rounded-md bg-orange-50 p-3 text-sm text-orange-800">{feedback}</p> : null}

        {visibleLeads.length === 0 ? (
          <BentoEmptyState
            icon={<Target className="size-5" />}
            title="Aucun lead dans cette vue"
            description="Modifie les filtres ou attends les prochaines demandes."
            className="py-12"
          />
        ) : (
          <div className="grid gap-4">
            {visibleLeads.map((lead) => {
              const leadTasks = (tasksByLead.get(lead.id) ?? []).filter(isOpenTask);
              const nextTask = getLeadNextOpenTask(leadTasks);
              const draft = getDraft(lead.id);

              return (
                <article key={lead.id} className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm shadow-orange-100/40 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-[#111111]">{lead.contactName}</h3>
                        <Badge className="border-0 bg-orange-100 text-orange-800">{leadStatusLabels[lead.status]}</Badge>
                        <Badge className={leadPriorityBadgeClasses[lead.priority]}>{leadPriorityLabels[lead.priority]}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {lead.requestType} · {lead.city ?? "Ville non renseignee"} · {formatDateTime(lead.createdAt)}
                      </p>
                      <p className="mt-1 break-words text-sm text-gray-500">
                        {lead.contactEmail ?? "Email non renseigne"} · {lead.contactPhone ?? "Telephone non renseigne"}
                      </p>
                      {nextTask ? (
                        <p className={cn("mt-3 text-sm font-semibold", getTaskDueTone(nextTask))}>
                          Prochain rappel : {nextTask.title} · {nextTask.dueAt ? formatDateTime(nextTask.dueAt) : "sans date"}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-orange-200 bg-white text-gray-700">
                        <UserRound className="mr-1 size-3" />{lead.assignedToName ?? "Non assigne"}
                      </Badge>
                      <Badge variant="outline" className="border-orange-200 bg-white text-gray-700">
                        <Clock className="mr-1 size-3" />{leadTasks.length} rappel(s)
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-lg bg-orange-50 p-4 text-sm leading-6 text-gray-700">
                      <p><strong>Projet</strong><br />{lead.projectType}</p>
                      <p className="mt-3"><strong>Budget</strong><br />{formatPipelineBudget(lead.budgetMin, lead.budgetMax)}</p>
                      <p className="mt-3"><strong>Surface / pieces</strong><br />{lead.desiredSurface ? `${lead.desiredSurface} m2` : "Non renseigne"} · {lead.desiredRooms ?? "Pieces non renseignees"}</p>
                      {lead.linkedPropertyTitle ? <p className="mt-3"><strong>Bien lie</strong><br />{lead.linkedPropertyTitle}</p> : null}
                    </div>

                    <div className="grid gap-3 lg:col-span-2">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="grid gap-2">
                          <Label>Statut</Label>
                          <Select value={lead.status} onValueChange={(value) => void persistLead(lead, { status: value as LeadStatus })}>
                            <SelectTrigger><SelectValue>{(value) => getStatusSelectLabel(value)}</SelectValue></SelectTrigger>
                            <SelectContent>
                              {leadStatuses.map((value) => <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Priorite</Label>
                          <Select value={lead.priority} onValueChange={(value) => void persistLead(lead, { priority: value as LeadPriority })}>
                            <SelectTrigger><SelectValue>{(value) => getPrioritySelectLabel(value)}</SelectValue></SelectTrigger>
                            <SelectContent>
                              {leadPriorities.map((value) => <SelectItem key={value} value={value}>{leadPriorityLabels[value]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Assigne a</Label>
                          <Select value={lead.assignedTo ?? "UNASSIGNED"} onValueChange={(value) => void persistLead(lead, { assignedTo: value === "UNASSIGNED" ? null : value })}>
                            <SelectTrigger>
                              <SelectValue>{(value) => value === "UNASSIGNED" ? "Non assigne" : getTeamMemberLabel(teamById.get(String(value)))}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UNASSIGNED">Non assigne</SelectItem>
                              {team.map((member) => (
                                <SelectItem key={member.id} value={member.id}>{getTeamMemberLabel(member)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`pipeline-notes-${lead.id}`}>Notes internes</Label>
                        <Textarea
                          id={`pipeline-notes-${lead.id}`}
                          value={lead.notes ?? ""}
                          onChange={(event) => setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, notes: event.target.value } : item))}
                          className="min-h-20"
                          placeholder="Prochain appel, objection, contexte vendeur..."
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" disabled={pendingId === lead.id} onClick={() => void persistLead(lead, { notes: lead.notes })}>
                            <Save className="size-4" />Sauver les notes
                          </Button>
                          <Button type="button" variant="outline" disabled={pendingId === lead.id} onClick={() => void persistLead(lead, { archived: true })}>
                            <Archive className="size-4" />Archiver
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-orange-100 bg-orange-50/60 p-3">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_210px_150px_160px_180px_auto] xl:items-end">
                          <div className="grid gap-2">
                            <Label htmlFor={`task-title-${lead.id}`}>Nouveau rappel</Label>
                            <Input
                              id={`task-title-${lead.id}`}
                              value={draft.title}
                              onChange={(event) => updateDraft(lead.id, { title: event.target.value })}
                              placeholder="Appeler pour qualifier le projet"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`task-due-${lead.id}`}>Echeance</Label>
                            <Input
                              id={`task-due-${lead.id}`}
                              type="datetime-local"
                              value={draft.dueAt}
                              onChange={(event) => updateDraft(lead.id, { dueAt: event.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Priorite</Label>
                            <Select value={draft.priority} onValueChange={(value) => updateDraft(lead.id, { priority: value as LeadPriority })}>
                              <SelectTrigger><SelectValue>{(value) => getPrioritySelectLabel(value)}</SelectValue></SelectTrigger>
                              <SelectContent>
                                {leadPriorities.map((value) => <SelectItem key={value} value={value}>{leadPriorityLabels[value]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Récurrence</Label>
                            <Select value={draft.recurrenceRule} onValueChange={(value) => updateDraft(lead.id, { recurrenceRule: value as TaskRecurrenceRule })}>
                              <SelectTrigger><SelectValue>{(value) => getTaskRecurrenceLabel(value)}</SelectValue></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">Aucune</SelectItem>
                                <SelectItem value="WEEKLY">Hebdomadaire</SelectItem>
                                <SelectItem value="MONTHLY">Mensuelle</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Notification</Label>
                            <Select value={draft.reminderChannel} onValueChange={(value) => updateDraft(lead.id, { reminderChannel: value as TaskReminderChannel })}>
                              <SelectTrigger><SelectValue>{(value) => getTaskReminderChannelLabel(value)}</SelectValue></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">Aucune notification</SelectItem>
                                <SelectItem value="EMAIL">Email préparé</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="button" className="bg-orange-500 text-white hover:bg-orange-600" disabled={pendingId === `task-${lead.id}`} onClick={() => void createTask(lead)}>
                            <Plus className="size-4" />Ajouter
                          </Button>
                        </div>
                      </div>

                      {leadTasks.length ? (
                        <div className="grid gap-2">
                          {leadTasks.slice(0, 4).map((task) => (
                            <div key={task.id} className="flex flex-col gap-2 rounded-lg border border-orange-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-semibold text-[#111111]">{task.title}</p>
                                <p className={cn("text-sm", getTaskDueTone(task))}>{task.dueAt ? formatDateTime(task.dueAt) : "Sans date"}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {task.recurrenceRule !== "NONE" ? (
                                    <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">
                                      {getTaskRecurrenceLabel(task.recurrenceRule)}
                                    </Badge>
                                  ) : null}
                                  {task.reminderChannel === "EMAIL" ? (
                                    <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">
                                      Email · {getTaskEmailStatusLabel(task.emailReminderStatus)}
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                              <Button type="button" variant="outline" disabled={pendingId === task.id} onClick={() => void completeTask(task, true)}>
                                <CheckCircle2 className="size-4" />Terminer
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </BentoCard>
    </BentoGrid>
  );
}

const contactQualificationBadgeClasses: Record<ContactQualificationStatus, string> = {
  TO_REVIEW: "border-0 bg-orange-100 text-orange-800",
  QUALIFIED: "border-0 bg-emerald-100 text-emerald-800",
  DUPLICATE: "border-0 bg-yellow-100 text-yellow-900",
  NO_CONTACT: "border-0 bg-red-100 text-red-800",
  INACTIVE: "border-0 bg-gray-100 text-gray-700",
};

const contactQualificationOrder: Record<ContactQualificationStatus, number> = {
  TO_REVIEW: 0,
  QUALIFIED: 1,
  NO_CONTACT: 2,
  DUPLICATE: 3,
  INACTIVE: 4,
};

function LeadManager({
  userRole = "READ_ONLY",
  leads,
  setLeads,
  connected,
  title,
  description,
  enableQualification = false,
  onPipelineChanged,
  onOpenPipeline,
  contactSearch = "",
  onContactSearchChange = () => {},
  selectedContactId = null,
  onSelectedContactChange = () => {},
  onCreateContact = () => {},
  activities = [],
  pipelineLeads = [],
  pipelineTasks = [],
  properties = [],
  team = [],
}: {
  leads: AdminLead[];
  setLeads: React.Dispatch<React.SetStateAction<AdminLead[]>>;
  connected: boolean;
  title: string;
  description: string;
  enableQualification?: boolean;
  userRole?: AdminRole;
  onPipelineChanged?: () => Promise<void> | void;
  onOpenPipeline?: () => void;
  contactSearch?: string;
  onContactSearchChange?: (value: string) => void;
  selectedContactId?: string | null;
  onSelectedContactChange?: (id: string | null) => void;
  onCreateContact?: () => void;
  activities?: Activity[];
  pipelineLeads?: PipelineLead[];
  pipelineTasks?: PipelineTask[];
  properties?: Property[];
  team?: AdminTeamMember[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [qualificationFilter, setQualificationFilter] = useState("ALL");
  const [feedback, setFeedback] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const visible = useMemo(
    () =>
      leads
        .filter((lead) => {
          const haystack = `${lead.name} ${lead.email} ${lead.city} ${lead.category}`.toLowerCase();
          return (
            !lead.archived &&
            haystack.includes(search.toLowerCase()) &&
            (status === "ALL" || lead.status === status) &&
            (qualificationFilter === "ALL" || lead.qualificationStatus === qualificationFilter)
          );
        })
        .sort((a, b) => {
          if (!enableQualification) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          const aRank = a.qualificationStatus ? contactQualificationOrder[a.qualificationStatus] : 99;
          const bRank = b.qualificationStatus ? contactQualificationOrder[b.qualificationStatus] : 99;
          return aRank - bRank || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }),
    [enableQualification, leads, qualificationFilter, search, status]
  );
  const qualificationMetrics = {
    toReview: leads.filter((lead) => !lead.archived && lead.qualificationStatus === "TO_REVIEW").length,
    ready: leads.filter(
      (lead) =>
        !lead.archived &&
        lead.qualificationStatus === "QUALIFIED" &&
        lead.activeProspect &&
        lead.contactRole !== "UNKNOWN" &&
        !lead.pipelineLeadId
    ).length,
    noContact: leads.filter((lead) => !lead.archived && lead.qualificationStatus === "NO_CONTACT").length,
  };

  async function persist(lead: AdminLead, updates: Partial<AdminLead>) {
    if (!connected) {
      setFeedback("Connexion à Supabase nécessaire pour enregistrer.");
      return false;
    }

    const response = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: lead.kind, id: lead.id, ...updates }),
    }).catch(() => null);
    const payload = response
      ? (await response.json().catch(() => null)) as {
          message?: string;
          lead?: ContactLead | EstimationLead;
        } | null
      : null;

    if (!response?.ok) {
      if (response?.status === 401) router.push("/admin/login");
      setFeedback(payload?.message ?? "Mise à jour impossible.");
      return false;
    }

    if (payload?.lead) {
      const normalizedLead =
        lead.kind === "contacts"
          ? normalizeContacts([payload.lead as ContactLead])[0]
          : normalizeEstimations([payload.lead as EstimationLead])[0];
      setLeads((current) => current.map((item) => item.id === lead.id ? normalizedLead : item));
    }
    setFeedback(payload?.message ?? "Mise à jour enregistrée.");
    return true;
  }

  async function refreshContacts() {
    const response = await fetch("/api/admin/leads", { cache: "no-store" }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) as { contacts?: ContactLead[] } | null : null;
    if (response?.ok && payload?.contacts) setLeads(normalizeContacts(payload.contacts));
    else setFeedback("L'action est enregistrée, mais l'actualisation a échoué. Rechargez la liste.");
    await onPipelineChanged?.();
  }

  async function saveQualification(lead: AdminLead) {
    if (!lead.contactRole || !lead.qualificationStatus) return;
    setPendingId(`qualification-${lead.id}`);
    await persist(lead, {
      contactRole: lead.contactRole,
      qualificationStatus: lead.qualificationStatus,
      activeProspect: lead.activeProspect,
    });
    setPendingId(null);
  }

  async function createProspect(lead: AdminLead) {
    if (!connected) {
      setFeedback("Supabase doit être connecté pour créer un prospect dans le pipeline.");
      return;
    }

    setPendingId(`pipeline-${lead.id}`);
    const qualificationSaved = await persist(lead, {
      contactRole: lead.contactRole,
      qualificationStatus: lead.qualificationStatus,
      activeProspect: lead.activeProspect,
    });
    if (!qualificationSaved) {
      setPendingId(null);
      return;
    }

    const response = await fetch("/api/admin/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-lead-from-contact", contactId: lead.id }),
    }).catch(() => null);
    const payload = response
      ? (await response.json().catch(() => null)) as {
          message?: string;
          leadId?: string;
        } | null
      : null;

    if (!response?.ok || !payload?.leadId) {
      if (response?.status === 401) router.push("/admin/login");
      setFeedback(payload?.message ?? "Le prospect n'a pas pu être créé.");
      setPendingId(null);
      return;
    }

    setLeads((current) =>
      current.map((item) => item.id === lead.id ? { ...item, pipelineLeadId: payload.leadId! } : item)
    );
    await onPipelineChanged?.();
    setFeedback(payload.message ?? "Prospect créé dans le pipeline.");
    setPendingId(null);
  }

  if (enableQualification) {
    return (
      <CrmRivieraContacts
        userRole={userRole}
        onDataChanged={refreshContacts}
        leads={leads}
        setLeads={setLeads}
        connected={connected}
        search={contactSearch}
        onSearchChange={onContactSearchChange}
        selectedContactId={selectedContactId}
        onSelectedContactChange={onSelectedContactChange}
        pendingId={pendingId}
        feedback={feedback}
        onSaveQualification={saveQualification}
        onCreateProspect={createProspect}
        onPersist={persist}
        onOpenPipeline={onOpenPipeline ?? (() => {})}
        onCreateContact={onCreateContact}
        activities={activities}
        pipelineLeads={pipelineLeads}
        pipelineTasks={pipelineTasks}
        properties={properties}
        team={team}
      />
    );
  }

  return (
    <BentoCard span="full" title={title} description={description} contentClassName="gap-5">
      {enableQualification ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="À qualifier" value={qualificationMetrics.toReview} description="Validation humaine attendue." tone="orange" />
          <KpiCard label="Prêts pour le pipeline" value={qualificationMetrics.ready} description="Qualifiés, actifs et non convertis." />
          <KpiCard label="Sans contact" value={qualificationMetrics.noContact} description="Téléphone ou email réel manquant." />
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_200px_240px]">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 size-4 text-gray-400 sm:top-2.5" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un nom, une ville, un email" className="pl-9" />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value ?? "ALL")}>
          <SelectTrigger className="w-full">
            <SelectValue>{(value) => getStatusSelectLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            {leadStatuses.map((value) => <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>)}
          </SelectContent>
        </Select>
        {enableQualification ? (
          <Select value={qualificationFilter} onValueChange={(value) => setQualificationFilter(value ?? "ALL")}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) =>
                  value === "ALL"
                    ? "Toutes les qualifications"
                    : contactQualificationStatusLabels[value as ContactQualificationStatus]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les qualifications</SelectItem>
              {contactQualificationStatuses.map((value) => (
                <SelectItem key={value} value={value}>{contactQualificationStatusLabels[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : <div />}
      </div>

      {feedback ? <p className="rounded-md bg-orange-50 p-3 text-sm text-orange-800" aria-live="polite">{feedback}</p> : null}
      {visible.length === 0 ? (
        <BentoEmptyState
          icon={<ContactRound className="size-5" />}
          title="Aucun prospect dans cette vue"
          description="Les prochaines demandes apparaîtront ici automatiquement."
          className="py-12"
        />
      ) : visible.map((lead) => {
        const qualificationStatus = lead.qualificationStatus ?? "TO_REVIEW";
        const contactRole = lead.contactRole ?? "UNKNOWN";
        const qualificationDisablesProspect = ["DUPLICATE", "NO_CONTACT", "INACTIVE"].includes(qualificationStatus);
        const readyForPipeline =
          qualificationStatus === "QUALIFIED" &&
          lead.activeProspect &&
          contactRole !== "UNKNOWN" &&
          !lead.pipelineLeadId;

        return (
          <article key={lead.id} className="rounded-lg border border-[#e8e3da] bg-white p-4 shadow-[0_5px_16px_rgb(17_17_17/0.045)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-lg font-bold text-[#111111]">{lead.name}</p>
                <p className="mt-1 text-sm text-gray-500">{new Date(lead.createdAt).toLocaleString("fr-FR")} · {lead.city}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="w-fit border-0 bg-orange-100 text-orange-800">{leadStatusLabels[lead.status]}</Badge>
                {enableQualification ? (
                  <Badge className={contactQualificationBadgeClasses[qualificationStatus]}>
                    {contactQualificationStatusLabels[qualificationStatus]}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-5">
              <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
                <p><strong>Email</strong><br />{lead.email}</p>
                <p><strong>Téléphone</strong><br />{lead.phone}</p>
                <p><strong>Demande</strong><br />{lead.category}</p>
              </div>
              <p className="break-words rounded-md bg-[#f6f2e9] p-4 text-sm leading-6 text-gray-700">{lead.message}</p>

              {enableQualification ? (
                <section className="grid gap-4 border-t border-[#e8e3da] pt-4" aria-label={`Qualification de ${lead.name}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-bold text-[#111111]">Qualification commerciale</h3>
                      <p className="mt-1 text-sm leading-5 text-gray-600">
                        Classification {lead.qualificationSource === "MANUAL" ? "validée manuellement" : "préremplie automatiquement"}.
                      </p>
                    </div>
                    {lead.pipelineLeadId ? (
                      <Badge className="w-fit border-0 bg-[#111111] text-white">Déjà dans le pipeline</Badge>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>Rôle commercial</Label>
                      <Select
                        value={contactRole}
                        onValueChange={(value) =>
                          setLeads((current) =>
                            current.map((item) => item.id === lead.id ? { ...item, contactRole: value as ContactRole } : item)
                          )
                        }
                      >
                        <SelectTrigger><SelectValue>{(value) => contactRoleLabels[value as ContactRole]}</SelectValue></SelectTrigger>
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
                          setLeads((current) =>
                            current.map((item) =>
                              item.id === lead.id
                                ? {
                                    ...item,
                                    qualificationStatus: nextStatus,
                                    activeProspect: ["DUPLICATE", "NO_CONTACT", "INACTIVE"].includes(nextStatus)
                                      ? false
                                      : item.activeProspect,
                                  }
                                : item
                            )
                          );
                        }}
                      >
                        <SelectTrigger><SelectValue>{(value) => contactQualificationStatusLabels[value as ContactQualificationStatus]}</SelectValue></SelectTrigger>
                        <SelectContent>
                          {contactQualificationStatuses.map((value) => (
                            <SelectItem key={value} value={value}>{contactQualificationStatusLabels[value]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex min-h-12 items-center gap-3 self-end rounded-lg border border-[#d8d2c8] bg-white px-3 py-2 text-sm font-semibold text-[#111111]">
                      <input
                        type="checkbox"
                        checked={lead.activeProspect}
                        disabled={qualificationDisablesProspect}
                        onChange={(event) =>
                          setLeads((current) =>
                            current.map((item) => item.id === lead.id ? { ...item, activeProspect: event.target.checked } : item)
                          )
                        }
                        className="size-5 accent-orange-600"
                      />
                      Prospect actif
                    </label>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-[#d8d2c8] bg-white sm:w-auto"
                      disabled={pendingId === `qualification-${lead.id}`}
                      onClick={() => void saveQualification(lead)}
                    >
                      <Save className="size-4" />
                      Valider la qualification
                    </Button>
                    {lead.pipelineLeadId ? (
                      <Button type="button" className="w-full bg-[#111111] text-white hover:bg-[#272727] sm:w-auto" onClick={onOpenPipeline}>
                        <Target className="size-4" />
                        Ouvrir le pipeline
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="w-full bg-orange-500 text-white hover:bg-orange-600 sm:w-auto"
                        disabled={!readyForPipeline || pendingId === `pipeline-${lead.id}` || !connected}
                        onClick={() => void createProspect(lead)}
                      >
                        <Target className="size-4" />
                        {pendingId === `pipeline-${lead.id}` ? "Création..." : "Créer un prospect"}
                      </Button>
                    )}
                  </div>
                  {!lead.pipelineLeadId && !readyForPipeline ? (
                    <p className="text-xs leading-5 text-gray-500">
                      Pour créer le prospect : choisissez un rôle, passez l&apos;état à Qualifié et conservez Prospect actif.
                    </p>
                  ) : null}
                </section>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-[200px_1fr_auto_auto] lg:items-end">
                <div className="grid gap-2">
                  <Label>Statut</Label>
                  <Select value={lead.status} onValueChange={(value) => void persist(lead, { status: value as LeadStatus })}>
                    <SelectTrigger><SelectValue>{(value) => getStatusSelectLabel(value)}</SelectValue></SelectTrigger>
                    <SelectContent>{leadStatuses.map((value) => <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`notes-${lead.id}`}>Notes internes</Label>
                  <Input id={`notes-${lead.id}`} value={lead.notes} onChange={(event) => setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, notes: event.target.value } : item))} />
                </div>
                <Button variant="outline" onClick={() => void persist(lead, { notes: lead.notes })}><Save className="size-4" />Sauver</Button>
                <Button variant="outline" onClick={() => void persist(lead, { archived: true })}><Archive className="size-4" />Archiver</Button>
              </div>
            </div>
          </article>
        );
      })}
    </BentoCard>
  );
}

function getLegacyCandidateKey(candidate: Pick<LegacyReviewCandidate, "legacySource" | "legacyId">) {
  return `${candidate.legacySource}:${candidate.legacyId}`;
}

function getLegacySourceLabel(source: LegacyReviewCandidate["legacySource"]) {
  return source === "contact" ? "Ancien contact" : "Ancienne estimation";
}

function getReviewStatusLabel(status: LegacyReviewStatusFilter) {
  if (status === "PENDING") return "A traiter";
  if (status === "REVIEWED") return "Deja revu";
  return "Tous les cas";
}

function getMatchFilterLabel(value: LegacyMatchFilter) {
  if (value === "ALL") return "Tous les rapprochements";
  return legacyMatchCategoryLabels[value];
}

function LegacyReviewPanel({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [review, setReview] = useState<LegacyReviewResponse | null>(null);
  const [loading, setLoading] = useState(connected);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [matchFilter, setMatchFilter] = useState<LegacyMatchFilter>("ALL");
  const [reviewStatus, setReviewStatus] = useState<LegacyReviewStatusFilter>("ALL");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);

  async function loadReview() {
    if (!connected) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/legacy-review").catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as LegacyReviewResponse | null)
      : null;

    setLoading(false);

    if (!response?.ok || !payload?.success) {
      if (response?.status === 401) router.push("/admin/login");
      setError(payload?.message ?? "La revue des anciennes demandes n'a pas pu etre chargee.");
      return;
    }

    setReview(payload);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReview();
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const candidates = review?.candidates ?? [];
  const filteredCandidates = candidates.filter((candidate) => {
    const haystack = [
      candidate.futureContact.name,
      candidate.futureContact.email,
      candidate.futureContact.phone,
      candidate.futureContact.city,
      candidate.futureLead.requestType,
      candidate.matchCategory,
      candidate.matchedKeys.join(" "),
      candidate.review?.decisionLabel,
      candidate.review?.note,
    ]
      .join(" ")
      .toLowerCase();
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesCategory = matchFilter === "ALL" || candidate.matchCategory === matchFilter;
    const matchesReview =
      reviewStatus === "ALL" ||
      (reviewStatus === "REVIEWED" && Boolean(candidate.review)) ||
      (reviewStatus === "PENDING" && !candidate.review);

    return matchesSearch && matchesCategory && matchesReview;
  });

  async function recordDecision(candidate: LegacyReviewCandidate, decision: LegacyReviewDecision) {
    if (!connected) {
      setFeedback("La revue des anciennes demandes necessite Supabase connecte pour journaliser la decision.");
      return;
    }

    const key = getLegacyCandidateKey(candidate);
    setPendingDecision(`${key}:${decision}`);
    setFeedback("");

    const response = await fetch("/api/admin/legacy-review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legacySource: candidate.legacySource,
        legacyId: candidate.legacyId,
        decision,
        note: notes[key] ?? "",
      }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;

    setPendingDecision(null);

    if (!response?.ok) {
      setFeedback(payload?.message ?? "La decision n'a pas pu etre enregistree.");
      return;
    }

    setFeedback(payload?.message ?? "Decision enregistree.");
    await loadReview();
  }

  if (!connected) {
    return (
      <BentoGrid>
        <BentoCard
          span="full"
          variant="warning"
          title="Anciennes demandes indisponibles en mode local"
          description="Connectez Supabase et ouvrez une session admin pour analyser les anciennes demandes avant migration."
        >
          <BentoEmptyState
            icon={<Info className="size-5" />}
            title="Aucune ecriture ne sera faite"
            description="Cet ecran sert uniquement a preparer une future migration controlee."
          />
        </BentoCard>
      </BentoGrid>
    );
  }

  return (
    <BentoGrid>
      <BentoCard
        span="full"
        variant="highlight"
        eyebrow="Phase 3"
        title="Revue et fusion manuelle des anciennes demandes"
        description="Controle humain obligatoire avant de transformer les anciennes tables contacts et estimations en contacts + demandes CRM."
        action={
          <Button type="button" variant="outline" className="border-orange-200 bg-white" onClick={() => void loadReview()}>
            <Search className="size-4" />Rafraichir
          </Button>
        }
      >
        <div className="rounded-xl border border-orange-200 bg-white p-4 text-sm leading-6 text-gray-700">
          <p>
            Ce module journalise uniquement les decisions de revue. Il ne lance aucune migration,
            ne fusionne aucun contact et ne supprime aucune ancienne donnee.
          </p>
          {review?.generatedAt ? (
            <p className="mt-2 text-xs text-gray-500">Derniere analyse : {formatDateTime(review.generatedAt)}</p>
          ) : null}
        </div>
      </BentoCard>

      {review?.summary ? (
        <>
          <BentoKpiCard label="Anciennes demandes" value={review.summary.submissionsAnalyzed} description="Contacts + estimations lus." span="medium" />
          <BentoKpiCard label="Ambigus" value={review.summary.byCategory.AMBIGU} description="A arbitrer avant migration." tone="warning" span="medium" />
          <BentoKpiCard label="Deja revus" value={review.reviewSummary?.reviewed ?? 0} description="Decisions journalisees." tone="success" span="medium" />
        </>
      ) : null}

      <BentoCard span="full" title="Filtres de revue" description="Isolez les cas ambigus, deja revus ou encore a traiter.">
        <div className="grid gap-3 lg:grid-cols-[1fr_240px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un nom, email, telephone, ville ou cle de match"
              className="pl-9"
            />
          </div>
          <Select value={matchFilter} onValueChange={(value) => setMatchFilter((value ?? "ALL") as LegacyMatchFilter)}>
            <SelectTrigger>
              <SelectValue>{getMatchFilterLabel(matchFilter)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {legacyMatchFilters.map((value) => (
                <SelectItem key={value} value={value}>{getMatchFilterLabel(value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reviewStatus} onValueChange={(value) => setReviewStatus((value ?? "ALL") as LegacyReviewStatusFilter)}>
            <SelectTrigger>
              <SelectValue>{getReviewStatusLabel(reviewStatus)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les cas</SelectItem>
              <SelectItem value="PENDING">A traiter</SelectItem>
              <SelectItem value="REVIEWED">Deja revu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {feedback ? <p className="rounded-md bg-orange-50 p-3 text-sm font-medium text-orange-800">{feedback}</p> : null}
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      </BentoCard>

      <BentoCard
        span="full"
        title="Cas a verifier"
        description="Chaque decision est conservee comme trace de revue. La migration reelle viendra plus tard."
      >
        {loading ? (
          <p className="rounded-xl border border-orange-100 bg-white p-5 text-sm font-semibold text-orange-800">
            Chargement des anciennes demandes...
          </p>
        ) : filteredCandidates.length === 0 ? (
          <BentoEmptyState
            icon={<ListChecks className="size-5" />}
            title="Aucun cas dans cette vue"
            description="Modifiez les filtres ou relancez la revue des anciennes demandes."
            className="py-12"
          />
        ) : (
          <div className="grid gap-4">
            {filteredCandidates.map((candidate) => {
              const key = getLegacyCandidateKey(candidate);
              const noteValue = notes[key] ?? "";

              return (
                <article key={key} className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm shadow-orange-100/40 sm:p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-0 bg-orange-50 text-orange-800">{getLegacySourceLabel(candidate.legacySource)}</Badge>
                        <Badge className={legacyMatchCategoryClasses[candidate.matchCategory]}>
                          {legacyMatchCategoryLabels[candidate.matchCategory]}
                        </Badge>
                        {candidate.review ? (
                          <Badge className="border-0 bg-emerald-100 text-emerald-800">{candidate.review.decisionLabel}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">A traiter</Badge>
                        )}
                      </div>
                      <h3 className="mt-3 break-words text-xl font-black text-[#111111]">{candidate.futureContact.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-gray-600">
                        {candidate.futureLead.requestType} · {candidate.futureContact.city ?? "Ville non renseignee"} · statut futur {leadStatusLabels[candidate.futureLead.status as LeadStatus] ?? candidate.futureLead.status}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 lg:text-right">ID source<br /><span className="font-mono">{candidate.legacyId}</span></p>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <p className="rounded-lg bg-orange-50 p-3 text-sm text-gray-700">
                      <strong>Email</strong><br />{candidate.futureContact.email ?? "Absent ou invalide"}
                    </p>
                    <p className="rounded-lg bg-orange-50 p-3 text-sm text-gray-700">
                      <strong>Telephone</strong><br />{candidate.futureContact.phone ?? "Absent ou invalide"}
                    </p>
                    <p className="rounded-lg bg-orange-50 p-3 text-sm text-gray-700">
                      <strong>Action simulee</strong><br />{legacyPlannedActionLabels[candidate.plannedAction]}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-orange-100 p-4">
                      <p className="text-sm font-bold text-[#111111]">Cles de rapprochement</p>
                      {candidate.matchedKeys.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {candidate.matchedKeys.map((matchedKey) => (
                            <Badge key={matchedKey} variant="outline" className="border-orange-200 bg-white text-orange-700">
                              {matchedKey}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">Aucune cle commune detectee.</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-orange-100 p-4">
                      <p className="text-sm font-bold text-[#111111]">Points d&apos;attention</p>
                      {candidate.warnings.length ? (
                        <ul className="mt-2 grid gap-1 text-sm text-gray-600">
                          {candidate.warnings.map((warning) => (
                            <li key={warning}>- {warning}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">Aucune alerte particuliere.</p>
                      )}
                    </div>
                  </div>

                  {candidate.review ? (
                    <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <p className="font-bold">Derniere decision : {candidate.review.decisionLabel}</p>
                      <p className="mt-1">Par {candidate.review.actorEmail ?? "admin"} · {formatDateTime(candidate.review.createdAt)}</p>
                      {candidate.review.note ? <p className="mt-2">{candidate.review.note}</p> : null}
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-3">
                    <Label htmlFor={`legacy-note-${key}`}>Note de revue</Label>
                    <Textarea
                      id={`legacy-note-${key}`}
                      value={noteValue}
                      onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))}
                      placeholder="Ex. meme personne confirmee par telephone, doublon a ignorer, informations insuffisantes..."
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(Object.keys(legacyReviewDecisionLabels) as LegacyReviewDecision[]).map((decision) => (
                        <Button
                          key={decision}
                          type="button"
                          variant={decision === "READY_FOR_MIGRATION" ? "default" : "outline"}
                          disabled={pendingDecision === `${key}:${decision}`}
                          className={cn(
                            "w-full",
                            decision === "READY_FOR_MIGRATION" ? "bg-orange-500 text-white hover:bg-orange-600" : "border-orange-200 bg-white"
                          )}
                          onClick={() => void recordDecision(candidate, decision)}
                        >
                          <Save className="size-4" />{legacyReviewDecisionLabels[decision]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </BentoCard>
    </BentoGrid>
  );
}

function CrmLoadingState() {
  return (
    <div aria-busy="true" aria-label="Chargement des données CRM">
      <BentoGrid>
        <BentoCard span="wide" variant="highlight" title="Chargement des priorités">
          <BentoCardSkeleton lines={4} />
        </BentoCard>
        <BentoCard span="medium" title="Chargement du suivi">
          <BentoCardSkeleton lines={3} />
        </BentoCard>
        <BentoCard span="full" title="Préparation de votre espace">
          <BentoCardSkeleton lines={2} />
        </BentoCard>
      </BentoGrid>
    </div>
  );
}

function CrmLoadErrorState({ message }: { message: string }) {
  return (
    <BentoGrid>
      <BentoCard
        span="full"
        variant="danger"
        title="Le CRM n'a pas pu être chargé"
        description="Vos données ne sont pas modifiées. Vous pouvez relancer le chargement."
        action={
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Réessayer
          </Button>
        }
      >
        <BentoErrorState message={message} />
      </BentoCard>
    </BentoGrid>
  );
}

function scrollToCrmSection(id: string) {
  requestAnimationFrame(() => {
    const target = document.getElementById(id);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
  });
}

export function AdminDashboard({ contacts, estimations, activities: initialActivities, properties, connected, userName, agencyName, userRole, initialTab = "overview", initialContactId = null, initialPropertyId = null, initialSearch = "", canWriteProperties = false }: Props) {
  const router = useRouter();
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(connected);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  useEffect(() => {
    function restoreTab() {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "agenda" || tab === "overview" || tab === "properties" || tab === "contacts" || tab === "activities" || tab === "statistics" || tab === "legacyReview" || tab === "settings") setActiveTab(tab);
      else if (!tab) setActiveTab("overview");
    }
    window.addEventListener("popstate", restoreTab);
    return () => window.removeEventListener("popstate", restoreTab);
  }, []);
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState(initialSearch);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(initialContactId);
  const [propertyCreateOpen, setPropertyCreateOpen] = useState(false);
  const propertyCreationLeave = useRef<((after?: () => void) => void) | null>(null);
  const registerPropertyCreationLeave = useCallback((handler: typeof propertyCreationLeave.current) => {
    propertyCreationLeave.current = handler;
  }, []);
  const [propertyLoadError, setPropertyLoadError] = useState("");
  const [contactLeads, setContactLeads] = useState(() => normalizeContacts(contacts));
  const [estimationLeads, setEstimationLeads] = useState(() => normalizeEstimations(estimations));
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLead[]>([]);
  const [pipelineTasks, setPipelineTasks] = useState<PipelineTask[]>([]);
  const [pipelineOffers, setPipelineOffers] = useState<CommercialOffer[]>([]);
  const [pipelineMetrics, setPipelineMetrics] = useState<PipelineMetrics>(emptyPipelineMetrics);
  const [pipelinePermissions, setPipelinePermissions] = useState<PipelinePermissions>(emptyPipelinePermissions);
  const [offerComposerContext, setOfferComposerContext] = useState<{
    leadId: string | null;
    propertyId: string | null;
  } | null>(null);
  const [overviewSnapshot, setOverviewSnapshot] = useState<CrmOverviewSnapshot | null>(null);
  const [onboardingProgress, setOnboardingProgress] = useState<CrmOnboardingProgress | null>(null);
  const [onboardingSavingStep, setOnboardingSavingStep] = useState<CrmOnboardingStepKey | null>(null);
  const [onboardingError, setOnboardingError] = useState("");
  const [teamMembers, setTeamMembers] = useState<AdminTeamMember[]>([]);
  const [pipelineError, setPipelineError] = useState("");
  const [offerFeedback, setOfferFeedback] = useState("");
  const [activities, setActivities] = useState(initialActivities);
  const [propertyItems, setPropertyItems] = useState(properties);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityEntityType, setActivityEntityType] = useState<ActivityEntityTypeFilter>("ALL");
  const [activityAction, setActivityAction] = useState<ActivityActionFilter>("ALL");
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriodFilter>("ALL");
  const [activityVisibility, setActivityVisibility] = useState<ActivityVisibilityFilter>("business");
  const businessActivities = useMemo(
    () => activities.filter((activity) => !isRecipeActivity(activity)),
    [activities]
  );
  const recipeActivitiesCount = activities.length - businessActivities.length;
  const metrics = useMemo(
    () => buildAdminMetrics(contactLeads, estimationLeads, propertyItems, businessActivities),
    [businessActivities, contactLeads, estimationLeads, propertyItems]
  );
  const dailyPriorities = useMemo(
    () =>
      buildCrmDailyPriorities({
        contacts: contactLeads,
        leads: pipelineLeads,
        tasks: pipelineTasks,
      }),
    [contactLeads, pipelineLeads, pipelineTasks]
  );
  const pipelinePriorityCount = dailyPriorities.filter((priority) => priority.tab === "pipeline").length;
  const selectedContact =
    contactLeads.find((contact) => contact.id === selectedContactId && !contact.archived) ?? null;
  const filteredActivities = useMemo(
    () => filterActivities(activities, activitySearch, activityEntityType, activityAction, activityPeriod, activityVisibility),
    [activities, activityAction, activityEntityType, activityPeriod, activitySearch, activityVisibility]
  );

  useEffect(() => {
    if (!offerFeedback) return;
    const timeoutId = window.setTimeout(() => setOfferFeedback(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [offerFeedback]);

  async function refreshPipeline() {
    if (!connected) {
      return;
    }

    setPipelineError("");
    const response = await fetch("/api/admin/pipeline").catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as PipelineResponse | null)
      : null;

    if (!response?.ok || !payload?.success) {
      if (response?.status === 401) router.push("/admin/login");
      setPipelineError(payload?.message ?? "Le pipeline CRM n'a pas pu etre charge.");
      return;
    }

    setPipelineLeads(payload.leads ?? []);
    setPipelineTasks(payload.tasks ?? []);
    setPipelineOffers(payload.offers ?? []);
    setTeamMembers(payload.team ?? []);
    setPipelineMetrics(payload.metrics ?? emptyPipelineMetrics);
    setPipelinePermissions(payload.permissions ?? emptyPipelinePermissions);
  }

  function openOfferComposer({
    leadId = null,
    propertyId = null,
  }: {
    leadId?: string | null;
    propertyId?: string | null;
  }) {
    setOfferComposerContext({ leadId, propertyId });
  }

  useEffect(() => {
    if (!connected) {
      return;
    }

    let cancelled = false;

    async function loadCrmData() {
      setLoading(true);
      setLoadError("");

      const [response, propertiesResponse, pipelineResponse, overviewResponse, onboardingResponse] = await Promise.all([
        fetch("/api/admin/leads"),
        fetch("/api/admin/properties"),
        fetch("/api/admin/pipeline"),
        fetch("/api/admin/overview"),
        fetch("/api/admin/onboarding"),
      ]);
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        contacts?: ContactLead[];
        estimations?: EstimationLead[];
        activities?: Activity[];
      } | null;
      const propertiesPayload = (await propertiesResponse.json().catch(() => null)) as {
        properties?: Property[];
        message?: string;
      } | null;
      const pipelinePayload = (await pipelineResponse.json().catch(() => null)) as PipelineResponse | null;
      const overviewPayload = (await overviewResponse.json().catch(() => null)) as OverviewResponse | null;
      const onboardingPayload = (await onboardingResponse.json().catch(() => null)) as OnboardingResponse | null;

      if (cancelled) return;
      setLoading(false);

      if (!response.ok) {
        setLoadError(payload?.message ?? "Le CRM n'a pas pu etre charge.");
        if (response.status === 401) router.push("/admin/login");
        return;
      }

      setContactLeads(normalizeContacts(payload?.contacts ?? []));
      setEstimationLeads(normalizeEstimations(payload?.estimations ?? []));
      setActivities(payload?.activities ?? []);

      if (propertiesResponse.ok && propertiesPayload?.properties) {
        setPropertyItems(propertiesPayload.properties);
        setPropertyLoadError("");
      } else {
        setPropertyLoadError(propertiesPayload?.message ?? "Le portefeuille n’a pas pu être chargé.");
      }

      if (pipelineResponse.ok && pipelinePayload?.success) {
        setPipelineError("");
        setPipelineLeads(pipelinePayload.leads ?? []);
        setPipelineTasks(pipelinePayload.tasks ?? []);
        setPipelineOffers(pipelinePayload.offers ?? []);
        setTeamMembers(pipelinePayload.team ?? []);
        setPipelineMetrics(pipelinePayload.metrics ?? emptyPipelineMetrics);
        setPipelinePermissions(pipelinePayload.permissions ?? emptyPipelinePermissions);
      } else {
        if (pipelineResponse.status === 401) router.push("/admin/login");
        setPipelineError(pipelinePayload?.message ?? "Le pipeline CRM n'a pas pu etre charge.");
      }

      if (overviewResponse.ok && overviewPayload?.success) {
        setOverviewSnapshot(overviewPayload.overview ?? null);
      }

      let currentOnboardingProgress = onboardingResponse.ok && onboardingPayload?.success
        ? onboardingPayload.progress ?? null
        : null;
      if (!onboardingResponse.ok) {
        setOnboardingError(onboardingPayload?.message ?? "La progression de démarrage n'a pas pu être chargée.");
      } else {
        setOnboardingError("");
      }

      const overviewMetrics = overviewPayload?.overview?.metrics;
      const isEmptyWorkspace = Boolean(
        overviewResponse.ok &&
        overviewMetrics &&
        overviewMetrics.totalLeads === 0 &&
        overviewMetrics.availableProperties === 0 &&
        overviewMetrics.visits === 0 &&
        overviewMetrics.offers === 0 &&
        overviewMetrics.openTasks === 0
      );
      if (isEmptyWorkspace && !currentOnboardingProgress) {
        const startResponse = await fetch("/api/admin/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start: true }),
        }).catch(() => null);
        const startPayload = startResponse
          ? ((await startResponse.json().catch(() => null)) as OnboardingResponse | null)
          : null;
        if (startResponse?.ok && startPayload?.success && startPayload.progress) {
          currentOnboardingProgress = startPayload.progress;
          setOnboardingError("");
        } else {
          setOnboardingError(startPayload?.message ?? "La progression de démarrage n'a pas pu être initialisée.");
        }
      }
      setOnboardingProgress(currentOnboardingProgress);
    }

    void loadCrmData().catch(() => {
      if (cancelled) return;
      setLoading(false);
      setLoadError("Connexion interrompue. Réessayez pour charger les données CRM.");
    });

    return () => {
      cancelled = true;
    };
  }, [connected, properties, router]);

  async function toggleOnboardingStep(step: CrmOnboardingStepKey, completed: boolean) {
    if (!connected || onboardingSavingStep) return;

    setOnboardingSavingStep(step);
    setOnboardingError("");
    const response = await fetch("/api/admin/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, completed }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as OnboardingResponse | null)
      : null;
    setOnboardingSavingStep(null);

    if (!response?.ok || !payload?.success || !payload.progress) {
      if (response?.status === 401) router.push("/admin/login");
      setOnboardingError(payload?.message ?? "La progression n'a pas pu être enregistrée.");
      return;
    }

    setOnboardingProgress(payload.progress);
  }

  async function logout() {
    const response = await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as { redirectTo?: string } | null)
      : null;

    router.replace(payload?.redirectTo ?? "/admin/login");
  }

  function afterPropertyCreation(action: () => void) {
    if (propertyCreationLeave.current) propertyCreationLeave.current(action);
    else action();
  }

  function guardCommercialNavigation(href: string) {
    if (!propertyCreationLeave.current) return false;
    propertyCreationLeave.current(() => router.push(href));
    return true;
  }

  function changeTab(tab: AdminTab) {
    if (tab === activeTab) return;
    afterPropertyCreation(() => {
      const href = commercialHrefForTab(tab);
      if (href) router.push(href);
      else {
        const routedTabs: AdminTab[] = ["agenda", "statistics", "settings"];
        if (routedTabs.includes(tab) || routedTabs.includes(activeTab)) router.push(`/admin?tab=${tab}`);
        setActiveTab(tab);
        if (tab !== "contacts") setSelectedContactId(null);
      }
    });
  }

  function openContactCreation() {
    if (!connected || !["ADMIN", "DIRECTOR", "AGENT", "ASSISTANT"].includes(userRole)) {
      setOfferFeedback(!connected ? "Connexion à Supabase nécessaire pour créer un contact." : "Votre rôle ne permet pas de créer un contact.");
      return;
    }
    afterPropertyCreation(() => {
      setSelectedContactId(null);
      setActiveTab("contacts");
      setContactCreateOpen(true);
      scrollToCrmSection("crm-create-contact");
    });
  }

  function handlePriorityAction(priority: CrmDailyPriority) {
    if (priority.tab === "contacts") {
      setSelectedContactId(priority.contactId ?? null);
    }
    changeTab(priority.tab);
    window.scrollTo({ top: 0 });
  }

  const mobileQuickAction =
    activeTab === "contacts"
      ? {
          label: "Créer un contact",
          icon: Plus,
          onClick: openContactCreation,
        }
      : activeTab === "properties" && canWriteProperties && !propertyCreateOpen
        ? {
            label: "Nouveau bien",
            icon: Plus,
            onClick: () => {
              setPropertyCreateOpen(true);
              scrollToCrmSection("crm-create-property");
            },
          }
        : activeTab === "overview"
          ? {
              label: dailyPriorities[0] ? dailyPriorities[0].actionLabel : "Ouvrir le pipeline",
              icon: Target,
              onClick: () => {
                if (dailyPriorities[0]) handlePriorityAction(dailyPriorities[0]);
                else changeTab("pipeline");
              },
            }
          : activeTab === "pipeline" && connected
            ? {
                label: "Actualiser",
                icon: RefreshCw,
                onClick: () => void refreshPipeline(),
              }
            : undefined;

  return (
    <main
      className="crm-riviera min-h-dvh overflow-x-clip bg-[var(--crm-riviera-bg-canvas)] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8"
      style={crmRivieraStyle}
    >
      <CrmRivieraHeader
        guardCommercialNavigation={guardCommercialNavigation}
        activeTab={activeTab}
        onTabChange={changeTab}
        statisticsNavigation={activeTab === "statistics" ? <StatisticsSidebarLinks /> : undefined}
        settingsConnected={connected}
        connected={connected}
        loading={loading}
        userName={userName}
        agencyName={agencyName}
        priorityCount={activeTab === "pipeline" ? pipelinePriorityCount : dailyPriorities.length}
        visitCount={overviewSnapshot?.metrics.visits ?? metrics.appointments}
        contactsToQualify={metrics.contactsToQualify}
        contactsReady={metrics.contactsReadyForPipeline}
        selectedContact={selectedContact}
        onCloseContact={() => setSelectedContactId(null)}
        contactSearch={contactSearch}
        onContactSearchChange={setContactSearch}
        onCreateContact={openContactCreation}
        onLogout={() => afterPropertyCreation(() => void logout())}
      />
      <div className="mx-auto w-full min-w-0 px-3 py-4 sm:px-6 sm:py-6 md:ml-60 md:w-[calc(100%-15rem)] lg:px-8 xl:px-10 xl:py-8">

        {!connected ? (
          <section
            aria-label="Configuration du CRM"
            className="mb-5 flex items-start gap-3 border-l-4 border-[#d9a441] bg-[#fff9e8] px-4 py-3 text-sm leading-5 text-[#5f4a19] sm:mb-6"
          >
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              <strong>Supabase non configuré.</strong> Les essais restent dans cette session et le catalogue officiel ne peut pas être modifié.
            </p>
          </section>
        ) : null}

        {offerFeedback ? (
          <p role="status" className="mb-5 rounded-lg bg-[var(--crm-riviera-bg-accent)] px-4 py-3 text-sm font-semibold text-[var(--crm-riviera-text-primary)]">
            {offerFeedback}
          </p>
        ) : null}

        <Tabs value={activeTab} onValueChange={(value) => changeTab(value as AdminTab)} className="w-full min-w-0 gap-6 sm:gap-8">
          {activeTab === "settings" ? (
            <TabsContent value="settings" className="w-full min-w-0">
              <SettingsWorkspace />
            </TabsContent>
          ) : activeTab === "statistics" ? (
            <TabsContent value="statistics" className="w-full min-w-0">
              <StatisticsWorkspace />
            </TabsContent>
          ) : loading ? (
            <CrmLoadingState />
          ) : loadError ? (
            <CrmLoadErrorState message={loadError} />
          ) : (
            <>
              <TabsContent value="overview" className="w-full">
                <BentoDesignDashboard
                  metrics={metrics}
                  overview={overviewSnapshot}
                  setActiveTab={changeTab}
                  priorities={dailyPriorities}
                  pipelineTasks={pipelineTasks}
                  onPriorityAction={handlePriorityAction}
                  onCreateContact={openContactCreation}
                  onboardingProgress={onboardingProgress}
                  onboardingSavingStep={onboardingSavingStep}
                  onboardingError={onboardingError}
                  onToggleOnboardingStep={onboardingProgress
                    ? (step, completed) => void toggleOnboardingStep(step, completed)
                    : undefined}
                />
              </TabsContent>
              <TabsContent value="pipeline" className="w-full">
                <PipelinePanel
                  leads={pipelineLeads}
                  setLeads={setPipelineLeads}
                  tasks={pipelineTasks}
                  setTasks={setPipelineTasks}
                  offers={pipelineOffers}
                  team={teamMembers}
                  metrics={pipelineMetrics}
                  permissions={pipelinePermissions}
                  connected={connected}
                  error={pipelineError}
                  onRefresh={refreshPipeline}
                  onCreateOffer={(lead) =>
                    openOfferComposer({
                      leadId: lead.id,
                      propertyId: lead.linkedPropertyId,
                    })
                  }
                />
              </TabsContent>
              <TabsContent value="contacts">
                {contactCreateOpen ? (
                  <div className="mb-4">
                    <BentoGrid>
                      <CreateContactCard
                        setLeads={setContactLeads}
                        onCreated={setSelectedContactId}
                        connected={connected}
                        open={contactCreateOpen}
                        onOpenChange={setContactCreateOpen}
                        team={teamMembers}
                      />
                    </BentoGrid>
                  </div>
                ) : null}
                <LeadManager
                  title="Contacts"
                  userRole={userRole}
                  description="Demandes entrantes, prospects créés manuellement et suivi commercial rapide."
                  leads={contactLeads}
                  setLeads={setContactLeads}
                  connected={connected}
                  enableQualification
                  onPipelineChanged={refreshPipeline}
                  onOpenPipeline={() => changeTab("pipeline")}
                  contactSearch={contactSearch}
                  onContactSearchChange={setContactSearch}
                  selectedContactId={selectedContactId}
                  onSelectedContactChange={setSelectedContactId}
                  onCreateContact={openContactCreation}
                  activities={activities}
                  pipelineLeads={pipelineLeads}
                  pipelineTasks={pipelineTasks}
                  properties={propertyItems}
                  team={teamMembers}
                />
              </TabsContent>
              <TabsContent value="estimations" className="w-full">
                <BentoGrid>
                  <LeadManager
                    title="Estimations"
                    description="Demandes d'estimation reçues depuis le formulaire public et leur statut de suivi."
                    leads={estimationLeads}
                    setLeads={setEstimationLeads}
                    connected={connected}
                  />
                </BentoGrid>
              </TabsContent>
              <TabsContent value="legacyReview" className="w-full">
                <LegacyReviewPanel connected={connected} />
              </TabsContent>
              <TabsContent value="properties" className="w-full min-w-0">
                <PropertyWorkspace
                  properties={propertyItems}
                  setProperties={setPropertyItems}
                  connected={connected}
                  loading={loading}
                  catalogueError={propertyLoadError || loadError}
                  canWrite={canWriteProperties}
                  canDelete={userRole === "ADMIN" || userRole === "DIRECTOR"}
                  canCreateOffer={pipelinePermissions.canCreateOffers}
                  createOpen={propertyCreateOpen}
                  onCreateOpenChange={setPropertyCreateOpen}
                  registerCreateLeave={registerPropertyCreationLeave}
                  initialPropertyId={initialPropertyId}
                  renderEditor={({ property, onPersist }) => (
                    <PropertyEditorCard
                      key={property.updatedAt}
                      property={property}
                      onPersist={onPersist}
                      connected={connected}
                      canCreateOffers={pipelinePermissions.canCreateOffers}
                      onCreateOffer={(item) => openOfferComposer({ propertyId: item.id })}
                      displayMode="list"
                      initiallyEditing
                    />
                  )}
                />
              </TabsContent>
              <TabsContent value="agenda" className="w-full min-w-0">
                <AgendaWorkspace onChanged={() => { void refreshPipeline(); }} />
              </TabsContent>
              <TabsContent value="activities" className="w-full">
                <ActivityPanel
                  activities={activities}
                  filteredActivities={filteredActivities}
                  recipeActivitiesCount={recipeActivitiesCount}
                  activitySearch={activitySearch}
                  setActivitySearch={setActivitySearch}
                  activityEntityType={activityEntityType}
                  setActivityEntityType={setActivityEntityType}
                  activityAction={activityAction}
                  setActivityAction={setActivityAction}
                  activityPeriod={activityPeriod}
                  setActivityPeriod={setActivityPeriod}
                  activityVisibility={activityVisibility}
                  setActivityVisibility={setActivityVisibility}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
      <OfferComposer
        open={Boolean(offerComposerContext)}
        onOpenChange={(open) => {
          if (!open) setOfferComposerContext(null);
        }}
        leads={pipelineLeads}
        properties={propertyItems}
        team={teamMembers}
        initialLeadId={offerComposerContext?.leadId ?? null}
        initialPropertyId={offerComposerContext?.propertyId ?? null}
        connected={connected}
        onSaved={async (message) => {
          await refreshPipeline();
          setOfferFeedback(message);
        }}
      />
      <CrmMobileNavigation
        guardCommercialNavigation={guardCommercialNavigation}
        activeTab={activeTab}
        onTabChange={changeTab}
        onLogout={() => afterPropertyCreation(() => void logout())}
        quickAction={mobileQuickAction}
      />
    </main>
  );
}

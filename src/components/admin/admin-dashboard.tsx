"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ContactRound,
  Clock,
  Info,
  LayoutDashboard,
  ImagePlus,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
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
import { BentoEmptyState } from "@/components/admin/bento/bento-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  leadPriorities,
  leadPriorityBadgeClasses,
  leadPriorityLabels,
  leadStatusLabels,
  leadStatuses,
} from "@/lib/crm";
import {
  climateUnit,
  dpeBadgeClasses,
  dpeLetters,
  energyUnit,
  formatClimateDiagnostic,
  formatEnergyDiagnostic,
  getClimateAssessment,
  getEnergyAssessment,
  getPropertyDpePosition,
  parseDiagnosticValue,
} from "@/lib/dpe";
import type {
  LegacyCrmReviewSummary,
  MatchCategory,
  PlannedAction,
  SimulatedPayload,
} from "@/lib/legacy-crm-review";
import {
  getPropertyInventoryMetrics,
  getPropertyPublicationBreakdown,
  getPropertyStatusBreakdown,
  getPropertyTypeBreakdown,
  propertyImportSource,
} from "@/lib/property-management";
import { cn } from "@/lib/utils";
import { adminRoleLabels, type AdminRole } from "@/types/admin";
import type {
  Activity,
  AdminTeamMember,
  ContactLead,
  EstimationLead,
  LeadPriority,
  LeadStatus,
  PipelineLead,
  PipelineTask,
  TaskEmailReminderStatus,
  TaskRecurrenceRule,
  TaskReminderChannel,
} from "@/types/crm";

const contactRequestTypes = ["Achat", "Vente", "Estimation", "Terrain", "Autre"] as const;
const propertyTypes = ["apartment", "house", "land", "commercial", "parking", "other"] as const satisfies PropertyType[];
const propertyStatuses = ["available", "under_offer", "sold"] as const satisfies PropertyStatus[];
const propertyPublicationStatuses = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const satisfies PropertyPublicationStatus[];
type AdminTab = "overview" | "pipeline" | "contacts" | "estimations" | "legacyReview" | "properties" | "activities" | "statistics";
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
  team?: AdminTeamMember[];
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

type AdminLead = {
  id: string;
  kind: "contacts" | "estimations";
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  city: string;
  message: string;
  status: LeadStatus;
  notes: string;
  archived: boolean;
};

type ContactFormState = {
  fullName: string;
  email: string;
  phone: string;
  requestType: (typeof contactRequestTypes)[number];
  city: string;
  message: string;
};

const emptyContactForm: ContactFormState = {
  fullName: "",
  email: "",
  phone: "",
  requestType: "Achat",
  city: "",
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

const emptyPropertyForm: PropertyFormState = {
  title: "",
  type: "house",
  status: "available",
  publicationStatus: "DRAFT",
  city: "",
  postalCode: "",
  price: "",
  surface: "",
  landSurface: "",
  rooms: "",
  bedrooms: "",
  bathrooms: "",
  energyClass: "",
  climateClass: "",
  descriptionShort: "",
  descriptionLong: "",
  featuresText: "",
  landOptions: [],
  featured: false,
};

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

function getPropertyFeaturesText(form: PropertyFormState) {
  return getPropertyFeatureList(form).join("\n");
}

function getCommercialStatusFromLegacy(status: PropertyStatus) {
  if (status === "under_offer") return "UNDER_OFFER" as const;
  if (status === "sold") return "SOLD" as const;
  return "AVAILABLE" as const;
}

function upsertProperties(currentItems: Property[], incomingItems: Property[]) {
  const seen = new Set<string>();
  return [...incomingItems, ...currentItems].filter((property) => {
    const key = property.reference || property.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getNextLocalReference(properties: Property[]) {
  const maxReference = properties.reduce((max, property) => {
    if (!/^\d+$/.test(property.reference)) return max;
    return Math.max(max, Number(property.reference));
  }, 0);

  return String(maxReference + 1).padStart(3, "0");
}

function toNumberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / 1024 / 1024).toFixed(1)} Mo`;
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

function buildPropertyPayload(property: Property, form: PropertyFormState, photoUrls = property.photos) {
  return {
    reference: property.reference,
    mandateNumber: property.mandateNumber,
    slug: property.slug,
    sourceUrl: property.sourceUrl,
    ...form,
    featuresText: getPropertyFeaturesText(form),
    photoUrls,
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
    updatedAt: now,
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
  setActiveTab,
}: {
  metrics: AdminMetrics;
  setActiveTab: React.Dispatch<React.SetStateAction<AdminTab>>;
}) {
  const pipelineMax = Math.max(metrics.newLeads, metrics.contactedLeads, metrics.appointments, metrics.mandateSigned, metrics.lostLeads, 1);
  const propertyMax = Math.max(metrics.availableProperties, metrics.underOfferProperties, metrics.soldProperties, metrics.featuredProperties, 1);
  const priorityItems = [
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
        eyebrow="Priorite"
        title="Que doit faire l'agence aujourd'hui ?"
        description="Les actions operationnelles les plus utiles sont regroupees ici pour eviter de chercher dans tout le CRM."
        action={
          <Button type="button" size="sm" className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => setActiveTab("pipeline")}>
            Traiter les leads
          </Button>
        }
      >
        {activePriorityItems.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {activePriorityItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="rounded-xl border border-orange-200 bg-white p-4 text-left transition-colors hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 motion-reduce:transition-none"
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
            description="Les nouveaux leads, photos manquantes et diagnostics incomplets sont sous controle."
          />
        )}
      </BentoCard>

      <BentoCard span="medium" title="Resume de performance" description="Lecture rapide de l'activite commerciale.">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Leads actifs" value={metrics.totalLeads} />
          <KpiCard label="Conversion" value={formatPercentage(metrics.conversionRate)} tone="orange" />
        </div>
        <MetricLine label="Derniere demande" value={formatDateTime(metrics.latestSubmissionDate)} />
        <MetricLine label="Derniere activite" value={formatDateTime(metrics.latestActivityDate)} />
      </BentoCard>

      <BentoCard span="medium" title="Leads urgents" description="Demandes non traitees ou a recontacter.">
        <MetricLine label="Nouveaux" value={metrics.newLeads} max={pipelineMax} />
        <MetricLine label="Contactes" value={metrics.contactedLeads} max={pipelineMax} />
        <MetricLine label="Rendez-vous" value={metrics.appointments} max={pipelineMax} />
        {metrics.newLeads === 0 ? (
          <BentoEmptyState title="Aucun lead urgent" description="Aucune demande nouvelle non traitee." />
        ) : null}
      </BentoCard>

      <BentoCard span="medium" title="Agenda" description="Visites et rendez-vous du jour.">
        <BentoEmptyState title="Aucune visite programmee" description="Le module agenda sera relie aux rendez-vous V3." />
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricLine label="Biens sans photos" value={metrics.propertiesWithoutPhotos} />
          <MetricLine label="Biens sans DPE/GES" value={metrics.propertiesWithoutDiagnostics} />
          <MetricLine label="Biens non mis a la une" value={metrics.propertiesNotFeatured} />
          <MetricLine label="GA4" value="A connecter" />
        </div>
      </BentoCard>
    </BentoGrid>
  );
}

function BentoStatisticsPanel({ metrics }: { metrics: AdminMetrics }) {
  const leadMax = Math.max(metrics.totalLeads, 1);
  const propertyMax = Math.max(metrics.totalProperties, 1);
  const cityMax = Math.max(...metrics.propertiesByCity.map((item) => item.count), 1);
  const leadCityMax = Math.max(...metrics.leadsByCity.map((item) => item.count), 1);
  const activityMax = Math.max(...metrics.activitiesByEntity.map((item) => item.count), 1);

  return (
    <BentoGrid>
      <div className="grid gap-4 md:col-span-6 md:grid-cols-2 xl:col-span-12 xl:grid-cols-4">
        <KpiCard label="Leads actifs" value={metrics.totalLeads} description="Contacts et estimations non archives." />
        <KpiCard label="Conversion mandat" value={formatPercentage(metrics.conversionRate)} tone="orange" />
        <KpiCard label="Prix moyen" value={formatPrice(Math.round(metrics.averagePrice))} />
        <KpiCard
          label="Prix moyen / m2"
          value={metrics.averagePricePerSquareMeter ? `${Math.round(metrics.averagePricePerSquareMeter).toLocaleString("fr-FR")} EUR/m2` : "Non calculable"}
        />
      </div>

      <BentoCard span="wide" title="Performance leads" description="Le graphique principal conserve plus d'espace car il pilote la priorite commerciale.">
        <MetricLine label="Contacts" value={metrics.contacts} max={leadMax} />
        <MetricLine label="Estimations" value={metrics.estimations} max={leadMax} />
        <MetricLine label="Nouveaux" value={metrics.newLeads} max={leadMax} />
        <MetricLine label="Contactes" value={metrics.contactedLeads} max={leadMax} />
        <MetricLine label="Rendez-vous" value={metrics.appointments} max={leadMax} />
        <MetricLine label="Mandats signes" value={metrics.mandateSigned} max={leadMax} />
        <MetricLine label="Perdus" value={metrics.lostLeads} max={leadMax} />
      </BentoCard>

      <BentoCard span="medium" title="Performance formulaires" description="Qualite du volume entrant.">
        <MetricLine label="Demandes contact" value={metrics.contactSubmissions} />
        <MetricLine label="Demandes estimation" value={metrics.estimationSubmissions} />
        <MetricLine label="Ratio estimation/contact" value={Number.isFinite(metrics.estimationContactRatio) ? metrics.estimationContactRatio.toFixed(2) : "Non calculable"} />
        <MetricLine label="Derniere soumission" value={formatDateTime(metrics.latestSubmissionDate)} />
      </BentoCard>

      <BentoCard span="large" title="Portefeuille de biens" description="Repartition des biens par statut et type.">
        <MetricLine label="Disponibles" value={metrics.availableProperties} max={propertyMax} />
        <MetricLine label="Sous offre" value={metrics.underOfferProperties} max={propertyMax} />
        <MetricLine label="Vendus" value={metrics.soldProperties} max={propertyMax} />
        <MetricLine label="A la une" value={metrics.featuredProperties} max={propertyMax} />
        <MetricLine label="Appartements" value={metrics.apartments} max={propertyMax} />
        <MetricLine label="Maisons" value={metrics.houses} max={propertyMax} />
        <MetricLine label="Terrains" value={metrics.lands} max={propertyMax} />
        <MetricLine label="Locaux commerciaux" value={metrics.commercialProperties} max={propertyMax} />
        <MetricLine label="Stationnements" value={metrics.parkingProperties} max={propertyMax} />
        <MetricLine label="Autres biens" value={metrics.otherProperties} max={propertyMax} />
        <MetricLine label="Surface moyenne" value={`${Math.round(metrics.averageSurface)} m2`} />
      </BentoCard>

      <BentoCard span="large" title="Biens par ville" description="Lecture locale du portefeuille.">
        {metrics.propertiesByCity.length ? (
          metrics.propertiesByCity.slice(0, 6).map((item) => (
            <div key={item.city} className="grid gap-2">
              <MetricLine label={item.city} value={item.count} max={cityMax} />
              <p className="text-xs text-gray-500">Prix moyen : {formatPrice(item.averagePrice)}</p>
            </div>
          ))
        ) : (
          <BentoEmptyState title="Aucune ville renseignee" description="Les biens importes alimenteront cette analyse." />
        )}
      </BentoCard>

      <BentoCard span="medium" title="Leads par ville" description="Origine geographique des demandes.">
        {metrics.leadsByCity.length ? (
          metrics.leadsByCity.slice(0, 6).map((item) => (
            <MetricLine key={item.city} label={item.city} value={item.count} max={leadCityMax} />
          ))
        ) : (
          <BentoEmptyState title="Aucune ville renseignee" description="Les prochaines demandes completeront ce bloc." />
        )}
      </BentoCard>

      <BentoCard span="medium" title="Statistiques d'activite" description="Volume et recence des actions CRM.">
        <MetricLine label="Activites totales" value={metrics.totalActivities} />
        {metrics.activitiesByEntity.map((item) => (
          <MetricLine key={item.label} label={item.label} value={item.count} max={activityMax} />
        ))}
        <MetricLine label="Derniere activite" value={formatDateTime(metrics.latestActivityDate)} />
      </BentoCard>

      <BentoCard span="full" variant="muted" title="Statistiques site internet" description="Aucune fausse donnee n'est affichee tant que GA4 n'est pas connecte.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {["Sessions", "Utilisateurs", "Pages vues", "Sources de trafic", "Conversions GA4"].map((label) => (
            <MetricLine key={label} label={label} value="A connecter" />
          ))}
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
  userRole: AdminRole;
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
  }));
}

function CreateContactCard({
  setLeads,
  connected,
}: {
  setLeads: React.Dispatch<React.SetStateAction<AdminLead[]>>;
  connected: boolean;
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
        name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || "Non renseigné",
        category: form.requestType,
        city: form.city.trim() || "Non renseignée",
        message: form.message.trim(),
        status: "NEW",
        notes: "",
        archived: false,
      },
      ...current,
    ]);
  }

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!form.fullName.trim() || !form.email.trim() || !form.message.trim()) {
      setFeedback({
        type: "error",
        message: "Nom, email et message sont nécessaires pour créer un contact.",
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
  }

  return (
    <BentoCard
      span="full"
      title="Créer un contact"
      description="Ajoutez manuellement un prospect reçu par téléphone, email ou passage agence."
    >
      <form onSubmit={(event) => void submitContact(event)} className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-full-name">Nom complet</Label>
              <Input
                id="contact-full-name"
                value={form.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                placeholder="Nom du prospect"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="prospect@email.fr"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-phone">Téléphone</Label>
              <Input
                id="contact-phone"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="06 00 00 00 00"
              />
            </div>
            <div className="grid gap-2">
              <Label>Type de demande</Label>
              <Select
                value={form.requestType}
                onValueChange={(value) =>
                  updateField("requestType", value as ContactFormState["requestType"])
                }
              >
                <SelectTrigger className="w-full">
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
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="contact-city">Ville concernée</Label>
              <Input
                id="contact-city"
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="Solliès-Pont, Toulon, Hyères..."
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              value={form.message}
              onChange={(event) => updateField("message", event.target.value)}
              placeholder="Besoin exprimé, budget, délai, informations utiles..."
            />
          </div>
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
          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full bg-orange-500 text-white hover:bg-orange-600 sm:w-fit"
          >
            <ContactRound className="size-4" />
            {submitting ? "Création..." : "Créer le contact"}
          </Button>
      </form>
    </BentoCard>
  );
}

function CreatePropertyCard({
  properties,
  setProperties,
  connected,
}: {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  connected: boolean;
}) {
  const [form, setForm] = useState<PropertyFormState>(emptyPropertyForm);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPropertyPhoto[]>([]);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const nextReference = getNextLocalReference(properties);
  const isLand = form.type === "land";
  const energyAssessment = isLand ? null : getEnergyAssessment(form.energyClass);
  const climateAssessment = isLand ? null : getClimateAssessment(form.climateClass);
  const dpePosition = isLand ? null : getPropertyDpePosition(form.energyClass, form.climateClass);

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

  function hasRequiredFields() {
    return Boolean(
      form.title.trim() &&
        form.city.trim() &&
        form.postalCode.trim() &&
        form.price.trim() &&
        form.surface.trim() &&
        form.descriptionShort.trim()
    );
  }

  function updateSelectedPhotos(files: FileList | null) {
    setSelectedPhotos(Array.from(files ?? []));
    setUploadedPhotos([]);
  }

  async function uploadSelectedPhotos() {
    if (selectedPhotos.length === 0) return uploadedPhotos;

    if (!connected) {
      setFeedback({
        type: "error",
        message: "Le stockage Supabase doit être connecté pour ajouter des photos depuis l'ordinateur.",
      });
      return null;
    }

    setFeedback({ type: "success", message: "Envoi des photos en cours..." });
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
      setFeedback({
        type: "error",
        message: payload?.message ?? "Les photos n'ont pas pu être envoyées.",
      });
      return null;
    }

    setUploadedPhotos(payload.photos);
    setSelectedPhotos([]);
    setPhotoInputKey((current) => current + 1);
    return payload.photos;
  }

  async function submitProperty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!hasRequiredFields()) {
      setFeedback({
        type: "error",
        message: "Titre, ville, code postal, prix, surface et description courte sont obligatoires.",
      });
      return;
    }

    if (!connected) {
      setFeedback({
        type: "error",
        message: "Supabase doit etre connecte pour creer un bien dans le catalogue officiel.",
      });
      return;
    }

    setSubmitting(true);
    const photos = await uploadSelectedPhotos();
    if (!photos) {
      setSubmitting(false);
      return;
    }
    const photoUrls = photos.map((photo) => photo.url);

    const response = await fetch("/api/admin/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, featuresText: getPropertyFeaturesText(form), photoUrls }),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as {
          message?: string;
          property?: Property;
        } | null)
      : null;
    setSubmitting(false);

    if (!response?.ok || !payload?.property) {
      setFeedback({
        type: "error",
        message: payload?.message ?? "Le bien n'a pas pu être créé.",
      });
      return;
    }

    setProperties((current) => upsertProperties(current, [payload.property!]));
    setForm(emptyPropertyForm);
    setUploadedPhotos([]);
    setPhotoInputKey((current) => current + 1);
    setFeedback({ type: "success", message: payload.message ?? "Bien créé." });
  }

  return (
    <BentoCard
      span="full"
      title="Créer un bien"
      description="La référence sera attribuée automatiquement au moment de l'enregistrement."
      action={
        <Badge className="w-fit border-0 bg-orange-100 text-orange-800">
          Prochaine réf. {nextReference}
        </Badge>
      }
    >
      <form onSubmit={(event) => void submitProperty(event)} className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid gap-2 lg:col-span-2">
              <Label htmlFor="property-title">Titre de l&apos;annonce</Label>
              <Input
                id="property-title"
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Maison familiale avec jardin"
              />
            </div>
            <div className="grid gap-2">
              <Label>Type de bien</Label>
              <Select
                value={form.type}
                onValueChange={(value) => updatePropertyType(value as PropertyType)}
              >
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 text-left text-gray-900">
                    {propertyTypeLabels[form.type]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {propertyTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {propertyTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Statut</Label>
              <Select
                value={form.status}
                onValueChange={(value) => updateField("status", value as PropertyStatus)}
              >
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 text-left text-gray-900">
                    {propertyStatusLabels[form.status]}
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
            <div className="grid gap-2">
              <Label>Publication</Label>
              <Select
                value={form.publicationStatus}
                onValueChange={(value) => updateField("publicationStatus", value as PropertyPublicationStatus)}
              >
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 text-left text-gray-900">
                    {propertyPublicationStatusLabels[form.publicationStatus]}
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
            <div className="grid gap-2">
              <Label htmlFor="property-city">Ville</Label>
              <Input
                id="property-city"
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="Solliès-Pont"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="property-postal-code">Code postal</Label>
              <Input
                id="property-postal-code"
                value={form.postalCode}
                onChange={(event) => updateField("postalCode", event.target.value)}
                placeholder="83210"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="property-price">Prix affiché honoraires inclus</Label>
              <Input
                id="property-price"
                inputMode="numeric"
                value={form.price}
                onChange={(event) => updateField("price", event.target.value)}
                placeholder="450000"
              />
              <p className="text-xs leading-5 text-gray-500">
                Anciennement “Prix FAI” : frais d&apos;agence inclus dans le prix affiché.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="property-surface">
                {isLand ? "Surface du terrain" : "Surface habitable"}
              </Label>
              <Input
                id="property-surface"
                inputMode="decimal"
                value={form.surface}
                onChange={(event) => updateField("surface", event.target.value)}
                placeholder={isLand ? "650" : "120"}
              />
              <p className="text-xs text-gray-500">
                {isLand ? "Surface du terrain en m²." : "Surface habitable en m²."}
              </p>
            </div>
            {!isLand ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="property-land-surface">Surface terrain</Label>
                  <Input
                    id="property-land-surface"
                    inputMode="decimal"
                    value={form.landSurface}
                    onChange={(event) => updateField("landSurface", event.target.value)}
                    placeholder="650"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="property-rooms">Pièces</Label>
                  <Input
                    id="property-rooms"
                    inputMode="numeric"
                    value={form.rooms}
                    onChange={(event) => updateField("rooms", event.target.value)}
                    placeholder="5"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="property-bedrooms">Chambres</Label>
                  <Input
                    id="property-bedrooms"
                    inputMode="numeric"
                    value={form.bedrooms}
                    onChange={(event) => updateField("bedrooms", event.target.value)}
                    placeholder="3"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="property-bathrooms">Salles d&apos;eau</Label>
                  <Input
                    id="property-bathrooms"
                    inputMode="numeric"
                    value={form.bathrooms}
                    onChange={(event) => updateField("bathrooms", event.target.value)}
                    placeholder="2"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="property-energy">Consommation énergie</Label>
                  <div className="relative">
                    <Input
                      id="property-energy"
                      inputMode="decimal"
                      value={form.energyClass}
                      onChange={(event) => updateField("energyClass", event.target.value)}
                      placeholder="120"
                      className="pr-32"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-semibold text-gray-500 sm:text-xs">
                      {energyUnit}
                    </span>
                  </div>
                  {energyAssessment ? (
                    <p className="text-xs font-medium text-gray-600">
                      Classe {energyAssessment.letter} · tranche {energyAssessment.range} {energyAssessment.unit}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Entrez uniquement le nombre du diagnostic.</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="property-climate">Émissions climat</Label>
                  <div className="relative">
                    <Input
                      id="property-climate"
                      inputMode="decimal"
                      value={form.climateClass}
                      onChange={(event) => updateField("climateClass", event.target.value)}
                      placeholder="4"
                      className="pr-36"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-semibold text-gray-500 sm:text-xs">
                      {climateUnit}
                    </span>
                  </div>
                  {climateAssessment ? (
                    <p className="text-xs font-medium text-gray-600">
                      Classe {climateAssessment.letter} · tranche {climateAssessment.range} {climateAssessment.unit}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Entrez uniquement le nombre du diagnostic GES.</p>
                  )}
                </div>
              </>
            ) : null}
          </div>
          {!isLand ? (
            <div className="grid gap-4 rounded-xl border border-orange-100 bg-orange-50/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#111111]">Baromètre DPE automatique</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    La position retenue correspond au résultat le plus défavorable entre énergie et climat.
                  </p>
                </div>
                {dpePosition ? (
                  <Badge className={cn("w-fit border-0 px-3 py-1 text-sm", dpeBadgeClasses[dpePosition.letter])}>
                    Classe {dpePosition.letter}
                  </Badge>
                ) : (
                  <Badge className="w-fit border border-orange-100 bg-white text-gray-700">
                    En attente de saisie
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dpeLetters.map((letter) => {
                  const isActive = dpePosition?.letter === letter;

                  return (
                    <div
                      key={letter}
                      className={cn(
                        "rounded-md px-2 py-2 text-center text-xs font-black shadow-sm ring-offset-2 transition",
                        dpeBadgeClasses[letter],
                        isActive ? "scale-105 ring-2 ring-orange-500" : "opacity-70"
                      )}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-orange-100 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Énergie
                  </p>
                  {energyAssessment ? (
                    <p className="mt-1 text-sm font-semibold text-[#111111]">
                      {energyAssessment.value} {energyAssessment.unit} · classe {energyAssessment.letter}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-600">Valeur énergie non renseignée.</p>
                  )}
                </div>
                <div className="rounded-lg border border-orange-100 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Climat
                  </p>
                  {climateAssessment ? (
                    <p className="mt-1 text-sm font-semibold text-[#111111]">
                      {climateAssessment.value} {climateAssessment.unit} · classe {climateAssessment.letter}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-600">Valeur climat non renseignée.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-lg bg-white p-2 text-orange-600">
                  <Info className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#111111]">Mode terrain sélectionné</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    Le DPE n&apos;est pas demandé ici. La fiche met plutôt l&apos;accent sur les informations utiles à la vente d&apos;un terrain.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {landSaleOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => toggleLandOption(option.label)}
                    className={cn(
                      "flex gap-2 rounded-lg border p-3 text-left text-sm transition",
                      form.landOptions.includes(option.label)
                        ? "border-orange-300 bg-white text-[#111111] shadow-sm"
                        : "border-orange-100 bg-white/75 text-gray-700 hover:border-orange-200 hover:bg-white"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs font-black",
                        form.landOptions.includes(option.label)
                          ? "border-orange-500 bg-orange-500 text-white"
                          : "border-orange-200 text-transparent"
                      )}
                    >
                      ✓
                    </span>
                    <span>
                      <strong className="block">{option.label}</strong>
                      <span className="mt-1 block text-xs leading-5 text-gray-500">{option.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="property-description-short">Description courte</Label>
              <Textarea
                id="property-description-short"
                value={form.descriptionShort}
                onChange={(event) => updateField("descriptionShort", event.target.value)}
                placeholder="Résumé visible dans les cartes du site."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="property-description-long">Description complète</Label>
              <Textarea
                id="property-description-long"
                value={form.descriptionLong}
                onChange={(event) => updateField("descriptionLong", event.target.value)}
                placeholder="Texte détaillé de présentation du bien."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="property-features">Atouts du bien</Label>
              <Textarea
                id="property-features"
                value={form.featuresText}
                onChange={(event) => updateField("featuresText", event.target.value)}
                placeholder={
                  isLand
                    ? "Terrain constructible\nViabilisation à préciser\nBornage à confirmer\nLibre constructeur"
                    : "Piscine\nTerrasse\nGarage\nVue dégagée"
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="property-photos">Photos</Label>
              <Input
                key={photoInputKey}
                id="property-photos"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => updateSelectedPhotos(event.target.files)}
                className="h-auto cursor-pointer py-2"
              />
              <p className="text-xs text-gray-500">
                JPG, PNG, WebP ou AVIF. Maximum 12 photos, 8 Mo par photo.
              </p>
              {selectedPhotos.length > 0 ? (
                <div className="grid gap-2 rounded-lg border border-orange-100 bg-orange-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                    {selectedPhotos.length} photo(s) sélectionnée(s)
                  </p>
                  {selectedPhotos.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 text-xs text-gray-700">
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {uploadedPhotos.length > 0 ? (
                <div className="grid gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    {uploadedPhotos.length} photo(s) stockée(s)
                  </p>
                  {uploadedPhotos.map((photo) => (
                    <div key={photo.path} className="flex items-center gap-2 text-xs text-emerald-800">
                      <ImagePlus className="size-3.5" />
                      <span className="truncate">{photo.name}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <label className="flex w-fit items-center gap-3 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-sm font-semibold text-[#111111]">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(event) => updateField("featured", event.target.checked)}
              className="size-4 accent-orange-500"
            />
            Mettre ce bien à la une
          </label>
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
          <Button
            type="submit"
            disabled={submitting}
            className="h-11 w-full bg-orange-500 text-white hover:bg-orange-600 sm:w-fit"
          >
            <Plus className="size-4" />
            {submitting ? "Création..." : "Créer le bien"}
          </Button>
      </form>
    </BentoCard>
  );
}

function PropertyEditorCard({
  property,
  connected,
  onPersist,
}: {
  property: Property;
  connected: boolean;
  onPersist: (property: Property) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PropertyFormState>(() => propertyToForm(property));
  const [photoOrder, setPhotoOrder] = useState<string[]>(() => property.photos);
  const [removedPhotoUrls, setRemovedPhotoUrls] = useState<string[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const isLand = form.type === "land";

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
    const nextProperty = { ...property, ...updates, updatedAt: new Date().toISOString() };
    await onPersist(nextProperty);
  }

  return (
    <Card className="border-orange-100 bg-white">
      <CardContent className="grid gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-gray-500">Réf. {property.reference} · Mandat {property.mandateNumber}</p>
            <p className="mt-1 font-bold text-[#111111]">{property.title}</p>
            <p className="mt-1 text-sm text-gray-600">{property.city} · {formatNumber(property.surface)} m² · {propertyTypeLabels[property.type]}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Badge className="border-0 bg-orange-100 text-orange-800">{propertyStatusLabels[property.status]}</Badge>
            <Badge className={cn("w-fit", propertyPublicationStatusBadgeClasses[property.publicationStatus ?? "DRAFT"])}>
              {propertyPublicationStatusLabels[property.publicationStatus ?? "DRAFT"]}
            </Badge>
          </div>
        </div>

        <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-5">
          <p><strong>Prix</strong><br />{formatPrice(property.price)}</p>
          <p><strong>Pièces</strong><br />{property.rooms ?? "Non renseigné"}</p>
          <p><strong>Photos</strong><br />{property.photos.length}</p>
          <p><strong>Publication</strong><br />{propertyPublicationStatusLabels[property.publicationStatus ?? "DRAFT"]}</p>
          <p><strong>Mise en avant</strong><br />{property.featured ? "Oui" : "Non"}</p>
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

function PropertyManager({
  properties,
  setProperties,
  connected,
}: {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  connected: boolean;
}) {
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const propertyInventoryMetrics = useMemo(() => getPropertyInventoryMetrics(properties), [properties]);
  const propertyStatusBreakdown = useMemo(() => getPropertyStatusBreakdown(properties), [properties]);
  const propertyPublicationBreakdown = useMemo(() => getPropertyPublicationBreakdown(properties), [properties]);
  const propertyTypeBreakdown = useMemo(() => getPropertyTypeBreakdown(properties), [properties]);
  const filteredProperties = properties.filter((property) => {
    const haystack = [
      property.reference,
      property.mandateNumber,
      property.title,
      property.city,
      property.postalCode,
      propertyTypeLabels[property.type],
      propertyStatusLabels[property.status],
      propertyPublicationStatusLabels[property.publicationStatus ?? "DRAFT"],
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.toLowerCase());
  });

  async function persistProperty(property: Property) {
    if (!connected) {
      void property;
      setFeedback("Modification refusee : Supabase doit etre connecte pour enregistrer le catalogue officiel.");
      return false;
    }

    const response = await fetch("/api/admin/properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPropertyPayload(property, propertyToForm(property), property.photos)),
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as {
          message?: string;
          property?: Property;
        } | null)
      : null;

    if (!response?.ok || !payload?.property) {
      setFeedback(payload?.message ?? "La modification du bien n'a pas pu être enregistrée.");
      return false;
    }

    setProperties((current) => upsertProperties(current, [payload.property!]));
    setFeedback(payload.message ?? "Bien mis à jour.");
    return true;
  }

  return (
    <BentoGrid>
      <CreatePropertyCard
        properties={properties}
        setProperties={setProperties}
        connected={connected}
      />

      {propertyInventoryMetrics.map((metric) => (
        <BentoKpiCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          description={metric.description}
          span="medium"
        />
      ))}

      <BentoCard
        span="full"
        variant="muted"
        title="Source catalogue"
        description="Suivi de la transition vers un catalogue 100 % Supabase."
      >
        <div className="grid gap-2 text-sm text-gray-700">
          <p><strong>{propertyImportSource.name}</strong></p>
          <p>Source actuelle : <span className="font-mono text-xs">Supabase public_properties</span></p>
          <p>Source cible : {propertyImportSource.futureSource}</p>
          <p>
            Publication :{" "}
            {propertyPublicationBreakdown.map((item) => `${item.label} ${item.count}`).join(" / ")}
          </p>
          <p className="text-gray-500">{propertyImportSource.note}</p>
        </div>
      </BentoCard>

      <BentoCard span="large" title="Répartition par statut">
        <div className="grid gap-3">
          {propertyStatusBreakdown.map((item) => (
            <p key={item.key} className="flex items-center justify-between border-b border-orange-100 pb-2 text-sm">
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </p>
          ))}
        </div>
      </BentoCard>

      <BentoCard span="large" title="Répartition par type">
        <div className="grid gap-3">
          {propertyTypeBreakdown.map((item) => (
            <p key={item.key} className="flex items-center justify-between border-b border-orange-100 pb-2 text-sm">
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </p>
          ))}
        </div>
      </BentoCard>

      <BentoCard
        span="full"
        title="Catalogue des biens"
        description="Recherche, disponibilité, mise à la une et édition rapide des biens."
        contentClassName="gap-5"
      >
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-gray-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un bien par référence, ville, titre ou statut"
            className="pl-9"
          />
        </div>

        {feedback ? (
          <p className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {feedback}
          </p>
        ) : null}

        {filteredProperties.length === 0 ? (
          <BentoEmptyState
            icon={<Building2 className="size-5" />}
            title="Aucun bien trouvé"
            description="Modifiez la recherche ou créez un nouveau bien."
            className="py-12"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredProperties.map((property) => (
              <PropertyEditorCard
                key={`${property.reference}-${property.updatedAt}`}
                property={property}
                connected={connected}
                onPersist={persistProperty}
              />
            ))}
          </div>
        )}
      </BentoCard>
    </BentoGrid>
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
  team,
  connected,
  error,
  onRefresh,
}: {
  leads: PipelineLead[];
  setLeads: React.Dispatch<React.SetStateAction<PipelineLead[]>>;
  tasks: PipelineTask[];
  setTasks: React.Dispatch<React.SetStateAction<PipelineTask[]>>;
  team: AdminTeamMember[];
  connected: boolean;
  error: string;
  onRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [assignee, setAssignee] = useState("ALL");
  const [feedback, setFeedback] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, PipelineTaskDraft>>({});
  const teamById = useMemo(() => new Map(team.map((member) => [member.id, member])), [team]);
  const leadsById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const tasksByLead = useMemo(() => groupTasksByLead(tasks), [tasks]);
  const activeLeads = leads.filter((lead) => !lead.archived);
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
    const haystack = [
      lead.contactName,
      lead.contactEmail,
      lead.contactPhone,
      lead.city,
      lead.title,
      lead.requestType,
      lead.projectType,
      lead.sourceCode,
      lead.linkedPropertyTitle,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    const matchesStatus = status === "ALL" || lead.status === status;
    const matchesAssignee =
      assignee === "ALL" ||
      (assignee === "UNASSIGNED" ? !lead.assignedTo : lead.assignedTo === assignee);

    return matchesSearch && matchesStatus && matchesAssignee;
  });
  const dailyTasks = sortTasksByUrgency([...overdueTasks, ...todayRemainingTasks]).slice(0, 8);
  const unassignedPreview = unassignedLeads.slice(0, 6);

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
      if (response?.status === 401) window.location.assign("/admin/login");
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
      if (response?.status === 401) window.location.assign("/admin/login");
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
      if (response?.status === 401) window.location.assign("/admin/login");
      setFeedback(payload?.message ?? "Le rappel n'a pas pu etre mis a jour.");
      return;
    }

    setFeedback(payload?.message ?? "Rappel mis a jour.");
  }

  return (
    <BentoGrid>
      <div className="grid gap-4 md:col-span-6 md:grid-cols-2 xl:col-span-12 xl:grid-cols-4">
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

function LeadManager({
  leads,
  setLeads,
  connected,
  title,
  description,
}: {
  leads: AdminLead[];
  setLeads: React.Dispatch<React.SetStateAction<AdminLead[]>>;
  connected: boolean;
  title: string;
  description: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [feedback, setFeedback] = useState("");
  const visible = leads.filter((lead) => {
    const haystack = `${lead.name} ${lead.email} ${lead.city} ${lead.category}`.toLowerCase();
    return !lead.archived && haystack.includes(search.toLowerCase()) && (status === "ALL" || lead.status === status);
  });

  async function persist(lead: AdminLead, updates: Partial<AdminLead>) {
    setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, ...updates } : item));
    if (!connected) {
      setFeedback("Modification conservée dans cette session locale.");
      return;
    }
    const response = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: lead.kind, id: lead.id, ...updates }),
    });
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    setFeedback(payload?.message ?? (response.ok ? "Mise à jour enregistrée." : "Mise à jour impossible."));
  }

  return (
    <BentoCard span="full" title={title} description={description} contentClassName="gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-gray-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un nom, une ville, un email" className="pl-9" /></div>
        <Select value={status} onValueChange={(value) => setStatus(value ?? "ALL")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>{(value) => getStatusSelectLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent><SelectItem value="ALL">Tous les statuts</SelectItem>{leadStatuses.map((value) => <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {feedback ? <p className="rounded-md bg-orange-50 p-3 text-sm text-orange-800">{feedback}</p> : null}
      {visible.length === 0 ? (
        <BentoEmptyState
          icon={<ContactRound className="size-5" />}
          title="Aucun prospect dans cette vue"
          description="Les prochaines demandes apparaîtront ici automatiquement."
          className="py-12"
        />
      ) : visible.map((lead) => (
        <article key={lead.id} className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm shadow-orange-100/40 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-lg font-bold text-[#111111]">{lead.name}</p><p className="mt-1 text-sm text-gray-500">{new Date(lead.createdAt).toLocaleString("fr-FR")} · {lead.city}</p></div>
            <Badge className="w-fit border-0 bg-orange-100 text-orange-800">{leadStatusLabels[lead.status]}</Badge>
          </div>
          <div className="mt-5 grid gap-5">
            <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-3"><p><strong>Email</strong><br />{lead.email}</p><p><strong>Téléphone</strong><br />{lead.phone}</p><p><strong>Demande</strong><br />{lead.category}</p></div>
            <p className="break-words rounded-md bg-orange-50 p-4 text-sm leading-6 text-gray-700">{lead.message}</p>
            <div className="grid gap-3 lg:grid-cols-[200px_1fr_auto_auto] lg:items-end">
              <div className="grid gap-2"><Label>Statut</Label><Select value={lead.status} onValueChange={(value) => persist(lead, { status: value as LeadStatus })}><SelectTrigger><SelectValue>{(value) => getStatusSelectLabel(value)}</SelectValue></SelectTrigger><SelectContent>{leadStatuses.map((value) => <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2"><Label htmlFor={`notes-${lead.id}`}>Notes internes</Label><Input id={`notes-${lead.id}`} value={lead.notes} onChange={(event) => setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, notes: event.target.value } : item))} /></div>
              <Button variant="outline" onClick={() => persist(lead, { notes: lead.notes })}><Save className="size-4" />Sauver</Button>
              <Button variant="outline" onClick={() => persist(lead, { archived: true })}><Archive className="size-4" />Archiver</Button>
            </div>
          </div>
        </article>
      ))}
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
      if (response?.status === 401) window.location.assign("/admin/login");
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

export function AdminDashboard({ contacts, estimations, activities: initialActivities, properties, connected, userName, userRole }: Props) {
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(connected);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [contactLeads, setContactLeads] = useState(() => normalizeContacts(contacts));
  const [estimationLeads, setEstimationLeads] = useState(() => normalizeEstimations(estimations));
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLead[]>([]);
  const [pipelineTasks, setPipelineTasks] = useState<PipelineTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<AdminTeamMember[]>([]);
  const [pipelineError, setPipelineError] = useState("");
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
  const filteredActivities = useMemo(
    () => filterActivities(activities, activitySearch, activityEntityType, activityAction, activityPeriod, activityVisibility),
    [activities, activityAction, activityEntityType, activityPeriod, activitySearch, activityVisibility]
  );

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
      if (response?.status === 401) window.location.assign("/admin/login");
      setPipelineError(payload?.message ?? "Le pipeline CRM n'a pas pu etre charge.");
      return;
    }

    setPipelineLeads(payload.leads ?? []);
    setPipelineTasks(payload.tasks ?? []);
    setTeamMembers(payload.team ?? []);
  }

  useEffect(() => {
    if (!connected) {
      return;
    }

    let cancelled = false;

    async function loadCrmData() {
      setLoading(true);
      setLoadError("");

      const [response, propertiesResponse, pipelineResponse] = await Promise.all([
        fetch("/api/admin/leads"),
        fetch("/api/admin/properties"),
        fetch("/api/admin/pipeline"),
      ]);
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        contacts?: ContactLead[];
        estimations?: EstimationLead[];
        activities?: Activity[];
      } | null;
      const propertiesPayload = (await propertiesResponse.json().catch(() => null)) as {
        properties?: Property[];
      } | null;
      const pipelinePayload = (await pipelineResponse.json().catch(() => null)) as PipelineResponse | null;

      if (cancelled) return;
      setLoading(false);

      if (!response.ok) {
        setLoadError(payload?.message ?? "Le CRM n'a pas pu etre charge.");
        if (response.status === 401) window.location.assign("/admin/login");
        return;
      }

      setContactLeads(normalizeContacts(payload?.contacts ?? []));
      setEstimationLeads(normalizeEstimations(payload?.estimations ?? []));
      setActivities(payload?.activities ?? []);

      if (propertiesResponse.ok) {
        setPropertyItems(propertiesPayload?.properties ?? []);
      }

      if (pipelineResponse.ok && pipelinePayload?.success) {
        setPipelineError("");
        setPipelineLeads(pipelinePayload.leads ?? []);
        setPipelineTasks(pipelinePayload.tasks ?? []);
        setTeamMembers(pipelinePayload.team ?? []);
      } else {
        if (pipelineResponse.status === 401) window.location.assign("/admin/login");
        setPipelineError(pipelinePayload?.message ?? "Le pipeline CRM n'a pas pu etre charge.");
      }
    }

    void loadCrmData();

    return () => {
      cancelled = true;
    };
  }, [connected, properties]);

  async function logout() {
    const response = await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as { redirectTo?: string } | null)
      : null;

    window.location.assign(payload?.redirectTo ?? "/admin/login");
  }
  return (
    <main className="min-h-dvh overflow-x-hidden bg-orange-50 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-screen-2xl min-w-0">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:mb-10 sm:flex-row sm:items-center">
          <div>
            <Badge className={connected ? "border-0 bg-emerald-600 text-white" : "border-0 bg-yellow-300 text-[#111111]"}>
              {connected ? "Supabase connecté" : "Mode local"}
            </Badge>
            <h1 className="mt-3 text-3xl font-black text-[#111111] sm:text-4xl">CRM IMMO-DREAMS83</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">Prospects, estimations, biens, statistiques et activité de l&apos;agence.</p>
          </div>
          <Button variant="outline" onClick={() => void logout()} className="w-full border-orange-200 bg-white sm:w-auto">
            <LogOut className="size-4" />Déconnexion
          </Button>
        </header>
        <div className="mb-6 grid gap-3 rounded-lg border border-orange-100 bg-white p-4 text-sm text-gray-700 shadow-sm shadow-orange-100/40 sm:grid-cols-[1fr_auto] sm:items-center">
          <p>
            Connecté : <strong className="text-[#111111]">{userName}</strong> · rôle{" "}
            <strong className="text-[#111111]">{adminRoleLabels[userRole]}</strong>
          </p>
          {loading ? <Badge className="w-fit border-0 bg-orange-100 text-orange-800">Chargement CRM...</Badge> : null}
          {loadError ? <p className="text-sm font-semibold text-red-700 sm:col-span-2">{loadError}</p> : null}
        </div>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AdminTab)} className="w-full min-w-0 gap-6 sm:gap-8">
          <div className="w-full min-w-0">
            <TabsList className="!grid h-auto w-full grid-cols-2 gap-1 bg-white p-1 shadow-sm shadow-orange-100/40 sm:grid-cols-3 lg:!inline-flex lg:w-full lg:justify-start">
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="overview"><LayoutDashboard />Vue d&apos;ensemble</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="pipeline"><Target />Pipeline</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="contacts"><ContactRound />Contacts</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="estimations"><ClipboardCheck />Estimations</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="legacyReview"><ListChecks />Anciennes demandes</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="properties"><Building2 />Biens</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="activities"><ListChecks />Activités</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="statistics"><BarChart3 />Statistiques</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="overview" className="w-full">
            <BentoDesignDashboard metrics={metrics} setActiveTab={setActiveTab} />
          </TabsContent>
          <TabsContent value="pipeline" className="w-full">
            <PipelinePanel
              leads={pipelineLeads}
              setLeads={setPipelineLeads}
              tasks={pipelineTasks}
              setTasks={setPipelineTasks}
              team={teamMembers}
              connected={connected}
              error={pipelineError}
              onRefresh={refreshPipeline}
            />
          </TabsContent>
          <TabsContent value="contacts">
            <BentoGrid>
              <CreateContactCard setLeads={setContactLeads} connected={connected} />
              <LeadManager
                title="Contacts"
                description="Demandes entrantes, prospects créés manuellement et suivi commercial rapide."
                leads={contactLeads}
                setLeads={setContactLeads}
                connected={connected}
              />
            </BentoGrid>
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
          <TabsContent value="properties" className="w-full">
            <PropertyManager properties={propertyItems} setProperties={setPropertyItems} connected={connected} />
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
          <TabsContent value="statistics" className="w-full">
            <BentoStatisticsPanel metrics={metrics} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

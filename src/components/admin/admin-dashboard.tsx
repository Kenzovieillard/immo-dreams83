"use client";

import Image from "next/image";
import { type ReactNode, useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  ClipboardCheck,
  ContactRound,
  Info,
  KeyRound,
  LayoutDashboard,
  ImagePlus,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  formatNumber,
  formatPrice,
  type Property,
  type PropertyStatus,
  type PropertyType,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/data/properties";
import { leadStatusLabels, leadStatuses } from "@/lib/crm";
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
import {
  getPropertyInventoryMetrics,
  getPropertyStatusBreakdown,
  getPropertyTypeBreakdown,
  propertyImportSource,
} from "@/lib/property-management";
import { cn } from "@/lib/utils";
import type { Activity, ContactLead, EstimationLead, LeadStatus } from "@/types/crm";

const contactRequestTypes = ["Achat", "Vente", "Estimation", "Terrain", "Autre"] as const;
const propertyTypes = ["apartment", "house", "land"] as const satisfies PropertyType[];
const propertyStatuses = ["available", "under_offer", "sold"] as const satisfies PropertyStatus[];
type AdminTab = "overview" | "contacts" | "estimations" | "properties" | "activities" | "statistics";
type ActivityEntityTypeFilter = "ALL" | "contact" | "estimation" | "property" | "other";
type ActivityActionFilter = "ALL" | "created" | "updated" | "archived" | "uploaded" | "deleted" | "other";
type ActivityPeriodFilter = "ALL" | "today" | "last7days" | "last30days";

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

function mergeProperties(staticItems: Property[], remoteItems: Property[]) {
  const seen = new Set<string>();
  return [...remoteItems, ...staticItems].filter((property) => {
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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    updatedAt: now,
  };
}

function buildLocalProperty(form: PropertyFormState, currentProperties: Property[], photoUrls: string[]): Property {
  const now = new Date().toISOString();
  const reference = getNextLocalReference(currentProperties);
  const isLand = form.type === "land";
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `local-property-${Date.now()}`;

  return {
    id,
    reference,
    slug: `${slugify(form.title)}-${slugify(form.city)}-${form.postalCode}-ref-${reference}`,
    title: form.title.trim(),
    type: form.type,
    transactionType: "sale",
    status: form.status,
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    price: toNumberOrNull(form.price) ?? 0,
    feesIncluded: true,
    surface: toNumberOrNull(form.surface) ?? 0,
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
    sourceUrl: "",
    createdAt: now,
    updatedAt: now,
    mandateNumber: reference,
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
  period: ActivityPeriodFilter
) {
  const normalizedSearch = search.trim().toLowerCase();

  return activities.filter((activity) => {
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
  return (
    <Card size="sm" className="border-orange-100 bg-white shadow-sm shadow-orange-100/40">
      <CardContent className="p-4">
        <p className="text-xs font-semibold leading-5 text-gray-500 sm:text-sm">{label}</p>
        <p className={cn("mt-2 text-2xl font-black sm:text-3xl", tone === "orange" ? "text-orange-600" : "text-[#111111]")}>
          {value}
        </p>
        {description ? <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p> : null}
      </CardContent>
    </Card>
  );
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

function DashboardBento({
  metrics,
  setActiveTab,
}: {
  metrics: AdminMetrics;
  setActiveTab: React.Dispatch<React.SetStateAction<AdminTab>>;
}) {
  const pipelineMax = Math.max(metrics.newLeads, metrics.contactedLeads, metrics.appointments, metrics.mandateSigned, metrics.lostLeads, 1);
  const propertyMax = Math.max(metrics.availableProperties, metrics.underOfferProperties, metrics.soldProperties, metrics.featuredProperties, 1);

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
      <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40 lg:col-span-5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-[#111111]">Pipeline commercial</CardTitle>
          <p className="text-sm leading-6 text-gray-600">Lecture rapide des prospects actifs et de leur avancement.</p>
        </CardHeader>
        <CardContent className="grid gap-4 px-4 sm:px-5">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Leads actifs" value={metrics.totalLeads} />
            <KpiCard label="Conversion mandat" value={formatPercentage(metrics.conversionRate)} tone="orange" />
          </div>
          <MetricLine label="Nouveaux" value={metrics.newLeads} max={pipelineMax} />
          <MetricLine label="Contactés" value={metrics.contactedLeads} max={pipelineMax} />
          <MetricLine label="Rendez-vous" value={metrics.appointments} max={pipelineMax} />
          <MetricLine label="Mandats signés" value={metrics.mandateSigned} max={pipelineMax} />
        </CardContent>
      </Card>

      <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-xl font-black text-[#111111]">Portefeuille de biens</CardTitle>
          <p className="text-sm leading-6 text-gray-600">Disponibilité, mise en avant et valeur catalogue.</p>
        </CardHeader>
        <CardContent className="grid gap-4 px-4 sm:px-5">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Biens" value={metrics.totalProperties} />
            <KpiCard label="Prix moyen" value={formatPrice(Math.round(metrics.averagePrice))} tone="orange" />
          </div>
          <MetricLine label="Disponibles" value={metrics.availableProperties} max={propertyMax} />
          <MetricLine label="Sous offre" value={metrics.underOfferProperties} max={propertyMax} />
          <MetricLine label="Vendus" value={metrics.soldProperties} max={propertyMax} />
          <MetricLine label="À la une" value={metrics.featuredProperties} max={propertyMax} />
          <p className="rounded-xl bg-orange-50 p-3 text-sm text-gray-700">
            Surface moyenne : <strong>{Math.round(metrics.averageSurface)} m²</strong>
          </p>
        </CardContent>
      </Card>

      <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-xl font-black text-[#111111]">Actions rapides</CardTitle>
          <p className="text-sm leading-6 text-gray-600">Accès direct aux vues de travail.</p>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button type="button" variant="outline" className="justify-start border-orange-200" onClick={() => setActiveTab("contacts")}>
            <ContactRound className="size-4" />Voir contacts
          </Button>
          <Button type="button" variant="outline" className="justify-start border-orange-200" onClick={() => setActiveTab("estimations")}>
            <ClipboardCheck className="size-4" />Voir estimations
          </Button>
          <Button type="button" variant="outline" className="justify-start border-orange-200" onClick={() => setActiveTab("properties")}>
            <Building2 className="size-4" />Gérer les biens
          </Button>
          <Button type="button" variant="outline" className="justify-start border-orange-200" onClick={() => setActiveTab("statistics")}>
            <BarChart3 className="size-4" />Voir statistiques
          </Button>
        </CardContent>
      </Card>

      <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40 lg:col-span-6">
        <CardHeader>
          <CardTitle className="text-xl font-black text-[#111111]">Dernières demandes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {metrics.latestLeads.length ? metrics.latestLeads.map((lead) => <LeadPreview key={`${lead.kind}-${lead.id}`} lead={lead} />) : (
            <p className="rounded-xl bg-orange-50 p-4 text-sm text-gray-600">Aucune demande active pour le moment.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40 lg:col-span-6">
        <CardHeader>
          <CardTitle className="text-xl font-black text-[#111111]">Activité récente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {metrics.latestActivities.length ? metrics.latestActivities.map((activity) => <ActivityPreview key={activity.id} activity={activity} />) : (
            <p className="rounded-xl bg-orange-50 p-4 text-sm text-gray-600">Aucune activité enregistrée pour le moment.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-xl font-black text-[#111111]">Performance du site</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {["Sessions", "Vues", "Pages populaires"].map((label) => (
            <MetricLine key={label} label={label} value="À connecter" />
          ))}
          <MetricLine label="Leads CRM" value={metrics.totalLeads} />
          <p className="rounded-xl bg-orange-50 p-3 text-xs leading-5 text-gray-600">
            Connexion GA4 prévue pour une prochaine version.
          </p>
        </CardContent>
      </Card>

      <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-xl font-black text-[#111111]">Origine des demandes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <MetricLine label="Formulaire contact" value={metrics.contactSubmissions} />
          <MetricLine label="Formulaire estimation" value={metrics.estimationSubmissions} />
          <MetricLine label="Appel direct" value="À structurer" />
          <MetricLine label="Agence" value="À structurer" />
        </CardContent>
      </Card>

      <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-xl font-black text-[#111111]">Points à traiter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <MetricLine label="Nouveaux leads" value={metrics.newLeads} />
          <MetricLine label="Biens sans photos" value={metrics.propertiesWithoutPhotos} />
          <MetricLine label="Biens sans DPE/GES" value={metrics.propertiesWithoutDiagnostics} />
          <MetricLine label="Biens non mis à la une" value={metrics.propertiesNotFeatured} />
          <MetricLine label="Multidiffusion portails" value="Non configurée" />
        </CardContent>
      </Card>
    </div>
  );
}

function StatisticsPanel({ metrics }: { metrics: AdminMetrics }) {
  const leadMax = Math.max(metrics.totalLeads, 1);
  const propertyMax = Math.max(metrics.totalProperties, 1);
  const cityMax = Math.max(...metrics.propertiesByCity.map((item) => item.count), 1);
  const leadCityMax = Math.max(...metrics.leadsByCity.map((item) => item.count), 1);
  const activityMax = Math.max(...metrics.activitiesByEntity.map((item) => item.count), 1);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Leads actifs" value={metrics.totalLeads} description="Contacts et estimations non archivés." />
        <KpiCard label="Conversion mandat" value={formatPercentage(metrics.conversionRate)} tone="orange" />
        <KpiCard label="Prix moyen" value={formatPrice(Math.round(metrics.averagePrice))} />
        <KpiCard label="Prix moyen / m²" value={metrics.averagePricePerSquareMeter ? `${Math.round(metrics.averagePricePerSquareMeter).toLocaleString("fr-FR")} €/m²` : "Non calculable"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40">
          <CardHeader><CardTitle>Performance leads</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <MetricLine label="Contacts" value={metrics.contacts} max={leadMax} />
            <MetricLine label="Estimations" value={metrics.estimations} max={leadMax} />
            <MetricLine label="Nouveaux" value={metrics.newLeads} max={leadMax} />
            <MetricLine label="Contactés" value={metrics.contactedLeads} max={leadMax} />
            <MetricLine label="Rendez-vous" value={metrics.appointments} max={leadMax} />
            <MetricLine label="Mandats signés" value={metrics.mandateSigned} max={leadMax} />
            <MetricLine label="Perdus" value={metrics.lostLeads} max={leadMax} />
          </CardContent>
        </Card>

        <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40">
          <CardHeader><CardTitle>Portefeuille de biens</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <MetricLine label="Disponibles" value={metrics.availableProperties} max={propertyMax} />
            <MetricLine label="Sous offre" value={metrics.underOfferProperties} max={propertyMax} />
            <MetricLine label="Vendus" value={metrics.soldProperties} max={propertyMax} />
            <MetricLine label="À la une" value={metrics.featuredProperties} max={propertyMax} />
            <MetricLine label="Appartements" value={metrics.apartments} max={propertyMax} />
            <MetricLine label="Maisons" value={metrics.houses} max={propertyMax} />
            <MetricLine label="Terrains" value={metrics.lands} max={propertyMax} />
            <MetricLine label="Surface moyenne" value={`${Math.round(metrics.averageSurface)} m²`} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40">
          <CardHeader><CardTitle>Biens par ville</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {metrics.propertiesByCity.slice(0, 6).map((item) => (
              <div key={item.city} className="grid gap-2">
                <MetricLine label={item.city} value={item.count} max={cityMax} />
                <p className="text-xs text-gray-500">Prix moyen : {formatPrice(item.averagePrice)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40">
          <CardHeader><CardTitle>Leads par ville</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {metrics.leadsByCity.slice(0, 6).map((item) => (
              <MetricLine key={item.city} label={item.city} value={item.count} max={leadCityMax} />
            ))}
            {metrics.leadsByCity.length === 0 ? <p className="text-sm text-gray-600">Aucune ville renseignée.</p> : null}
          </CardContent>
        </Card>

        <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40">
          <CardHeader><CardTitle>Performance formulaires</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <MetricLine label="Demandes contact" value={metrics.contactSubmissions} />
            <MetricLine label="Demandes estimation" value={metrics.estimationSubmissions} />
            <MetricLine label="Ratio estimation/contact" value={Number.isFinite(metrics.estimationContactRatio) ? metrics.estimationContactRatio.toFixed(2) : "Non calculable"} />
            <MetricLine label="Dernière soumission" value={formatDateTime(metrics.latestSubmissionDate)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40">
          <CardHeader><CardTitle>Statistiques d&apos;activité</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <MetricLine label="Activités totales" value={metrics.totalActivities} />
            {metrics.activitiesByEntity.map((item) => (
              <MetricLine key={item.label} label={item.label} value={item.count} max={activityMax} />
            ))}
            <MetricLine label="Dernière activité" value={formatDateTime(metrics.latestActivityDate)} />
          </CardContent>
        </Card>

        <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40">
          <CardHeader>
            <CardTitle>Statistiques site internet</CardTitle>
            <p className="text-sm leading-6 text-gray-600">
              Ces métriques seront alimentées après connexion à GA4 via l&apos;API Google Analytics Data.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4">
            {["Sessions", "Utilisateurs", "Pages vues", "Sources de trafic", "Conversions GA4"].map((label) => (
              <MetricLine key={label} label={label} value="À connecter" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ActivityPanel({
  activities,
  filteredActivities,
  activitySearch,
  setActivitySearch,
  activityEntityType,
  setActivityEntityType,
  activityAction,
  setActivityAction,
  activityPeriod,
  setActivityPeriod,
}: {
  activities: Activity[];
  filteredActivities: Activity[];
  activitySearch: string;
  setActivitySearch: React.Dispatch<React.SetStateAction<string>>;
  activityEntityType: ActivityEntityTypeFilter;
  setActivityEntityType: React.Dispatch<React.SetStateAction<ActivityEntityTypeFilter>>;
  activityAction: ActivityActionFilter;
  setActivityAction: React.Dispatch<React.SetStateAction<ActivityActionFilter>>;
  activityPeriod: ActivityPeriodFilter;
  setActivityPeriod: React.Dispatch<React.SetStateAction<ActivityPeriodFilter>>;
}) {
  return (
    <Card className="border-orange-100 bg-white shadow-sm shadow-orange-100/40">
      <CardHeader>
        <CardTitle className="text-xl font-black text-[#111111]">Journal d&apos;activité</CardTitle>
        <p className="text-sm leading-6 text-gray-600">
          Recherche, filtres et lecture rapide des actions CRM.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-0 bg-orange-100 text-orange-800">
            {filteredActivities.length} résultat{filteredActivities.length > 1 ? "s" : ""}
          </Badge>
          <span className="text-sm text-gray-500">sur {activities.length} activité{activities.length > 1 ? "s" : ""}</span>
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
          <Card className="border-dashed border-orange-200 bg-orange-50/60">
            <CardContent className="py-12 text-center">
              <ListChecks className="mx-auto size-9 text-orange-500" />
              <p className="mt-4 font-bold text-[#111111]">Aucune activité ne correspond à votre recherche.</p>
              <p className="mt-2 text-sm text-gray-600">Ajustez la recherche, le type, l&apos;action ou la période.</p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

type Props = {
  contacts: ContactLead[];
  estimations: EstimationLead[];
  activities: Activity[];
  properties: Property[];
  connected: boolean;
  expectedCode: string;
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
  expectedCode,
  connected,
}: {
  setLeads: React.Dispatch<React.SetStateAction<AdminLead[]>>;
  expectedCode: string;
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
      headers: { "Content-Type": "application/json", "x-admin-code": expectedCode },
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
    <Card className="border-orange-100 bg-white">
      <CardHeader>
        <CardTitle className="text-lg text-[#111111]">Créer un contact</CardTitle>
        <p className="text-sm leading-6 text-gray-600">
          Ajoutez manuellement un prospect reçu par téléphone, email ou passage agence.
        </p>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

function CreatePropertyCard({
  properties,
  setProperties,
  expectedCode,
  connected,
}: {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  expectedCode: string;
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
      headers: { "x-admin-code": expectedCode },
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

    setSubmitting(true);
    const photos = await uploadSelectedPhotos();
    if (!photos) {
      setSubmitting(false);
      return;
    }
    const photoUrls = photos.map((photo) => photo.url);

    if (!connected) {
      const property = buildLocalProperty(form, properties, photoUrls);
      setProperties((current) => [property, ...current]);
      setForm(emptyPropertyForm);
      setUploadedPhotos([]);
      setPhotoInputKey((current) => current + 1);
      setSubmitting(false);
      setFeedback({
        type: "success",
        message: `Bien créé dans cette session locale avec la référence ${property.reference}.`,
      });
      return;
    }

    const response = await fetch("/api/admin/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-code": expectedCode },
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

    setProperties((current) => mergeProperties(current, [payload.property!]));
    setForm(emptyPropertyForm);
    setUploadedPhotos([]);
    setPhotoInputKey((current) => current + 1);
    setFeedback({ type: "success", message: payload.message ?? "Bien créé." });
  }

  return (
    <Card className="border-orange-100 bg-white">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg text-[#111111]">Créer un bien</CardTitle>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              La référence sera attribuée automatiquement au moment de l&apos;enregistrement.
            </p>
          </div>
          <Badge className="w-fit border-0 bg-orange-100 text-orange-800">
            Prochaine réf. {nextReference}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

function PropertyEditorCard({
  property,
  expectedCode,
  connected,
  onPersist,
}: {
  property: Property;
  expectedCode: string;
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
      headers: { "x-admin-code": expectedCode },
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
      headers: { "Content-Type": "application/json", "x-admin-code": expectedCode },
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

  async function quickUpdate(updates: Partial<Pick<Property, "status" | "featured">>) {
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
          <Badge className="border-0 bg-orange-100 text-orange-800">{propertyStatusLabels[property.status]}</Badge>
        </div>

        <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-4">
          <p><strong>Prix</strong><br />{formatPrice(property.price)}</p>
          <p><strong>Pièces</strong><br />{property.rooms ?? "Non renseigné"}</p>
          <p><strong>Photos</strong><br />{property.photos.length}</p>
          <p><strong>Mise en avant</strong><br />{property.featured ? "Oui" : "Non"}</p>
        </div>

        <div className="grid gap-3 rounded-lg border border-orange-100 bg-orange-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2 sm:grid-cols-2">
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
  expectedCode,
  connected,
}: {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  expectedCode: string;
  connected: boolean;
}) {
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const propertyInventoryMetrics = useMemo(() => getPropertyInventoryMetrics(properties), [properties]);
  const propertyStatusBreakdown = useMemo(() => getPropertyStatusBreakdown(properties), [properties]);
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
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.toLowerCase());
  });

  async function persistProperty(property: Property) {
    if (!connected) {
      setProperties((current) => mergeProperties(current, [property]));
      setFeedback("Modification conservée dans cette session locale.");
      return true;
    }

    const response = await fetch("/api/admin/properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-code": expectedCode },
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

    setProperties((current) => mergeProperties(current, [payload.property!]));
    setFeedback(payload.message ?? "Bien mis à jour.");
    return true;
  }

  return (
    <div className="grid gap-6">
      <CreatePropertyCard
        properties={properties}
        setProperties={setProperties}
        expectedCode={expectedCode}
        connected={connected}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {propertyInventoryMetrics.map((metric) => (
          <Card key={metric.label} className="border-orange-100 bg-white">
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-black text-[#111111]">{metric.value}</p>
              <p className="mt-2 text-xs leading-5 text-gray-500">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-orange-100 bg-white">
        <CardHeader>
          <CardTitle>Source catalogue</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-gray-700">
          <p><strong>{propertyImportSource.name}</strong></p>
          <p>Source actuelle : <span className="font-mono text-xs">catalogue officiel + Supabase properties</span></p>
          <p>Source cible : {propertyImportSource.futureSource}</p>
          <p className="text-gray-500">{propertyImportSource.note}</p>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-orange-100 bg-white">
          <CardHeader><CardTitle>Répartition par statut</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {propertyStatusBreakdown.map((item) => (
              <p key={item.key} className="flex items-center justify-between border-b border-orange-100 pb-2 text-sm">
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </p>
            ))}
          </CardContent>
        </Card>
        <Card className="border-orange-100 bg-white">
          <CardHeader><CardTitle>Répartition par type</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {propertyTypeBreakdown.map((item) => (
              <p key={item.key} className="flex items-center justify-between border-b border-orange-100 pb-2 text-sm">
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
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
        <Card className="border-dashed border-orange-200 bg-white">
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto size-9 text-orange-500" />
            <p className="mt-4 font-bold text-[#111111]">Aucun bien trouvé</p>
            <p className="mt-2 text-sm text-gray-600">Modifiez la recherche ou créez un nouveau bien.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredProperties.map((property) => (
            <PropertyEditorCard
              key={`${property.reference}-${property.updatedAt}`}
              property={property}
              expectedCode={expectedCode}
              connected={connected}
              onPersist={persistProperty}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LeadManager({ leads, setLeads, expectedCode, connected }: { leads: AdminLead[]; setLeads: React.Dispatch<React.SetStateAction<AdminLead[]>>; expectedCode: string; connected: boolean }) {
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
      headers: { "Content-Type": "application/json", "x-admin-code": expectedCode },
      body: JSON.stringify({ table: lead.kind, id: lead.id, ...updates }),
    });
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    setFeedback(payload?.message ?? (response.ok ? "Mise à jour enregistrée." : "Mise à jour impossible."));
  }

  return (
    <div className="grid gap-5">
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
        <Card className="border-dashed border-orange-200 bg-white"><CardContent className="py-12 text-center"><ContactRound className="mx-auto size-9 text-orange-500" /><p className="mt-4 font-bold text-[#111111]">Aucun prospect dans cette vue</p><p className="mt-2 text-sm text-gray-600">Les prochaines demandes apparaîtront ici automatiquement.</p></CardContent></Card>
      ) : visible.map((lead) => (
        <Card key={lead.id} className="border-orange-100 bg-white">
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><CardTitle className="text-lg text-[#111111]">{lead.name}</CardTitle><p className="mt-1 text-sm text-gray-500">{new Date(lead.createdAt).toLocaleString("fr-FR")} · {lead.city}</p></div>
            <Badge className="w-fit border-0 bg-orange-100 text-orange-800">{leadStatusLabels[lead.status]}</Badge>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-3"><p><strong>Email</strong><br />{lead.email}</p><p><strong>Téléphone</strong><br />{lead.phone}</p><p><strong>Demande</strong><br />{lead.category}</p></div>
            <p className="break-words rounded-md bg-orange-50 p-4 text-sm leading-6 text-gray-700">{lead.message}</p>
            <div className="grid gap-3 lg:grid-cols-[200px_1fr_auto_auto] lg:items-end">
              <div className="grid gap-2"><Label>Statut</Label><Select value={lead.status} onValueChange={(value) => persist(lead, { status: value as LeadStatus })}><SelectTrigger><SelectValue>{(value) => getStatusSelectLabel(value)}</SelectValue></SelectTrigger><SelectContent>{leadStatuses.map((value) => <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2"><Label htmlFor={`notes-${lead.id}`}>Notes internes</Label><Input id={`notes-${lead.id}`} value={lead.notes} onChange={(event) => setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, notes: event.target.value } : item))} /></div>
              <Button variant="outline" onClick={() => persist(lead, { notes: lead.notes })}><Save className="size-4" />Sauver</Button>
              <Button variant="outline" onClick={() => persist(lead, { archived: true })}><Archive className="size-4" />Archiver</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AdminDashboard({ contacts, estimations, activities: initialActivities, properties, connected, expectedCode }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [contactLeads, setContactLeads] = useState(() => normalizeContacts(contacts));
  const [estimationLeads, setEstimationLeads] = useState(() => normalizeEstimations(estimations));
  const [activities, setActivities] = useState(initialActivities);
  const [propertyItems, setPropertyItems] = useState(properties);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityEntityType, setActivityEntityType] = useState<ActivityEntityTypeFilter>("ALL");
  const [activityAction, setActivityAction] = useState<ActivityActionFilter>("ALL");
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriodFilter>("ALL");
  const metrics = useMemo(
    () => buildAdminMetrics(contactLeads, estimationLeads, propertyItems, activities),
    [activities, contactLeads, estimationLeads, propertyItems]
  );
  const filteredActivities = useMemo(
    () => filterActivities(activities, activitySearch, activityEntityType, activityAction, activityPeriod),
    [activities, activityAction, activityEntityType, activityPeriod, activitySearch]
  );

  async function unlock() {
    if (code !== expectedCode) {
      setError("Code incorrect.");
      return;
    }

    setError("");
    if (connected) {
      setLoading(true);
      const [response, propertiesResponse] = await Promise.all([
        fetch("/api/admin/leads", { headers: { "x-admin-code": code } }),
        fetch("/api/admin/properties", { headers: { "x-admin-code": code } }),
      ]);
      const payload = await response.json().catch(() => null) as { message?: string; contacts?: ContactLead[]; estimations?: EstimationLead[]; activities?: Activity[] } | null;
      const propertiesPayload = await propertiesResponse.json().catch(() => null) as { properties?: Property[] } | null;
      setLoading(false);
      if (!response.ok) {
        setError(payload?.message ?? "Le CRM n'a pas pu être chargé.");
        return;
      }
      setContactLeads(normalizeContacts(payload?.contacts ?? []));
      setEstimationLeads(normalizeEstimations(payload?.estimations ?? []));
      setActivities(payload?.activities ?? []);
      if (propertiesResponse.ok) {
        setPropertyItems(mergeProperties(properties, propertiesPayload?.properties ?? []));
      }
    }
    setUnlocked(true);
  }

  if (!expectedCode) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#111111] px-4 py-12">
        <Card className="w-full max-w-lg min-w-0 border-white/10 bg-white text-[#111111] shadow-2xl">
          <CardHeader className="min-w-0"><Badge className="w-fit border-0 bg-yellow-300 text-[#111111]">Configuration requise</Badge><KeyRound className="size-8 text-orange-600" /><CardTitle className="text-2xl font-black">CRM à verrouiller</CardTitle><p className="text-sm leading-6 text-gray-600">Définis <span className="break-all font-mono text-xs">NEXT_PUBLIC_ADMIN_LOCAL_CODE</span> dans l&apos;environnement avant d&apos;utiliser l&apos;administration locale.</p></CardHeader>
          <CardContent><p className="rounded-md bg-orange-50 p-4 text-sm leading-6 text-gray-700">Le site public reste disponible. Cette protection temporaire évite d&apos;ouvrir le CRM avec un code par défaut.</p></CardContent>
        </Card>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#111111] px-4 py-12">
        <Card className="w-full max-w-md border-white/10 bg-white text-[#111111] shadow-2xl">
          <CardHeader><KeyRound className="size-8 text-orange-600" /><CardTitle className="text-2xl font-black">Administration locale</CardTitle><p className="text-sm leading-6 text-gray-600">Accès temporaire avant la future authentification sécurisée.</p></CardHeader>
          <CardContent className="grid gap-4"><div className="grid gap-2"><Label htmlFor="admin-code">Code d&apos;accès</Label><Input id="admin-code" type="password" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }} /></div>{error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}<Button disabled={loading} onClick={() => void unlock()} className="h-11 bg-orange-500 text-white hover:bg-orange-600">{loading ? "Chargement..." : "Ouvrir le CRM"}</Button></CardContent>
        </Card>
      </main>
    );
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
          <Button variant="outline" onClick={() => setUnlocked(false)} className="w-full border-orange-200 bg-white sm:w-auto">
            <LogOut className="size-4" />Verrouiller
          </Button>
        </header>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AdminTab)} className="w-full min-w-0 gap-6 sm:gap-8">
          <div className="w-full min-w-0">
            <TabsList className="!grid h-auto w-full grid-cols-2 gap-1 bg-white p-1 shadow-sm shadow-orange-100/40 sm:grid-cols-3 lg:!inline-flex lg:w-full lg:justify-start">
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="overview"><LayoutDashboard />Vue d&apos;ensemble</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="contacts"><ContactRound />Contacts</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="estimations"><ClipboardCheck />Estimations</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="properties"><Building2 />Biens</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="activities"><ListChecks />Activités</TabsTrigger>
              <TabsTrigger className="!min-h-11 w-full min-w-0 justify-start px-3 text-[15px] sm:!min-h-10 lg:w-auto lg:flex-none lg:justify-center lg:px-5" value="statistics"><BarChart3 />Statistiques</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="overview" className="w-full">
            <DashboardBento metrics={metrics} setActiveTab={setActiveTab} />
          </TabsContent>
          <TabsContent value="contacts">
            <div className="grid gap-5">
              <CreateContactCard setLeads={setContactLeads} expectedCode={expectedCode} connected={connected} />
              <LeadManager leads={contactLeads} setLeads={setContactLeads} expectedCode={expectedCode} connected={connected} />
            </div>
          </TabsContent>
          <TabsContent value="estimations" className="w-full"><LeadManager leads={estimationLeads} setLeads={setEstimationLeads} expectedCode={expectedCode} connected={connected} /></TabsContent>
          <TabsContent value="properties" className="w-full">
            <PropertyManager properties={propertyItems} setProperties={setPropertyItems} expectedCode={expectedCode} connected={connected} />
          </TabsContent>
          <TabsContent value="activities" className="w-full">
            <ActivityPanel
              activities={activities}
              filteredActivities={filteredActivities}
              activitySearch={activitySearch}
              setActivitySearch={setActivitySearch}
              activityEntityType={activityEntityType}
              setActivityEntityType={setActivityEntityType}
              activityAction={activityAction}
              setActivityAction={setActivityAction}
              activityPeriod={activityPeriod}
              setActivityPeriod={setActivityPeriod}
            />
          </TabsContent>
          <TabsContent value="statistics" className="w-full">
            <StatisticsPanel metrics={metrics} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

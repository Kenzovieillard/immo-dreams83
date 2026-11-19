"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Target } from "lucide-react";
import {
  CrmRivieraPipeline,
  type RivieraPipelineColumn,
} from "@/components/admin/admin-dashboard";
import { CrmMobileNavigation, type CrmTab } from "@/components/admin/crm-mobile-navigation";
import { CrmRivieraHeader } from "@/components/admin/crm-riviera-header";
import { CrmRivieraOverview } from "@/components/admin/crm-riviera-overview";
import type { CrmDailyPriority } from "@/lib/crm-dashboard";
import type {
  AdminTeamMember,
  CrmOverviewSnapshot,
  PipelineLead,
  PipelineMetrics,
  PipelineTask,
} from "@/types/crm";

const crmRivieraStyle = {
  "--crm-riviera-bg-canvas": "#f6f4ef",
  "--crm-riviera-bg-surface": "#fbfaf7",
  "--crm-riviera-bg-header": "#17221e",
  "--crm-riviera-bg-action": "#2f493a",
  "--crm-riviera-bg-accent": "#dce5d7",
  "--crm-riviera-text-primary": "#18211f",
  "--crm-riviera-text-secondary": "#66716c",
  "--crm-riviera-text-action": "#2f493a",
  "--crm-riviera-border-default": "#dfddd4",
  "--crm-riviera-status-success": "#4d7a5c",
  "--crm-riviera-status-warning": "#c28b2c",
  "--crm-riviera-status-danger": "#a94d43",
  "--crm-riviera-shadow-card": "0 2px 8px rgb(23 34 30 / 0.07)",
} as CSSProperties;

// Keep the preview dataset deterministic so its prerendered HTML and client
// hydration always use the exact same timestamps.
const now = new Date("2026-08-11T09:00:00.000Z");

const overview: CrmOverviewSnapshot = {
  generatedAt: now.toISOString(),
  metrics: {
    totalLeads: 7,
    newLeads: 8,
    visits: 4,
    offers: 3,
    availableProperties: 24,
    propertiesWithoutPhotos: 3,
    contactsToQualify: 5,
    openTasks: 7,
    todayTasks: 2,
  },
  sources: {
    leads: "real",
    visits: "derived",
    offers: "derived",
    properties: "real",
  },
};

const priorities: CrmDailyPriority[] = [
  {
    id: "preview-1",
    badge: "En retard",
    title: "Attribuer le nouveau prospect",
    context: "Lead Riviera FIND · Frejus · Budget 700 k€",
    timeLabel: "Recu il y a 18 min",
    actionLabel: "Attribuer",
    tone: "danger",
    tab: "pipeline",
    rank: 0,
    timestamp: now.getTime() - 18 * 60_000,
  },
  {
    id: "preview-2",
    badge: "A relancer",
    title: "Confirmer la visite de 14 h",
    context: "Villa Les Issambres · Claire Martin",
    timeLabel: "Dans 2 h 20",
    actionLabel: "Confirmer",
    tone: "warning",
    tab: "pipeline",
    rank: 1,
    timestamp: now.getTime() + 140 * 60_000,
  },
];

const team: AdminTeamMember[] = [
  { id: "antoine", email: "antoine@immodreams83.fr", fullName: "Antoine Faridonie", role: "AGENT", isActive: true },
  { id: "michel", email: "michel@immodreams83.fr", fullName: "Michel Faridonie", role: "AGENT", isActive: true },
];

const previewLeads: PipelineLead[] = [
  {
    id: "lead-claire",
    dossierReference: "DOS-CLAIRE",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    title: "Recherche appartement",
    requestType: "Appartement",
    projectType: "buyer",
    propertyType: "apartment",
    city: "Saint-Raphaël",
    postalCode: "83700",
    budgetMin: 650000,
    budgetMax: 800000,
    desiredSurface: 90,
    desiredRooms: 4,
    source: "crm",
    sourceCode: "RECOMMANDATION",
    status: "NEW",
    priority: "urgent",
    assignedTo: "antoine",
    assignedToName: "Antoine Faridonie",
    contactId: "contact-claire",
    contactName: "Claire Martin",
    contactEmail: "claire@example.fr",
    contactPhone: "0600000001",
    linkedPropertyId: null,
    linkedPropertyTitle: null,
    hasActiveAppointment: false,
    hasActiveOffer: false,
    hasActiveMandate: false,
    offerCount: 0,
    latestOfferId: null,
    latestOfferStatus: null,
    notes: null,
    archived: false,
  },
  {
    id: "lead-julien",
    dossierReference: "DOS-JULIEN",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    title: "Recherche villa",
    requestType: "Villa",
    projectType: "buyer",
    propertyType: "house",
    city: "Fréjus",
    postalCode: "83600",
    budgetMin: 600000,
    budgetMax: 700000,
    desiredSurface: 120,
    desiredRooms: 5,
    source: "crm",
    sourceCode: "SITE",
    status: "CONTACTED",
    priority: "normal",
    assignedTo: "michel",
    assignedToName: "Michel Faridonie",
    contactId: "contact-julien",
    contactName: "Julien Bernard",
    contactEmail: "julien@example.fr",
    contactPhone: "0600000002",
    linkedPropertyId: null,
    linkedPropertyTitle: null,
    hasActiveAppointment: false,
    hasActiveOffer: false,
    hasActiveMandate: false,
    offerCount: 0,
    latestOfferId: null,
    latestOfferStatus: null,
    notes: null,
    archived: false,
  },
  {
    id: "lead-sophie",
    dossierReference: "DOS-SOPHIE",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    title: "Visite villa",
    requestType: "Villa",
    projectType: "buyer",
    propertyType: "house",
    city: "Les Issambres",
    postalCode: "83380",
    budgetMin: 900000,
    budgetMax: 1200000,
    desiredSurface: 150,
    desiredRooms: 6,
    source: "crm",
    sourceCode: "PORTAIL",
    status: "APPOINTMENT",
    priority: "high",
    assignedTo: "antoine",
    assignedToName: "Antoine Faridonie",
    contactId: "contact-sophie",
    contactName: "Sophie Leroy",
    contactEmail: "sophie@example.fr",
    contactPhone: "0600000003",
    linkedPropertyId: "property-villa",
    linkedPropertyTitle: "Villa Les Issambres · Réf. 124",
    hasActiveAppointment: true,
    hasActiveOffer: false,
    hasActiveMandate: false,
    offerCount: 0,
    latestOfferId: null,
    latestOfferStatus: null,
    notes: null,
    archived: false,
  },
  {
    id: "lead-marc",
    dossierReference: "DOS-MARC",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    title: "Offre appartement",
    requestType: "Appartement",
    projectType: "buyer",
    propertyType: "apartment",
    city: "Toulon",
    postalCode: "83000",
    budgetMin: 160000,
    budgetMax: 175000,
    desiredSurface: 55,
    desiredRooms: 3,
    source: "crm",
    sourceCode: "AGENCE",
    status: "APPOINTMENT",
    priority: "normal",
    assignedTo: "michel",
    assignedToName: "Michel Faridonie",
    contactId: "contact-marc",
    contactName: "Marc Durand",
    contactEmail: "marc@example.fr",
    contactPhone: "0600000004",
    linkedPropertyId: "property-mourillon",
    linkedPropertyTitle: "T2 Centre Mourillon · Réf. 123",
    hasActiveAppointment: true,
    hasActiveOffer: true,
    hasActiveMandate: false,
    offerCount: 1,
    latestOfferId: "offer-marc",
    latestOfferStatus: "DRAFT",
    notes: null,
    archived: false,
  },
];

function createPreviewTask(
  id: string,
  leadId: string,
  assignedTo: string,
  assignedToName: string,
  title: string,
  dueAt: string,
  priority: PipelineTask["priority"]
): PipelineTask {
  return {
    id,
    leadId,
    assignedTo,
    assignedToName,
    createdBy: assignedTo,
    title,
    description: null,
    dueAt,
    completedAt: null,
    completedBy: null,
    priority,
    status: "TODO",
    taskType: "FOLLOW_UP",
    contactId: null,
    propertyId: null,
    offerId: null,
    appointmentId: null,
    recurrenceRule: "NONE",
    reminderChannel: "NONE",
    emailReminderEnabled: false,
    emailReminderStatus: "NOT_SCHEDULED",
    emailReminderScheduledAt: null,
    emailReminderSentAt: null,
    emailReminderLastError: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

const previewTasks: PipelineTask[] = [
  createPreviewTask(
    "task-claire",
    "lead-claire",
    "antoine",
    "Antoine Faridonie",
    "Relancer pour qualifier le financement",
    new Date(now.getTime() - 30 * 60_000).toISOString(),
    "urgent"
  ),
  createPreviewTask(
    "task-julien",
    "lead-julien",
    "michel",
    "Michel Faridonie",
    "Confirmer les critères de recherche",
    new Date(now.getTime() + 2 * 60 * 60_000).toISOString(),
    "normal"
  ),
  createPreviewTask(
    "task-sophie",
    "lead-sophie",
    "antoine",
    "Antoine Faridonie",
    "Rédiger le compte rendu de visite",
    new Date(now.getTime() + 4 * 60 * 60_000).toISOString(),
    "high"
  ),
  createPreviewTask(
    "task-marc",
    "lead-marc",
    "michel",
    "Michel Faridonie",
    "Vérifier les conditions de l’offre",
    new Date(now.getTime() + 24 * 60 * 60_000).toISOString(),
    "normal"
  ),
];

const pipelineMetrics: PipelineMetrics = {
  visits: 1,
  offers: 1,
  mandates: 0,
  sources: {
    visits: "real",
    offers: "real",
    mandates: "real",
  },
};

export default function CrmRivieraPreviewPage() {
  const [activeTab, setActiveTab] = useState<CrmTab>("overview");
  const [contactSearch, setContactSearch] = useState("");
  const [assignee, setAssignee] = useState("ALL");
  const visibleLeads = previewLeads.filter(
    (lead) => assignee === "ALL" || (assignee === "UNASSIGNED" ? !lead.assignedTo : lead.assignedTo === assignee)
  );
  const nextTaskByLead = new Map(previewTasks.map((task) => [task.leadId, task]));
  const columns: RivieraPipelineColumn[] = [
    {
      id: "new",
      title: "Nouveaux",
      count: previewLeads.filter((lead) => lead.status === "NEW").length,
      leads: visibleLeads
        .filter((lead) => lead.status === "NEW")
        .map((lead) => ({ lead, nextTask: nextTaskByLead.get(lead.id) ?? null })),
    },
    {
      id: "contacted",
      title: "Contactés",
      count: previewLeads.filter((lead) => lead.status === "CONTACTED").length,
      leads: visibleLeads
        .filter((lead) => lead.status === "CONTACTED")
        .map((lead) => ({ lead, nextTask: nextTaskByLead.get(lead.id) ?? null })),
    },
    {
      id: "appointment",
      title: "Rendez-vous",
      count: previewLeads.filter((lead) => lead.hasActiveAppointment && !lead.hasActiveOffer).length,
      leads: visibleLeads
        .filter((lead) => lead.hasActiveAppointment && !lead.hasActiveOffer)
        .map((lead) => ({ lead, nextTask: nextTaskByLead.get(lead.id) ?? null })),
    },
    {
      id: "offers",
      title: "Offres",
      count: previewLeads.filter((lead) => lead.hasActiveOffer).length,
      leads: visibleLeads
        .filter((lead) => lead.hasActiveOffer)
        .map((lead) => ({ lead, nextTask: nextTaskByLead.get(lead.id) ?? null })),
    },
  ];

  return (
    <main
      className="crm-riviera min-h-dvh overflow-x-clip bg-[var(--crm-riviera-bg-canvas)] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8"
      style={crmRivieraStyle}
    >
      <CrmRivieraHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connected
        loading={false}
        userName="Kenzo"
        priorityCount={priorities.length}
        visitCount={overview.metrics.visits}
        contactsToQualify={overview.metrics.contactsToQualify}
        contactsReady={3}
        selectedContact={null}
        onCloseContact={() => undefined}
        contactSearch={contactSearch}
        onContactSearchChange={setContactSearch}
        onCreateContact={() => undefined}
        onLogout={() => undefined}
      />
      <div className="mx-auto w-full min-w-0 overflow-hidden px-3 py-4 sm:px-6 sm:py-6 md:ml-60 md:w-[calc(100%-15rem)] lg:px-8 xl:px-10 xl:py-8">
        {activeTab === "pipeline" ? (
          <CrmRivieraPipeline
            activeLeads={visibleLeads}
            dailyTasks={previewTasks.slice(0, 3).map((task) => ({
              task,
              lead: previewLeads.find((lead) => lead.id === task.leadId) ?? null,
            }))}
            columns={columns}
            totalLeads={previewLeads.length}
            metrics={pipelineMetrics}
            urgentCount={1}
            team={team}
            assignee={assignee}
            onAssigneeChange={setAssignee}
            onRefresh={() => undefined}
            onExport={() => undefined}
            onOpenLead={() => undefined}
            onStartReminder={() => undefined}
            onCompleteTask={() => undefined}
            pendingId={null}
            error=""
            feedback=""
          />
        ) : (
          <CrmRivieraOverview
            metrics={overview.metrics}
            priorities={priorities}
            tasks={previewTasks}
            overview={overview}
            onPriorityAction={() => undefined}
            onOpenPipeline={() => setActiveTab("pipeline")}
            onOpenContacts={() => undefined}
            onOpenProperties={() => undefined}
            onOpenEstimations={() => setActiveTab("estimations")}
            onCreateContact={() => undefined}
          />
        )}
      </div>
      <CrmMobileNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={() => undefined}
        quickAction={{
          label: activeTab === "pipeline" ? "Créer un rappel" : priorities[0].actionLabel,
          icon: Target,
          onClick: () => undefined,
        }}
      />
    </main>
  );
}

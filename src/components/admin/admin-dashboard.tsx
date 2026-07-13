"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  Building2,
  ClipboardCheck,
  ContactRound,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Save,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatNumber,
  formatPrice,
  type Property,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/data/properties";
import { leadStatusDescriptions, leadStatusLabels, leadStatuses } from "@/lib/crm";
import {
  getPropertyInventoryMetrics,
  getPropertyStatusBreakdown,
  getPropertyTypeBreakdown,
  propertyImportSource,
} from "@/lib/property-management";
import type { Activity, ContactLead, EstimationLead, LeadStatus } from "@/types/crm";

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
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
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
            <p className="rounded-md bg-orange-50 p-4 text-sm leading-6 text-gray-700">{lead.message}</p>
            <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto_auto] sm:items-end">
              <div className="grid gap-2"><Label>Statut</Label><Select value={lead.status} onValueChange={(value) => persist(lead, { status: value as LeadStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{leadStatuses.map((value) => <SelectItem key={value} value={value}>{leadStatusLabels[value]}</SelectItem>)}</SelectContent></Select></div>
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
  const [contactLeads, setContactLeads] = useState(() => normalizeContacts(contacts));
  const [estimationLeads, setEstimationLeads] = useState(() => normalizeEstimations(estimations));
  const [activities, setActivities] = useState(initialActivities);
  const metrics = useMemo(() => ({
    contacts: contactLeads.filter((lead) => !lead.archived).length,
    estimations: estimationLeads.filter((lead) => !lead.archived).length,
    online: properties.filter((property) => property.status !== "sold").length,
    featured: properties.filter((property) => property.featured).length,
  }), [contactLeads, estimationLeads, properties]);
  const propertyInventoryMetrics = useMemo(() => getPropertyInventoryMetrics(properties), [properties]);
  const propertyStatusBreakdown = useMemo(() => getPropertyStatusBreakdown(properties), [properties]);
  const propertyTypeBreakdown = useMemo(() => getPropertyTypeBreakdown(properties), [properties]);

  async function unlock() {
    if (code !== expectedCode) {
      setError("Code incorrect.");
      return;
    }

    setError("");
    if (connected) {
      setLoading(true);
      const response = await fetch("/api/admin/leads", { headers: { "x-admin-code": code } });
      const payload = await response.json().catch(() => null) as { message?: string; contacts?: ContactLead[]; estimations?: EstimationLead[]; activities?: Activity[] } | null;
      setLoading(false);
      if (!response.ok) {
        setError(payload?.message ?? "Le CRM n'a pas pu être chargé.");
        return;
      }
      setContactLeads(normalizeContacts(payload?.contacts ?? []));
      setEstimationLeads(normalizeEstimations(payload?.estimations ?? []));
      setActivities(payload?.activities ?? []);
    }
    setUnlocked(true);
  }

  if (!expectedCode) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#111111] px-4 py-12">
        <Card className="w-full max-w-lg border-white/10 bg-white text-[#111111] shadow-2xl">
          <CardHeader><Badge className="w-fit border-0 bg-yellow-300 text-[#111111]">Configuration requise</Badge><KeyRound className="size-8 text-orange-600" /><CardTitle className="text-2xl font-black">CRM à verrouiller</CardTitle><p className="text-sm leading-6 text-gray-600">Définis <span className="font-mono text-xs">NEXT_PUBLIC_ADMIN_LOCAL_CODE</span> dans l&apos;environnement avant d&apos;utiliser l&apos;administration locale.</p></CardHeader>
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

  const pipeline = leadStatuses.map((value) => ({
    key: value,
    label: leadStatusLabels[value],
    count: [...contactLeads, ...estimationLeads].filter((lead) => !lead.archived && lead.status === value).length,
  }));

  return (
    <main className="min-h-svh bg-orange-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><Badge className={connected ? "border-0 bg-emerald-600 text-white" : "border-0 bg-yellow-300 text-[#111111]"}>{connected ? "Supabase connecté" : "Mode local"}</Badge><h1 className="mt-3 text-3xl font-black text-[#111111]">CRM IMMO-DREAMS83</h1><p className="mt-1 text-sm text-gray-600">Prospects, estimations, biens et activité de l&apos;agence.</p></div><Button variant="outline" onClick={() => setUnlocked(false)}><LogOut className="size-4" />Verrouiller</Button></header>
        <Tabs defaultValue="overview" className="gap-6">
          <div className="no-scrollbar overflow-x-auto"><TabsList className="min-w-max bg-white"><TabsTrigger value="overview"><LayoutDashboard />Vue d&apos;ensemble</TabsTrigger><TabsTrigger value="contacts"><ContactRound />Contacts</TabsTrigger><TabsTrigger value="estimations"><ClipboardCheck />Estimations</TabsTrigger><TabsTrigger value="properties"><Building2 />Biens</TabsTrigger><TabsTrigger value="activities"><ListChecks />Activités</TabsTrigger><TabsTrigger value="statistics"><BarChart3 />Statistiques</TabsTrigger></TabsList></div>
          <TabsContent value="overview" className="grid gap-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ label: "Contacts", value: metrics.contacts }, { label: "Estimations", value: metrics.estimations }, { label: "Biens en ligne", value: metrics.online }, { label: "Biens à la une", value: metrics.featured }].map((metric) => <Card key={metric.label} className="border-orange-100 bg-white"><CardContent className="p-5"><p className="text-sm text-gray-500">{metric.label}</p><p className="mt-2 text-3xl font-black text-[#111111]">{metric.value}</p></CardContent></Card>)}</div><Card className="border-orange-100 bg-white"><CardHeader><CardTitle>Activité récente</CardTitle></CardHeader><CardContent>{activities.length ? <div className="grid gap-3">{activities.slice(0, 6).map((activity) => <p key={activity.id} className="flex justify-between gap-4 border-b border-orange-100 pb-3 text-sm"><span>{activity.action} · {activity.user_name}</span><span className="text-gray-500">{new Date(activity.created_at).toLocaleString("fr-FR")}</span></p>)}</div> : <p className="text-sm text-gray-600">Aucune activité enregistrée pour le moment.</p>}</CardContent></Card></TabsContent>
          <TabsContent value="contacts"><LeadManager leads={contactLeads} setLeads={setContactLeads} expectedCode={expectedCode} connected={connected} /></TabsContent>
          <TabsContent value="estimations"><LeadManager leads={estimationLeads} setLeads={setEstimationLeads} expectedCode={expectedCode} connected={connected} /></TabsContent>
          <TabsContent value="properties"><div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{propertyInventoryMetrics.map((metric) => <Card key={metric.label} className="border-orange-100 bg-white"><CardContent className="p-5"><p className="text-sm text-gray-500">{metric.label}</p><p className="mt-2 text-2xl font-black text-[#111111]">{metric.value}</p><p className="mt-2 text-xs leading-5 text-gray-500">{metric.description}</p></CardContent></Card>)}</div><Card className="border-orange-100 bg-white"><CardHeader><CardTitle>Source catalogue</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm text-gray-700"><p><strong>{propertyImportSource.name}</strong></p><p>Source actuelle : <span className="font-mono text-xs">{propertyImportSource.currentSource}</span></p><p>Source cible : {propertyImportSource.futureSource}</p><p className="text-gray-500">{propertyImportSource.note}</p></CardContent></Card><div className="grid gap-4 lg:grid-cols-2"><Card className="border-orange-100 bg-white"><CardHeader><CardTitle>Répartition par statut</CardTitle></CardHeader><CardContent className="grid gap-3">{propertyStatusBreakdown.map((item) => <p key={item.key} className="flex items-center justify-between border-b border-orange-100 pb-2 text-sm"><span>{item.label}</span><strong>{item.count}</strong></p>)}</CardContent></Card><Card className="border-orange-100 bg-white"><CardHeader><CardTitle>Répartition par type</CardTitle></CardHeader><CardContent className="grid gap-3">{propertyTypeBreakdown.map((item) => <p key={item.key} className="flex items-center justify-between border-b border-orange-100 pb-2 text-sm"><span>{item.label}</span><strong>{item.count}</strong></p>)}</CardContent></Card></div><div className="grid gap-4 md:grid-cols-2">{properties.map((property) => <Card key={property.id} className="border-orange-100 bg-white"><CardContent className="grid gap-4 p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-xs text-gray-500">Réf. {property.reference} · Mandat {property.mandateNumber}</p><p className="mt-1 font-bold text-[#111111]">{property.title}</p><p className="mt-1 text-sm text-gray-600">{property.city} · {formatNumber(property.surface)} m² · {propertyTypeLabels[property.type]}</p></div><Badge className="border-0 bg-orange-100 text-orange-800">{propertyStatusLabels[property.status]}</Badge></div><div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-3"><p><strong>Prix</strong><br />{formatPrice(property.price)}</p><p><strong>Pièces</strong><br />{property.rooms ?? "Non renseigné"}</p><p><strong>Photos</strong><br />{property.photos.length}</p></div><a href={property.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-orange-700 hover:text-orange-900">Voir l&apos;annonce source</a></CardContent></Card>)}</div></div></TabsContent>
          <TabsContent value="activities"><Card className="border-orange-100 bg-white"><CardContent className="grid gap-3 p-6">{activities.length ? activities.map((activity) => <div key={activity.id} className="border-b border-orange-100 pb-3"><p className="font-semibold text-[#111111]">{activity.action}</p><p className="mt-1 text-xs text-gray-500">{activity.entity_type} · {activity.user_name} · {new Date(activity.created_at).toLocaleString("fr-FR")}</p></div>) : <p className="text-sm text-gray-600">Aucune activité enregistrée.</p>}</CardContent></Card></TabsContent>
          <TabsContent value="statistics"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{pipeline.map((item) => <Card key={item.label} className="border-orange-100 bg-white"><CardContent className="p-5"><p className="text-sm text-gray-500">{item.label}</p><p className="mt-2 text-3xl font-black text-orange-600">{item.count}</p><p className="mt-2 text-xs leading-5 text-gray-500">{leadStatusDescriptions[item.key]}</p></CardContent></Card>)}</div></TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

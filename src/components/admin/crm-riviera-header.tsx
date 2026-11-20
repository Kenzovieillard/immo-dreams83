"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ContactRound,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  Target,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommercialSidebarMenu } from "@/components/commercial/commercial-sidebar-menu";
import { contactQualificationStatusLabels, contactRoleLabels } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { commercialLinks } from "@/lib/commercial-navigation";
import type { AdminCrmLead } from "@/types/crm";
import { crmTabMeta, type CrmTab } from "./crm-mobile-navigation";
import { RivieraStatusBadge, rivieraPrimaryButtonClass } from "./crm-riviera-ui";

type SidebarItem = {
  value: CrmTab;
  label: string;
  icon?: LucideIcon;
};

const mainItems: SidebarItem[] = [
  { value: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { value: "contacts", label: "Contacts", icon: ContactRound },
];

const resourceItems: SidebarItem[] = [
  { value: "properties", label: "Biens", icon: Building2 },
  { value: "agenda", label: "Agenda", icon: CalendarDays },
  { value: "statistics", label: "Statistiques", icon: BarChart3 },
];

function firstName(value: string) {
  const clean = value.trim();
  if (!clean) return "Kenzo";
  if (clean.includes("@")) return clean.split("@")[0];
  return clean.split(/\s+/)[0];
}

function initials(value: string) {
  const clean = value.trim();
  if (!clean) return "KV";
  const parts = clean.includes("@") ? [clean.split("@")[0]] : clean.split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "KV";
}

function formatReceivedAt(value: string) {
  const date = new Date(value);
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 60) return `reçu il y a ${elapsedMinutes} min`;
  if (elapsedMinutes < 24 * 60) return `reçu il y a ${Math.round(elapsedMinutes / 60)} h`;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Paris",
  });
}

function SidebarButton({
  item,
  active,
  nested = false,
  onSelect,
}: {
  item: SidebarItem;
  active: boolean;
  nested?: boolean;
  onSelect: (tab: CrmTab) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 w-full items-center gap-3 rounded-lg text-left text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        nested ? "px-6" : "px-4",
        active ? "bg-[#2f493a] font-semibold text-white" : "font-medium text-[#cbd5e1] hover:bg-white/8 hover:text-white"
      )}
    >
      {Icon ? <Icon className="size-[18px] shrink-0" aria-hidden="true" /> : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </button>
  );
}

export function CrmRivieraHeader({
  activeTab,
  onTabChange,
  statisticsNavigation,
  guardCommercialNavigation,
  connected,
  loading,
  userName,
  priorityCount,
  visitCount,
  contactsToQualify,
  contactsReady,
  selectedContact,
  onCloseContact,
  contactSearch,
  onContactSearchChange,
  onCreateContact,
  onLogout,
}: {
  activeTab: CrmTab;
  onTabChange: (tab: CrmTab) => void;
  statisticsNavigation?: ReactNode;
  guardCommercialNavigation?: (href: string) => boolean;
  connected: boolean;
  loading: boolean;
  userName: string;
  priorityCount: number;
  visitCount: number;
  contactsToQualify: number;
  contactsReady: number;
  selectedContact: AdminCrmLead | null;
  onCloseContact: () => void;
  contactSearch: string;
  onContactSearchChange: (value: string) => void;
  onCreateContact: () => void;
  onLogout: () => void;
}) {
  const contactDetailOpen = activeTab === "contacts" && selectedContact;
  const mobileTitle = contactDetailOpen
    ? "Qualifier le contact"
    : activeTab === "overview"
      ? `Bonjour ${firstName(userName)}`
      : crmTabMeta[activeTab].title;
  const mobileDescription = contactDetailOpen
    ? `${selectedContact.name} · ${formatReceivedAt(selectedContact.createdAt)}`
    : activeTab === "overview"
      ? `${priorityCount} priorité${priorityCount > 1 ? "s" : ""} aujourd'hui`
      : crmTabMeta[activeTab].description;

  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--crm-riviera-bg-header)] text-white md:hidden">
        <div className="grid gap-2 px-5 py-4">
          <div className="flex min-h-5 items-center justify-between gap-4 text-[11px] font-medium">
            <span className="tracking-[0.08em]">IMMO DREAMS83</span>
            <span className={connected ? "text-[#9db8a2]" : "text-[#dfbd76]"}>
              ● {loading ? "Synchronisation…" : connected ? "Synchronisé" : "Mode local"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {contactDetailOpen ? (
              <button type="button" onClick={onCloseContact} aria-label="Revenir aux contacts" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <ArrowLeft className="size-5" />
              </button>
            ) : null}
            <h1 className="min-w-0 truncate text-[28px] font-bold leading-9">{mobileTitle}</h1>
          </div>
          <p className="truncate text-sm leading-5 text-white/75">{mobileDescription}</p>
          <div className="flex min-h-8 items-center gap-2 overflow-x-auto">
            {activeTab === "overview" || activeTab === "pipeline" ? (
              <>
                <RivieraStatusBadge tone={priorityCount ? "warning" : "success"}>{priorityCount} urgence{priorityCount > 1 ? "s" : ""}</RivieraStatusBadge>
                <RivieraStatusBadge>{visitCount} visite{visitCount > 1 ? "s" : ""}</RivieraStatusBadge>
              </>
            ) : activeTab === "contacts" && selectedContact ? (
              <>
                <RivieraStatusBadge tone="success">{selectedContact.contactRole ? contactRoleLabels[selectedContact.contactRole] : "Rôle à confirmer"}</RivieraStatusBadge>
                <RivieraStatusBadge tone={selectedContact.qualificationStatus === "QUALIFIED" ? "success" : "warning"}>{selectedContact.qualificationStatus ? contactQualificationStatusLabels[selectedContact.qualificationStatus] : "À revoir"}</RivieraStatusBadge>
              </>
            ) : activeTab === "contacts" ? (
              <>
                <RivieraStatusBadge tone="warning">{contactsToQualify} à qualifier</RivieraStatusBadge>
                <RivieraStatusBadge tone="success">{contactsReady} prêts</RivieraStatusBadge>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col overflow-y-auto bg-[var(--crm-riviera-bg-header)] px-5 py-6 text-white md:flex">
        <div>
          <p className="text-lg font-bold tracking-[-0.03em]">IMMO DREAMS83</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b8c7b9]">CRM Riviera v2</p>
        </div>
        <div className="my-5 h-px shrink-0 bg-white/10" />
        <nav aria-label="Navigation principale du CRM" className="grid gap-1">
          {mainItems.map((item) => <SidebarButton key={item.value} item={item} active={activeTab === item.value} onSelect={onTabChange} />)}
          <CommercialSidebarMenu icon={Target}>
            <div className="grid gap-0.5">
              {commercialLinks.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onNavigate={(event) => {
                    if (guardCommercialNavigation?.(item.href)) event.preventDefault();
                  }}
                  className="flex min-h-10 items-center rounded-lg px-6 text-[13px] font-medium text-[#cbd5e1] transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </CommercialSidebarMenu>
          <div className="mt-1 grid gap-1">
            {resourceItems.map((item) => <SidebarButton key={item.label} item={item} active={activeTab === item.value} onSelect={onTabChange} />)}
            {statisticsNavigation}
          </div>
        </nav>

        <div className="mt-auto grid shrink-0 gap-3">
          <div className="h-px bg-white/10" />
          <button type="button" onClick={() => onTabChange("statistics")} className="flex min-h-10 items-center gap-3 rounded-lg px-4 text-[13px] font-medium text-[#cbd5e1] hover:bg-white/8 hover:text-white">
            <Settings className="size-[18px]" /> Paramètres
          </button>
          <div className="flex items-center gap-3 rounded-xl bg-white/6 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#dce5d7] text-xs font-bold text-[#2f493a]">{initials(userName)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{userName || "Mon compte"}</p>
              <p className={cn("mt-0.5 truncate text-[10px]", connected ? "text-[#9db8a2]" : "text-[#dfbd76]")}>{loading ? "Synchronisation…" : connected ? "Données synchronisées" : "Mode local"}</p>
            </div>
            <button type="button" onClick={onLogout} aria-label="Se déconnecter" title="Se déconnecter" className="grid size-8 place-items-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 hidden min-h-[72px] border-b border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)]/95 backdrop-blur md:ml-60 md:flex md:items-center">
        <div className="flex w-full items-center justify-between gap-5 px-6 py-3 lg:px-8">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--crm-riviera-text-secondary)]" />
            <Input value={contactSearch} onFocus={() => onTabChange("contacts")} onChange={(event) => { onContactSearchChange(event.target.value); onTabChange("contacts"); }} placeholder="Rechercher un contact, un bien, une adresse..." aria-label="Recherche globale du CRM" className="h-11 rounded-xl border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-canvas)] pl-11 text-[var(--crm-riviera-text-primary)]" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" className={rivieraPrimaryButtonClass} onClick={onCreateContact}><Plus className="size-4" />Créer</Button>
            <button type="button" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-xl border border-[var(--crm-riviera-border-default)] bg-white text-[var(--crm-riviera-text-secondary)]"><Bell className="size-[18px]" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[var(--crm-riviera-status-danger)]" /></button>
            <span className="grid size-10 place-items-center rounded-full bg-[var(--crm-riviera-bg-accent)] text-xs font-bold text-[var(--crm-riviera-text-action)]"><UserRound className="size-[18px]" /></span>
          </div>
        </div>
      </header>
    </>
  );
}

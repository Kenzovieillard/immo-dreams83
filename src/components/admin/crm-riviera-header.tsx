"use client";

import { ArrowLeft, LogOut, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  contactQualificationStatusLabels,
  contactRoleLabels,
} from "@/lib/crm";
import { cn } from "@/lib/utils";
import type { AdminCrmLead } from "@/types/crm";
import {
  crmTabMeta,
  type CrmTab,
} from "./crm-mobile-navigation";
import {
  RivieraStatusBadge,
  rivieraPrimaryButtonClass,
} from "./crm-riviera-ui";

const desktopTabs: Array<{ value: CrmTab; label: string }> = [
  { value: "overview", label: "Vue d'ensemble" },
  { value: "pipeline", label: "Pipeline" },
  { value: "contacts", label: "Contacts" },
  { value: "estimations", label: "Estimations" },
  { value: "legacyReview", label: "Demandes" },
  { value: "properties", label: "Biens" },
  { value: "activities", label: "Activité" },
  { value: "statistics", label: "Statistiques" },
];

function firstName(value: string) {
  const clean = value.trim();
  if (!clean) return "Kenzo";
  if (clean.includes("@")) return clean.split("@")[0];
  return clean.split(/\s+/)[0];
}

function formatReceivedAt(value: string) {
  const date = new Date(value);
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 60) return `reçu il y a ${elapsedMinutes} min`;
  if (elapsedMinutes < 24 * 60) return `reçu il y a ${Math.round(elapsedMinutes / 60)} h`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function CrmRivieraHeader({
  activeTab,
  onTabChange,
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
              <button
                type="button"
                onClick={onCloseContact}
                aria-label="Revenir aux contacts"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10"
              >
                <ArrowLeft className="size-5" />
              </button>
            ) : null}
            <h1 className="min-w-0 truncate text-[28px] font-bold leading-9">{mobileTitle}</h1>
          </div>
          <p className="truncate text-sm leading-5 text-white/75">{mobileDescription}</p>

          <div className="flex min-h-8 items-center gap-2 overflow-x-auto">
            {activeTab === "overview" ? (
              <>
                <RivieraStatusBadge tone={priorityCount ? "warning" : "success"}>
                  {priorityCount} urgence{priorityCount > 1 ? "s" : ""}
                </RivieraStatusBadge>
                <RivieraStatusBadge>{visitCount} visite{visitCount > 1 ? "s" : ""}</RivieraStatusBadge>
              </>
            ) : activeTab === "pipeline" ? (
              <>
                <RivieraStatusBadge tone={priorityCount ? "warning" : "success"}>
                  {priorityCount} priorité{priorityCount > 1 ? "s" : ""}
                </RivieraStatusBadge>
                <RivieraStatusBadge>{visitCount} visite{visitCount > 1 ? "s" : ""}</RivieraStatusBadge>
              </>
            ) : activeTab === "contacts" && selectedContact ? (
              <>
                <RivieraStatusBadge tone="success">
                  {selectedContact.contactRole
                    ? contactRoleLabels[selectedContact.contactRole]
                    : "Rôle à confirmer"}
                </RivieraStatusBadge>
                <RivieraStatusBadge
                  tone={selectedContact.qualificationStatus === "QUALIFIED" ? "success" : "warning"}
                >
                  {selectedContact.qualificationStatus
                    ? contactQualificationStatusLabels[selectedContact.qualificationStatus]
                    : "À revoir"}
                </RivieraStatusBadge>
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

      <header className="sticky top-0 z-40 hidden bg-[var(--crm-riviera-bg-header)] text-white md:block">
        <div className="mx-auto flex min-h-14 w-full max-w-screen-xl items-center justify-between gap-6 px-6 py-3 lg:px-8">
          <div className="min-w-0">
            <p className="truncate text-base font-bold">IMMO DREAMS83 · CRM Riviera</p>
            <p className={cn("mt-0.5 text-[11px] font-medium", connected ? "text-[#9db8a2]" : "text-[#dfbd76]")}>
              ● {loading ? "Synchronisation…" : connected ? "Données synchronisées" : "Mode local"}
            </p>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <div className="relative hidden w-full max-w-xs lg:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--crm-riviera-text-secondary)]" />
              <Input
                value={contactSearch}
                onFocus={() => onTabChange("contacts")}
                onChange={(event) => {
                  onContactSearchChange(event.target.value);
                  onTabChange("contacts");
                }}
                placeholder="Rechercher un contact, un bien..."
                aria-label="Recherche globale du CRM"
                className="h-10 rounded-2xl border-0 bg-[var(--crm-riviera-bg-accent)] pl-11 text-[var(--crm-riviera-text-primary)]"
              />
            </div>
            <Button type="button" className={rivieraPrimaryButtonClass} onClick={onCreateContact}>
              <Plus className="size-4" />
              Créer un contact
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onLogout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="size-10 rounded-xl text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
        <nav
          aria-label="Navigation principale du CRM"
          className="border-t border-white/10"
        >
          <div className="mx-auto grid w-full max-w-screen-xl grid-cols-8 gap-2 px-6 py-2 lg:px-8">
            {desktopTabs.map((tab) => {
              const active = tab.value === activeTab;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onTabChange(tab.value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "min-h-9 min-w-0 rounded-2xl px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                    active
                      ? "bg-[var(--crm-riviera-bg-accent)] font-semibold text-[var(--crm-riviera-text-primary)]"
                      : "text-white/75 hover:bg-white/8 hover:text-white"
                  )}
                >
                  {active ? "● " : ""}{tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>
    </>
  );
}

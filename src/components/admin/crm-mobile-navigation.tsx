"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  CalendarDays,
  FileText,
  Handshake,
  ContactRound,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  Settings,
  Target,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { commercialLinks } from "@/lib/commercial-navigation";

export type CrmTab =
  | "overview"
  | "pipeline"
  | "contacts"
  | "estimations"
  | "legacyReview"
  | "properties"
  | "agenda"
  | "activities"
  | "statistics"
  | "settings";

type NavigationItem = {
  value: CrmTab;
  label: string;
  icon: LucideIcon;
};

export const crmTabMeta: Record<CrmTab, { title: string; description: string }> = {
  overview: {
    title: "Vue d'ensemble",
    description: "Priorités, alertes et activité du jour.",
  },
  pipeline: {
    title: "Pipeline",
    description: "Prospects, rappels et prochaines actions.",
  },
  contacts: {
    title: "Contacts",
    description: "Qualifier et faire avancer chaque demande.",
  },
  estimations: {
    title: "Estimations",
    description: "Suivre les demandes d'avis de valeur.",
  },
  legacyReview: {
    title: "Anciennes demandes",
    description: "Contrôler les données avant migration.",
  },
  properties: {
    title: "Biens",
    description: "Catalogue, qualité et publication.",
  },
  agenda: { title: "Agenda & Tâches", description: "Planification, échéances et rappels internes." },
  activities: {
    title: "Activités",
    description: "Historique opérationnel de l'agence.",
  },
  statistics: {
    title: "Statistiques",
    description: "Indicateurs issus des données disponibles.",
  },
  settings: {
    title: "Paramètres",
    description: "Configuration de l’agence et de votre compte.",
  },
};

const primaryItems: NavigationItem[] = [
  { value: "overview", label: "Accueil", icon: LayoutDashboard },
  { value: "contacts", label: "Contacts", icon: ContactRound },
  { value: "properties", label: "Biens", icon: Building2 },
];

const secondaryItems: NavigationItem[] = [
  { value: "agenda", label: "Agenda", icon: CalendarDays },
  { value: "legacyReview", label: "Anciennes demandes", icon: ListChecks },
  { value: "activities", label: "Activités", icon: History },
  { value: "statistics", label: "Statistiques", icon: BarChart3 },
  { value: "settings", label: "Paramètres", icon: Settings },
];

const commercialIcons = {
  pipeline: Target,
  estimations: ClipboardCheck,
  visites: CalendarDays,
  offres: FileText,
  negociations: Handshake,
};

function scrollToPageStart() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
}

export function CrmMobileNavigation({
  activeTab,
  onTabChange,
  guardCommercialNavigation,
  onLogout,
  quickAction,
}: {
  activeTab: CrmTab;
  onTabChange: (tab: CrmTab) => void;
  guardCommercialNavigation?: (href: string) => boolean;
  onLogout: () => void;
  quickAction?: {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
  };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const secondaryActive = secondaryItems.some((item) => item.value === activeTab);
  const actionEmphasized = activeTab === "overview" || secondaryActive;
  const QuickActionIcon = quickAction?.icon;

  function selectTab(tab: CrmTab) {
    onTabChange(tab);
    setMenuOpen(false);
    window.setTimeout(scrollToPageStart, menuOpen ? 220 : 0);
  }

  return (
    <>
      <nav
        aria-label="Navigation principale du CRM"
        className="crm-mobile-dock fixed inset-x-0 bottom-0 z-40 border-t border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-8px_rgb(23_34_30/0.16)] md:hidden"
      >
        <div className="mx-auto grid h-[72px] max-w-md grid-cols-4 gap-1">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => selectTab(item.value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-medium text-[var(--crm-riviera-text-secondary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]",
                  active && "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-action)]"
                )}
              >
                <Icon className="size-6" />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-current={secondaryActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-medium text-[var(--crm-riviera-text-secondary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]",
                    actionEmphasized && "bg-[var(--crm-riviera-bg-action)] text-white"
                  )}
                />
              }
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full",
                  actionEmphasized
                    ? "bg-[var(--crm-riviera-bg-accent)] text-[var(--crm-riviera-text-action)]"
                    : "text-[var(--crm-riviera-text-action)]"
                )}
              >
                <Plus className="size-6" />
              </span>
              <span>Action</span>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="crm-riviera max-h-[82dvh] rounded-t-2xl border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-canvas)] pb-[env(safe-area-inset-bottom)]"
            >
              <SheetHeader className="border-b border-[var(--crm-riviera-border-default)] px-4 pt-5 pb-4 pr-14 text-left">
                <SheetTitle className="text-lg font-bold text-[var(--crm-riviera-text-primary)]">Actions et outils</SheetTitle>
                <SheetDescription>Les commandes utiles restent accessibles avec le pouce droit.</SheetDescription>
              </SheetHeader>
              {quickAction && QuickActionIcon ? (
                <div className="px-4">
                  <Button
                    type="button"
                    onClick={() => {
                      quickAction.onClick();
                      setMenuOpen(false);
                    }}
                    className="h-12 w-full rounded-2xl bg-[var(--crm-riviera-bg-action)] px-4 font-semibold text-white hover:bg-[var(--crm-riviera-bg-header)]"
                  >
                    <QuickActionIcon className="size-5" />
                    {quickAction.label}
                  </Button>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 px-4">
                {commercialLinks.map((item) => {
                  const Icon = commercialIcons[item.key];
                  return (
                    <Link key={item.key} href={item.href} onClick={() => setMenuOpen(false)} onNavigate={(event) => { if (guardCommercialNavigation?.(item.href)) event.preventDefault(); }} className="flex min-h-20 flex-col items-start justify-between rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-3 text-left text-sm font-semibold text-[var(--crm-riviera-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]">
                      <Icon className="size-5" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
                {secondaryItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => selectTab(item.value)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-20 flex-col items-start justify-between rounded-2xl border border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] p-3 text-left text-sm font-semibold text-[var(--crm-riviera-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-riviera-bg-action)]",
                        active && "border-[var(--crm-riviera-bg-action)] bg-[var(--crm-riviera-bg-accent)]"
                      )}
                    >
                      <Icon className="size-5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <SheetFooter className="border-t border-[var(--crm-riviera-border-default)]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onLogout}
                  className="h-12 justify-center rounded-2xl border-[var(--crm-riviera-border-default)] bg-[var(--crm-riviera-bg-surface)] text-[var(--crm-riviera-text-primary)]"
                >
                  <LogOut className="size-4" />
                  Déconnexion
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}

"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  ContactRound,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MoreHorizontal,
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

export type CrmTab =
  | "overview"
  | "pipeline"
  | "contacts"
  | "estimations"
  | "legacyReview"
  | "properties"
  | "activities"
  | "statistics";

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
  activities: {
    title: "Activités",
    description: "Historique opérationnel de l'agence.",
  },
  statistics: {
    title: "Statistiques",
    description: "Indicateurs issus des données disponibles.",
  },
};

const primaryItems: NavigationItem[] = [
  { value: "overview", label: "Accueil", icon: LayoutDashboard },
  { value: "contacts", label: "Contacts", icon: ContactRound },
  { value: "properties", label: "Biens", icon: Building2 },
  { value: "pipeline", label: "Pipeline", icon: Target },
];

const secondaryItems: NavigationItem[] = [
  { value: "estimations", label: "Estimations", icon: ClipboardCheck },
  { value: "legacyReview", label: "Anciennes demandes", icon: ListChecks },
  { value: "activities", label: "Activités", icon: History },
  { value: "statistics", label: "Statistiques", icon: BarChart3 },
];

function scrollToPageStart() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
}

export function CrmMobileNavigation({
  activeTab,
  onTabChange,
  onLogout,
  quickAction,
}: {
  activeTab: CrmTab;
  onTabChange: (tab: CrmTab) => void;
  onLogout: () => void;
  quickAction?: {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
  };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const secondaryActive = secondaryItems.some((item) => item.value === activeTab);
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
        className="crm-mobile-dock fixed inset-x-0 bottom-0 z-40 border-t border-[#e8e3da] bg-white/96 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_32px_rgb(17_17_17/0.09)] backdrop-blur-md md:hidden"
      >
        {quickAction && QuickActionIcon ? (
          <div className="mx-auto flex max-w-md justify-end pb-2">
            <Button
              type="button"
              onClick={quickAction.onClick}
              className="h-12 rounded-lg bg-orange-500 px-4 font-bold text-white shadow-[0_8px_22px_rgb(17_17_17/0.14)] hover:bg-orange-600"
            >
              <QuickActionIcon className="size-5" />
              {quickAction.label}
            </Button>
          </div>
        ) : null}
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
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
                  "flex min-h-13 min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold text-gray-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500",
                  active && "bg-[#111111] text-white",
                  item.value === "pipeline" && !active && "text-orange-700"
                )}
              >
                <Icon className="size-5" />
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
                    "flex min-h-13 min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold text-gray-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500",
                    secondaryActive && "bg-[#111111] text-white"
                  )}
                />
              }
            >
              <MoreHorizontal className="size-5" />
              <span>Plus</span>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="crm-riviera max-h-[75dvh] rounded-t-lg border-[#e8e3da] bg-[#fbf9f4] pb-[env(safe-area-inset-bottom)]"
            >
              <SheetHeader className="border-b border-[#e8e3da] px-4 pt-5 pb-4 pr-14 text-left">
                <SheetTitle className="text-lg font-bold text-[#111111]">Plus d&apos;outils</SheetTitle>
                <SheetDescription>Les vues de contrôle et de suivi secondaire.</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-2 px-4">
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
                        "flex min-h-20 flex-col items-start justify-between rounded-lg border border-[#e8e3da] bg-white p-3 text-left text-sm font-bold text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500",
                        active && "border-orange-300 bg-orange-50 text-orange-800"
                      )}
                    >
                      <Icon className="size-5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <SheetFooter className="border-t border-[#e8e3da]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onLogout}
                  className="h-12 justify-center border-[#d8d2c8] bg-white text-[#111111]"
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

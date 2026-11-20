"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ContactRound,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { commercialLinks } from "@/lib/commercial-navigation";
import { CommercialSidebarMenu } from "./commercial-sidebar-menu";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  pathname,
  userName,
  onNavigate,
}: {
  pathname: string;
  userName: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const demoMode = userName === "Aperçu Figma";
  const actionCountQuery = useQuery({
    queryKey: ["commercial-negotiations", "sidebar-count"],
    enabled: !demoMode,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await fetch(
        "/api/admin/commercial/negotiations?limit=200",
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        kpis?: { actionRequired?: number };
      } | null;
      if (!response.ok || !payload?.success) return 0;
      return payload.kpis?.actionRequired ?? 0;
    },
  });
  const negotiationActionCount = demoMode ? 3 : (actionCountQuery.data ?? 0);

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/admin/login");
    router.refresh();
  }

  const baseLink =
    "flex min-h-9 items-center gap-3 rounded-lg px-4 text-[13px] font-medium transition";
  return (
    <div className="flex h-full flex-col px-5 py-5 text-white">
      <Link href="/commercial/pipeline" onClick={onNavigate} className="block">
        <p className="text-lg font-bold tracking-[-0.04em]">IMMO DREAMS83</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-[#b9c9bb]">
          CRM Riviera v2
        </p>
      </Link>
      <div className="my-5 h-px bg-white/10" />
      <nav aria-label="Navigation CRM" className="grid gap-1">
        <Link
          href="/admin"
          onClick={onNavigate}
          className={cn(
            baseLink,
            "text-[#cbd5e1] hover:bg-white/8 hover:text-white",
          )}
        >
          <LayoutDashboard className="size-4" />
          Vue d&apos;ensemble
        </Link>
        <Link
          href="/admin?tab=contacts"
          onClick={onNavigate}
          className={cn(
            baseLink,
            "text-[#cbd5e1] hover:bg-white/8 hover:text-white",
          )}
        >
          <ContactRound className="size-4" />
          Contacts
        </Link>
        <CommercialSidebarMenu icon={BriefcaseBusiness} defaultOpen>
          <div className="grid gap-0.5 pl-2">
            {commercialLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                aria-current={isActive(pathname, link.href) ? "page" : undefined}
                className={cn(
                  baseLink,
                  "pl-6",
                  isActive(pathname, link.href)
                    ? "bg-[#2f493a] font-semibold text-white"
                    : "text-[#cbd5e1] hover:bg-white/8 hover:text-white",
                )}
              >
                {link.label === "Négociations" ? (
                  <Handshake className="size-3.5" />
                ) : null}
                <span className="flex-1">{link.label}</span>
                {link.label === "Négociations" && negotiationActionCount > 0 ? (
                  <span
                    aria-label={`${negotiationActionCount} négociations nécessitent une action`}
                    className="grid min-w-5 place-items-center rounded-full bg-[#a94d43] px-1.5 py-0.5 text-[10px] font-bold text-white"
                  >
                    {negotiationActionCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </CommercialSidebarMenu>
        <Link
          href="/admin?tab=properties"
          onClick={onNavigate}
          className={cn(
            baseLink,
            "mt-1 text-[#cbd5e1] hover:bg-white/8 hover:text-white",
          )}
        >
          <Building2 className="size-4" />
          Biens
        </Link>
        <Link
          href="/admin?tab=activities"
          onClick={onNavigate}
          className={cn(
            baseLink,
            "text-[#cbd5e1] hover:bg-white/8 hover:text-white",
          )}
        >
          <CalendarDays className="size-4" />
          Agenda
        </Link>
        <Link
          href="/admin?tab=statistics"
          onClick={onNavigate}
          className={cn(
            baseLink,
            "text-[#cbd5e1] hover:bg-white/8 hover:text-white",
          )}
        >
          <BarChart3 className="size-4" />
          Statistiques
        </Link>
      </nav>
      <div className="mt-auto grid gap-3">
        <div className="h-px bg-white/10" />
        <Link
          href="/admin?tab=statistics"
          onClick={onNavigate}
          className={cn(
            baseLink,
            "text-[#cbd5e1] hover:bg-white/8 hover:text-white",
          )}
        >
          <Settings className="size-4" />
          Paramètres
        </Link>
        <div className="flex items-center gap-3 rounded-xl bg-white/6 p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#dce5d7] text-xs font-bold text-[#274331]">
            {userName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{userName}</p>
            <p className="mt-0.5 truncate text-[10px] text-[#9db8a2]">
              Compte CRM
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Se déconnecter"
            className="grid size-8 place-items-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function CommercialShell({
  children,
  userName,
}: {
  children: ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="crm-riviera min-h-dvh bg-[#f6f4ef] text-[#18211f]">
        <aside className="fixed inset-y-0 left-0 z-50 hidden w-60 bg-[#17221e] lg:block">
          <SidebarContent pathname={pathname} userName={userName} />
        </aside>
        {mobileOpen ? (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <button
              type="button"
              aria-label="Fermer la navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-black/45"
            />
            <aside className="absolute inset-y-0 left-0 w-[min(86vw,320px)] bg-[#17221e] shadow-2xl">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer"
                className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-lg bg-white/10 text-white"
              >
                <X className="size-5" />
              </button>
              <SidebarContent
                pathname={pathname}
                userName={userName}
                onNavigate={() => setMobileOpen(false)}
              />
            </aside>
          </div>
        ) : null}
        <div className="min-h-dvh lg:ml-60">
          <header className="sticky top-0 z-40 flex min-h-[72px] items-center border-b border-[#dfddd4] bg-[#fbfaf7]/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir la navigation"
              className="mr-3 grid size-10 place-items-center rounded-lg border border-[#dfddd4] lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <form action="/admin" method="get" className="relative hidden w-full max-w-[480px] sm:block">
              <input type="hidden" name="tab" value="contacts" />
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#69736e]" />
              <input
                name="q"
                aria-label="Recherche globale"
                placeholder="Rechercher un contact, un bien, une adresse..."
                className="h-10 w-full rounded-xl border border-[#dfddd4] bg-[#f8f7f3] pl-11 pr-4 text-sm outline-none focus:border-[#2f493a]"
              />
            </form>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/commercial/estimations/nouvelle"
                className="hidden min-h-9 items-center gap-2 rounded-lg bg-[#2f493a] px-4 text-sm font-semibold text-white sm:inline-flex"
              >
                <Plus className="size-4" />
                Créer
              </Link>
              <Link
                href="/commercial/negociations"
                aria-label="Notifications de négociation"
                className="relative grid size-10 place-items-center rounded-full border border-[#dfddd4] bg-[#fbfaf7]"
              >
                <Bell className="size-[18px]" />
              </Link>
              <span className="grid size-9 place-items-center rounded-full bg-[#2f493a] text-xs font-bold text-white">
                {userName.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden max-w-48 truncate text-sm font-semibold xl:inline">
                {userName}
              </span>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}

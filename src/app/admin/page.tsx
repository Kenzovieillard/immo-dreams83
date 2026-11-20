import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import type { CrmTab } from "@/components/admin/crm-mobile-navigation";
import { getAdminSession, hasAdminPermission } from "@/lib/admin-auth";
import { commercialHrefForTab } from "@/lib/commercial-navigation";
import { getCrmAgencyInformation } from "@/lib/crm-settings-service";

export const metadata: Metadata = {
  title: "Administration locale",
  robots: { index: false, follow: false, nocache: true },
};

const validTabs = new Set(["overview", "pipeline", "contacts", "estimations", "legacyReview", "properties", "agenda", "activities", "statistics", "settings"]);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; contact?: string; property?: string; q?: string; dossier?: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const connected = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const query = await searchParams;
  const commercialHref = commercialHrefForTab(query.tab);
  if (commercialHref) {
    const suffix = query.tab === "pipeline" && query.dossier
      ? `?${new URLSearchParams({ dossier: query.dossier })}`
      : "";
    redirect(`${commercialHref}${suffix}`);
  }
  const initialTab = validTabs.has(query.tab ?? "") ? query.tab as CrmTab : "overview";
  const agency = await getCrmAgencyInformation();

  return (
    <AdminDashboard
      key={`${initialTab}:${query.contact ?? ""}:${query.property ?? ""}`}
      contacts={[]}
      estimations={[]}
      activities={[]}
      properties={[]}
      connected={connected}
      userName={session.profile.full_name ?? session.user.email}
      agencyName={agency.name}
      userRole={session.profile.role}
      canWriteProperties={hasAdminPermission(session.profile.role, "property.write")}
      initialTab={initialTab}
      initialContactId={query.contact ?? null}
      initialPropertyId={query.property ?? null}
      initialSearch={query.q ?? ""}
    />
  );
}

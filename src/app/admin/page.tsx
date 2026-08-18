import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Administration locale",
  robots: { index: false, follow: false, nocache: true },
};

const validTabs = new Set(["overview", "pipeline", "contacts", "estimations", "legacyReview", "properties", "activities", "statistics"]);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; contact?: string; property?: string; q?: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const connected = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const query = await searchParams;
  const initialTab = validTabs.has(query.tab ?? "") ? query.tab as "overview" | "pipeline" | "contacts" | "estimations" | "legacyReview" | "properties" | "activities" | "statistics" : "overview";

  return (
    <AdminDashboard
      contacts={[]}
      estimations={[]}
      activities={[]}
      properties={[]}
      connected={connected}
      userName={session.profile.full_name ?? session.user.email}
      userRole={session.profile.role}
      initialTab={initialTab}
      initialContactId={query.contact ?? null}
      initialPropertyId={query.property ?? null}
      initialSearch={query.q ?? ""}
    />
  );
}

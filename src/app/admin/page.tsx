import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Administration locale",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const connected = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return (
    <AdminDashboard
      contacts={[]}
      estimations={[]}
      activities={[]}
      properties={[]}
      connected={connected}
      userName={session.profile.full_name ?? session.user.email}
      userRole={session.profile.role}
    />
  );
}

import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { properties } from "@/data/properties";

export const metadata: Metadata = {
  title: "Administration locale",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  const expectedCode = process.env.NEXT_PUBLIC_ADMIN_LOCAL_CODE || "";
  const connected = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return (
    <AdminDashboard
      contacts={[]}
      estimations={[]}
      activities={[]}
      properties={properties}
      connected={connected}
      expectedCode={expectedCode}
    />
  );
}

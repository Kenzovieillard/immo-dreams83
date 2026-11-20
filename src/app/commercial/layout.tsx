import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommercialShell } from "@/components/commercial/commercial-shell";
import { getAdminSession } from "@/lib/admin-auth";
import { getCrmAgencyInformation } from "@/lib/crm-settings-service";

export const metadata: Metadata = {
  title: "Commercial | CRM Riviera",
  robots: { index: false, follow: false, nocache: true },
};

export default async function CommercialLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/pipeline");

  const agency = await getCrmAgencyInformation();
  return <CommercialShell agencyName={agency.name} userName={session.profile.full_name ?? session.user.email}>{children}</CommercialShell>;
}

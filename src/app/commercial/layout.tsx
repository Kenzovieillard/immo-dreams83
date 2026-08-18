import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommercialShell } from "@/components/commercial/commercial-shell";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Commercial | CRM Riviera",
  robots: { index: false, follow: false, nocache: true },
};

export default async function CommercialLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/pipeline");

  return <CommercialShell userName={session.profile.full_name ?? session.user.email}>{children}</CommercialShell>;
}

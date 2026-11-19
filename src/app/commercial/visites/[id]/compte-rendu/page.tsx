import { notFound, redirect } from "next/navigation";
import { VisitReportConnected } from "@/components/commercial/visits-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialVisits } from "@/lib/commercial-service";

export default async function CommercialVisitReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!session) redirect(`/admin/login?redirect=/commercial/visites/${id}/compte-rendu`);
  const data = await loadCommercialVisits(session, { id });
  if (!data.detail) notFound();
  return <VisitReportConnected data={data} />;
}

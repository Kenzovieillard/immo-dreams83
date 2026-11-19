import { notFound, redirect } from "next/navigation";
import { EstimationDetailConnected } from "@/components/commercial/estimations-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialEstimations } from "@/lib/commercial-service";

export default async function CommercialEstimationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!session) redirect(`/admin/login?redirect=/commercial/estimations/${id}`);
  const data = await loadCommercialEstimations(session, { id });
  if (!data.detail) notFound();
  return <EstimationDetailConnected data={data} />;
}

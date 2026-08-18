import { redirect } from "next/navigation";
import { EstimationsListConnected } from "@/components/commercial/estimations-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialEstimations } from "@/lib/commercial-service";

export default async function CommercialEstimationsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/estimations");
  return <EstimationsListConnected data={await loadCommercialEstimations(session)} />;
}

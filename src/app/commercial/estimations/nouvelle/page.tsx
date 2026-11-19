import { redirect } from "next/navigation";
import { EstimationCreateConnected } from "@/components/commercial/estimations-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialEstimations } from "@/lib/commercial-service";

export default async function CommercialEstimationCreatePage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/estimations/nouvelle");
  return <EstimationCreateConnected data={await loadCommercialEstimations(session, { limit: 1 })} />;
}

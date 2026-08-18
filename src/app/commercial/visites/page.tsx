import { redirect } from "next/navigation";
import { VisitsListConnected } from "@/components/commercial/visits-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialVisits } from "@/lib/commercial-service";

export default async function CommercialVisitsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/visites");
  return <VisitsListConnected data={await loadCommercialVisits(session)} />;
}

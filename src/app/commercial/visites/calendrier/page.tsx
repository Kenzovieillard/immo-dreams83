import { redirect } from "next/navigation";
import { VisitCalendarConnected } from "@/components/commercial/visits-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialVisits } from "@/lib/commercial-service";

export default async function CommercialVisitsCalendarPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/visites/calendrier");
  return <VisitCalendarConnected data={await loadCommercialVisits(session, { limit: 500 })} />;
}

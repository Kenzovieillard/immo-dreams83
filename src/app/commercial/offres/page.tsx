import { redirect } from "next/navigation";
import { OffersListConnected } from "@/components/commercial/offers-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialOffers } from "@/lib/commercial-service";

export default async function CommercialOffersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/offres");
  return <OffersListConnected data={await loadCommercialOffers(session)} />;
}

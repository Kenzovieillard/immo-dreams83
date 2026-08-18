import { notFound, redirect } from "next/navigation";
import { OfferDetailConnected } from "@/components/commercial/offers-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialOffers } from "@/lib/commercial-service";

export default async function CommercialOfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!session) redirect(`/admin/login?redirect=/commercial/offres/${id}`);
  const data = await loadCommercialOffers(session, { id });
  if (!data.detail) notFound();
  return <OfferDetailConnected data={data} />;
}

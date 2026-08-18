import { redirect } from "next/navigation";
import { OfferCreateConnected } from "@/components/commercial/offers-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialOffers } from "@/lib/commercial-service";
import { normalizeCommercialPrefill } from "@/lib/commercial-validation";

export default async function CommercialOfferCreatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/offres/nouvelle");
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  const prefill = normalizeCommercialPrefill(params);
  return <OfferCreateConnected data={await loadCommercialOffers(session, { propertyId: prefill.propertyId, contactId: prefill.contactId, visitId: prefill.visitId, limit: 1 })} />;
}

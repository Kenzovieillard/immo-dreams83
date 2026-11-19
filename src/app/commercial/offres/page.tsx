import { redirect } from "next/navigation";
import { OffersListConnected } from "@/components/commercial/offers-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialOffers } from "@/lib/commercial-service";

export default async function CommercialOffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/offres");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "ALL";
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  return (
    <OffersListConnected
      data={await loadCommercialOffers(session, {
        query,
        status: status === "ALL" ? undefined : status,
        page,
      })}
      filters={{ query, status }}
    />
  );
}

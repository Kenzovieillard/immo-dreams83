import { redirect } from "next/navigation";
import { EstimationsListConnected } from "@/components/commercial/estimations-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialEstimations } from "@/lib/commercial-service";

export default async function CommercialEstimationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/estimations");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "ALL";
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  return (
    <EstimationsListConnected
      data={await loadCommercialEstimations(session, {
        query,
        status: status === "ALL" ? undefined : status,
        page,
      })}
      filters={{ query, status }}
    />
  );
}

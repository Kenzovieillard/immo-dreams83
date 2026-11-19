import { redirect } from "next/navigation";
import { VisitsListConnected } from "@/components/commercial/visits-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialVisits } from "@/lib/commercial-service";

export default async function CommercialVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/visites");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "ALL";
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  return (
    <VisitsListConnected
      data={await loadCommercialVisits(session, {
        query,
        status: status === "ALL" ? undefined : status,
        page,
      })}
      filters={{ query, status }}
    />
  );
}

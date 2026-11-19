import { redirect } from "next/navigation";
import { VisitCreateConnected } from "@/components/commercial/visits-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialVisits } from "@/lib/commercial-service";
import { normalizeCommercialPrefill } from "@/lib/commercial-validation";

export default async function CommercialVisitCreatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/visites/nouvelle");
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  const prefill = normalizeCommercialPrefill(params);
  return <VisitCreateConnected data={await loadCommercialVisits(session, { limit: 1 })} prefill={prefill} />;
}

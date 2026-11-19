import { redirect } from "next/navigation";
import { CommercialPipelineConnected } from "@/components/commercial/pipeline-connected";
import { getAdminSession } from "@/lib/admin-auth";
import { loadCommercialPipeline } from "@/lib/commercial-service";

export default async function CommercialPipelinePage({ searchParams }: { searchParams: Promise<{ dossier?: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login?redirect=/commercial/pipeline");
  const data = await loadCommercialPipeline(session);
  const { dossier } = await searchParams;
  return <CommercialPipelineConnected initialData={data} initialSelectedId={data.cards.some((card) => card.id === dossier) ? dossier : null} />;
}

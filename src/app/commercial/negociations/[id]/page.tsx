import { Suspense } from "react";
import { BentoCardSkeleton } from "@/components/admin/bento/bento-states";
import { CommercialPanel } from "@/components/commercial/commercial-ui";
import { NegotiationDetailScreen } from "@/components/commercial/negotiations-screens";

export default async function CommercialNegotiationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<CommercialPanel className="p-6"><BentoCardSkeleton lines={8} /></CommercialPanel>}>
      <NegotiationDetailScreen id={id} />
    </Suspense>
  );
}

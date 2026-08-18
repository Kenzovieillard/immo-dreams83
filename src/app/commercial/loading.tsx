import { BentoCardSkeleton } from "@/components/admin/bento/bento-states";
import { CommercialPanel } from "@/components/commercial/commercial-ui";

export default function CommercialLoading() {
  return (
    <div
      className="grid gap-5"
      aria-busy="true"
      aria-label="Chargement du CRM commercial"
    >
      <CommercialPanel className="p-6">
        <BentoCardSkeleton lines={3} />
      </CommercialPanel>
      <div className="grid gap-5 lg:grid-cols-3">
        <CommercialPanel className="p-6 lg:col-span-2">
          <BentoCardSkeleton lines={8} />
        </CommercialPanel>
        <CommercialPanel className="p-6">
          <BentoCardSkeleton lines={6} />
        </CommercialPanel>
      </div>
    </div>
  );
}

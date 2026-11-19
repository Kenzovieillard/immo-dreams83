"use client";

import { BentoErrorState } from "@/components/admin/bento/bento-states";
import {
  CommercialPanel,
  commercialPrimaryButton,
} from "@/components/commercial/commercial-ui";

export default function CommercialError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <CommercialPanel className="grid gap-5 p-6">
      <BentoErrorState message="Les données commerciales n'ont pas pu être chargées. Vérifiez la connexion puis réessayez." />
      <button type="button" onClick={reset} className={commercialPrimaryButton}>
        Réessayer
      </button>
    </CommercialPanel>
  );
}

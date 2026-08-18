import { Suspense } from "react";
import { headers } from "next/headers";
import { BentoCardSkeleton } from "@/components/admin/bento/bento-states";
import { CommercialPanel } from "@/components/commercial/commercial-ui";
import {
  NegotiationsHubScreen,
  type NegotiationsPayload,
} from "@/components/commercial/negotiations-screens";

async function getInitialNegotiations(): Promise<NegotiationsPayload | undefined> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return undefined;

  const protocol = requestHeaders.get("x-forwarded-proto")
    ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const response = await fetch(`${protocol}://${host}/api/admin/commercial/negotiations`, {
    cache: "no-store",
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
  }).catch(() => null);
  if (!response?.ok) return undefined;

  const payload = await response.json().catch(() => null) as NegotiationsPayload | null;
  return payload?.success ? payload : undefined;
}

async function NegotiationsHubStream() {
  const initialData = await getInitialNegotiations();
  return <NegotiationsHubScreen initialData={initialData} />;
}

export default function CommercialNegotiationsPage() {
  return (
    <Suspense fallback={<CommercialPanel className="p-6"><BentoCardSkeleton lines={6} /></CommercialPanel>}>
      <NegotiationsHubStream />
    </Suspense>
  );
}

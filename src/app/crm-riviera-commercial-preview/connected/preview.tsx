"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { CommercialShell } from "@/components/commercial/commercial-shell";
import { CommercialPreviewContext } from "@/components/commercial/commercial-ui";
import {
  EstimationsListConnected,
  EstimationCreateConnected,
  EstimationDetailConnected,
} from "@/components/commercial/estimations-connected";
import {
  OffersListConnected,
  OfferCreateConnected,
  OfferDetailConnected,
} from "@/components/commercial/offers-connected";
import {
  VisitsListConnected,
  VisitCalendarConnected,
  VisitCreateConnected,
  VisitDetailConnected,
  VisitReportConnected,
} from "@/components/commercial/visits-connected";
import { CommercialPipelineConnected } from "@/components/commercial/pipeline-connected";
import {
  NegotiationsHubScreen,
  NegotiationDetailScreen,
} from "@/components/commercial/negotiations-screens";
import {
  negotiationFixtures,
  negotiationDemoKpis,
} from "@/components/commercial/negotiation-data";
import {
  estimationPayload,
  offerPayload,
  visitPayload,
  pipelinePayload,
} from "./fixtures";

const filters = { query: "", status: "ALL" };
const negotiations = {
  success: true,
  data: negotiationFixtures,
  kpis: negotiationDemoKpis,
};
const views = {
  pipeline: <CommercialPipelineConnected initialData={pipelinePayload} />,
  estimations: (
    <EstimationsListConnected data={estimationPayload} filters={filters} />
  ),
  "estimation-detail": <EstimationDetailConnected data={estimationPayload} />,
  "estimation-create": <EstimationCreateConnected data={estimationPayload} />,
  visits: <VisitsListConnected data={visitPayload} filters={filters} />,
  "visit-calendar": <VisitCalendarConnected data={visitPayload} />,
  "visit-detail": <VisitDetailConnected data={visitPayload} />,
  "visit-create": (
    <VisitCreateConnected
      data={visitPayload}
      prefill={{ propertyId: null, contactId: null }}
    />
  ),
  "visit-report": <VisitReportConnected data={visitPayload} />,
  offers: <OffersListConnected data={offerPayload} filters={filters} />,
  "offer-create": <OfferCreateConnected data={offerPayload} />,
  "offer-detail": <OfferDetailConnected data={offerPayload} />,
  negotiations: <NegotiationsHubScreen initialData={negotiations} demoMode />,
  "negotiation-detail": (
    <NegotiationDetailScreen
      id={negotiationFixtures[0].id}
      initialData={negotiations}
      demoMode
    />
  ),
};
export function CommercialConnectedPreview({ screen }: { screen: string }) {
  const readiness = useRef<HTMLElement>(null);
  useEffect(() => {
    readiness.current?.setAttribute("data-ui-ready", "true");
  }, []);
  return (
    <CommercialPreviewContext value={true}>
      <CommercialShell userName="Aperçu Figma">
        <aside ref={readiness} className="mb-6 rounded-lg border border-[#ecd7ad] bg-[#f7edd7] p-3 text-xs">
          <p className="font-semibold">
            Recette UI isolée · données fictives · aucune validation métier
            Supabase
          </p>
          <nav
            aria-label="Écrans de recette"
            className="mt-2 flex flex-wrap gap-3"
          >
            {Object.keys(views).map((key) => (
              <Link
                key={key}
                className="underline"
                href={"/crm-riviera-commercial-preview/connected?screen=" + key}
              >
                {key}
              </Link>
            ))}
          </nav>
        </aside>
        {views[screen as keyof typeof views] ?? views.estimations}
      </CommercialShell>
    </CommercialPreviewContext>
  );
}

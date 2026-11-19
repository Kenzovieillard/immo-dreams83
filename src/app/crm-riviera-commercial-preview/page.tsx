import type { Metadata } from "next";
import { CommercialShell } from "@/components/commercial/commercial-shell";
import { CommercialPipelineScreen } from "@/components/commercial/pipeline-screen";
import {
  EstimationCreateScreen,
  EstimationDetailScreen,
  EstimationsListScreen,
} from "@/components/commercial/estimations-screens";
import {
  OfferCreateScreen,
  OfferDetailScreen,
  OffersListScreen,
} from "@/components/commercial/offers-screens";
import {
  negotiationDemoKpis,
  negotiationFixtures,
} from "@/components/commercial/negotiation-data";
import {
  NegotiationDetailScreen,
  NegotiationsHubScreen,
  type NegotiationsPayload,
} from "@/components/commercial/negotiations-screens";
import {
  VisitDetailScreen,
  VisitReportScreen,
  VisitsCalendarScreen,
  VisitsListScreen,
} from "@/components/commercial/visits-screens";

export const metadata: Metadata = {
  title: "Aperçu Commercial | CRM Riviera",
  robots: { index: false, follow: false, nocache: true },
};

const negotiationPreviewData: NegotiationsPayload = {
  success: true,
  data: negotiationFixtures,
  kpis: negotiationDemoKpis,
};

const screens = {
  pipeline: <CommercialPipelineScreen />,
  estimations: <EstimationsListScreen />,
  "estimation-detail": <EstimationDetailScreen id="demo-estimation-mimosas" />,
  "estimation-create": <EstimationCreateScreen />,
  visits: <VisitsListScreen />,
  "visit-detail": <VisitDetailScreen id="demo-visit-1" />,
  "visit-calendar": <VisitsCalendarScreen />,
  "visit-report": <VisitReportScreen id="demo-visit-report" />,
  offers: <OffersListScreen />,
  "offer-detail": <OfferDetailScreen id="demo-offer-pierre" />,
  "offer-create": <OfferCreateScreen />,
  negotiations: (
    <NegotiationsHubScreen demoMode initialData={negotiationPreviewData} />
  ),
  "negotiation-detail": (
    <NegotiationDetailScreen
      id="demo-negotiation-pierre"
      demoMode
      initialData={negotiationPreviewData}
    />
  ),
} as const;

export default async function CommercialPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  const { screen } = await searchParams;
  const selected =
    screen && screen in screens
      ? screens[screen as keyof typeof screens]
      : screens.pipeline;
  return <CommercialShell userName="Aperçu Figma">{selected}</CommercialShell>;
}

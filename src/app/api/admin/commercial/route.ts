import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { commercialApiError } from "@/lib/commercial-api";
import {
  loadCommercialEstimations,
  loadCommercialOffers,
  loadCommercialPipeline,
  loadCommercialVisits,
} from "@/lib/commercial-service";

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  try {
    const [pipeline, estimations, visits, offers] = await Promise.all([
      loadCommercialPipeline(auth.session),
      loadCommercialEstimations(auth.session),
      loadCommercialVisits(auth.session),
      loadCommercialOffers(auth.session),
    ]);
    return NextResponse.json({
      success: true,
      source: "supabase",
      generatedAt: new Date().toISOString(),
      pipeline,
      estimations,
      visits,
      offers,
    });
  } catch (error) {
    return commercialApiError(
      error,
      "Le module Commercial n'a pas pu être chargé.",
    );
  }
}

function dedicatedEndpointResponse() {
  return NextResponse.json(
    {
      success: false,
      code: "DEDICATED_ENDPOINT_REQUIRED",
      message:
        "Utilisez l'API métier dédiée : /pipeline, /estimations, /visites ou /offres.",
    },
    { status: 410 },
  );
}

export async function POST() {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;
  return dedicatedEndpointResponse();
}

export async function PATCH() {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;
  return dedicatedEndpointResponse();
}

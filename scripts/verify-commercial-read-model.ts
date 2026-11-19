import {
  loadCommercialEstimations,
  loadCommercialOffers,
  loadCommercialPipeline,
  loadCommercialVisits,
} from "../src/lib/commercial-service";
import { getSupabaseAdminClient } from "../src/lib/supabase";
import type { AdminSession } from "../src/types/admin";

const verificationSession: AdminSession = {
  user: {
    id: "00000000-0000-4000-8000-000000000000",
    email: "crm-read-verification@local.invalid",
  },
  profile: {
    id: "00000000-0000-4000-8000-000000000000",
    email: "crm-read-verification@local.invalid",
    full_name: "Vérification lecture seule",
    role: "ADMIN",
    is_active: true,
    created_at: "2026-08-13T00:00:00.000Z",
    updated_at: "2026-08-13T00:00:00.000Z",
  },
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase serveur n'est pas configuré.");
  const [pipeline, estimations, visits, offers] = await Promise.all([
    loadCommercialPipeline(verificationSession),
    loadCommercialEstimations(verificationSession),
    loadCommercialVisits(verificationSession),
    loadCommercialOffers(verificationSession),
  ]);
  const [negotiations, negotiationKpi] = await Promise.all([
    supabase
      .from("negotiations")
      .select("id,status,offer_id", { count: "exact" })
      .limit(50),
    supabase.from("v_negotiations_kpi").select("*").maybeSingle(),
  ]);
  if (negotiations.error) throw negotiations.error;
  if (negotiationKpi.error) throw negotiationKpi.error;

  const [estimationDetail, visitDetail, offerDetail] = await Promise.all([
    estimations.items[0]
      ? loadCommercialEstimations(verificationSession, {
          id: estimations.items[0].id,
        })
      : null,
    visits.items[0]
      ? loadCommercialVisits(verificationSession, { id: visits.items[0].id })
      : null,
    offers.items[0]
      ? loadCommercialOffers(verificationSession, { id: offers.items[0].id })
      : null,
  ]);

  const report = {
    source: "linked-supabase-read-only",
    pipeline: {
      count: pipeline.cards.length,
      realUuidOnly: pipeline.cards.every((item) => uuidPattern.test(item.id)),
      relationsLoaded: pipeline.cards.every((item) => Boolean(item.contactId)),
    },
    estimations: {
      count: estimations.items.length,
      detailLoaded:
        estimations.items.length === 0 || Boolean(estimationDetail?.detail),
      contactOptions: estimations.options.contacts.length,
      agentOptions: estimations.options.profiles.length,
    },
    visits: {
      count: visits.items.length,
      detailLoaded: visits.items.length === 0 || Boolean(visitDetail?.detail),
      propertyOptions: visits.options.properties.length,
      contactOptions: visits.options.contacts.length,
    },
    offers: {
      count: offers.items.length,
      detailLoaded: offers.items.length === 0 || Boolean(offerDetail?.detail),
      propertyOptions: offers.options.properties.length,
      contactOptions: offers.options.contacts.length,
    },
    negotiations: {
      count: negotiations.count ?? negotiations.data.length,
      realUuidOnly: negotiations.data.every((item) => uuidPattern.test(item.id)),
      offerRelationsLoaded: negotiations.data.every((item) => Boolean(item.offer_id)),
      kpiLoaded: Boolean(negotiationKpi.data),
    },
  };

  if (
    !report.pipeline.realUuidOnly ||
    !report.pipeline.relationsLoaded ||
    !report.estimations.detailLoaded ||
    !report.visits.detailLoaded ||
    !report.offers.detailLoaded ||
    !report.negotiations.realUuidOnly ||
    !report.negotiations.offerRelationsLoaded ||
    !report.negotiations.kpiLoaded
  ) {
    throw new Error("Le modèle de lecture Commercial n'est pas cohérent.");
  }

  console.log(JSON.stringify(report, null, 2));
}

void main();

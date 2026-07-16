import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import {
  buildLegacyCrmReviewReport,
  type LegacyContactRow,
  type LegacyEstimationRow,
  type MatchCategory,
  type SimulatedPayload,
} from "@/lib/legacy-crm-review";
import { getSupabaseAdminClient } from "@/lib/supabase";

type LegacyReviewDecision = "READY_FOR_MIGRATION" | "MANUAL_REVIEW" | "DO_NOT_MERGE";

type LegacyReviewLogRow = {
  id: string;
  created_at: string;
  match_category: string;
  matched_keys: unknown;
  previous_payload: unknown;
  next_payload: unknown;
  actor_email: string | null;
  note: string | null;
};

const legacyReviewDecisionLabels: Record<LegacyReviewDecision, string> = {
  READY_FOR_MIGRATION: "Pret pour migration future",
  MANUAL_REVIEW: "A revoir manuellement",
  DO_NOT_MERGE: "Ne pas fusionner",
};

function isLegacyReviewDecision(value: unknown): value is LegacyReviewDecision {
  return value === "READY_FOR_MIGRATION" || value === "MANUAL_REVIEW" || value === "DO_NOT_MERGE";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function getCandidateKey(source: string, id: string) {
  return `${source}:${id}`;
}

function getLogCandidateKey(log: LegacyReviewLogRow) {
  if (!isRecord(log.previous_payload)) return null;

  const legacySource = getStringValue(log.previous_payload, "legacySource");
  const legacyId = getStringValue(log.previous_payload, "legacyId");
  if (!legacySource || !legacyId) return null;

  return getCandidateKey(legacySource, legacyId);
}

function getDecisionFromLog(log: LegacyReviewLogRow) {
  const nextPayload = isRecord(log.next_payload) ? log.next_payload : {};
  const decision = getStringValue(nextPayload, "decision");

  return {
    id: log.id,
    createdAt: log.created_at,
    decision: isLegacyReviewDecision(decision) ? decision : null,
    decisionLabel: isLegacyReviewDecision(decision) ? legacyReviewDecisionLabels[decision] : "Decision legacy",
    actorEmail: log.actor_email,
    note: log.note,
  };
}

function getContactDedupeStatus(decision: LegacyReviewDecision, matchCategory: MatchCategory) {
  if (decision === "DO_NOT_MERGE") return "IGNORED";
  if (decision === "MANUAL_REVIEW") return "AMBIGUOUS";
  if (matchCategory === "MATCH CERTAIN") return "MATCH_CERTAIN";
  if (matchCategory === "MATCH PROBABLE") return "MATCH_PROBABLE";
  if (matchCategory === "AMBIGU") return "AMBIGUOUS";
  return "UNREVIEWED";
}

async function buildLegacyReview(supabase: SupabaseClient) {
  const [contactsResult, estimationsResult, logsResult] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,created_at,updated_at,name,email,phone,request_type,city,message,status,notes,archived")
      .order("created_at", { ascending: true }),
    supabase
      .from("estimations")
      .select("id,created_at,updated_at,name,email,phone,property_type,city,postal_code,surface,rooms,message,status,notes,archived")
      .order("created_at", { ascending: true }),
    supabase
      .from("lead_merge_logs")
      .select("id,created_at,match_category,matched_keys,previous_payload,next_payload,actor_email,note")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const error = contactsResult.error ?? estimationsResult.error ?? logsResult.error;
  if (error) throw new Error(error.message);

  const report = buildLegacyCrmReviewReport(
    (contactsResult.data ?? []) as LegacyContactRow[],
    (estimationsResult.data ?? []) as LegacyEstimationRow[]
  );

  const latestDecisionByCandidate = new Map<string, ReturnType<typeof getDecisionFromLog>>();

  for (const log of (logsResult.data ?? []) as LegacyReviewLogRow[]) {
    const key = getLogCandidateKey(log);
    if (!key || latestDecisionByCandidate.has(key)) continue;
    latestDecisionByCandidate.set(key, getDecisionFromLog(log));
  }

  const candidates = report.simulatedPayloads.map((candidate) => ({
    ...candidate,
    review: latestDecisionByCandidate.get(getCandidateKey(candidate.legacySource, candidate.legacyId)) ?? null,
  }));
  const reviewed = candidates.filter((candidate) => Boolean(candidate.review));

  return {
    ...report,
    candidates,
    reviewSummary: {
      reviewed: reviewed.length,
      pending: candidates.length - reviewed.length,
      readyForMigration: reviewed.filter((candidate) => candidate.review?.decision === "READY_FOR_MIGRATION").length,
      manualReview: reviewed.filter((candidate) => candidate.review?.decision === "MANUAL_REVIEW").length,
      doNotMerge: reviewed.filter((candidate) => candidate.review?.decision === "DO_NOT_MERGE").length,
    },
  };
}

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  try {
    const review = await buildLegacyReview(supabase);
    return NextResponse.json(review);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    console.error("[IMMO-DREAMS83] Legacy review load failed", message);
    return NextResponse.json(
      { success: false, message: "La revue legacy n'a pas pu etre chargee." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as {
    legacySource?: string;
    legacyId?: string;
    decision?: unknown;
    note?: string;
  } | null;

  if (!payload?.legacySource || !payload.legacyId || !isLegacyReviewDecision(payload.decision)) {
    return NextResponse.json({ success: false, message: "Decision de revue invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  let candidate: SimulatedPayload | undefined;

  try {
    const review = await buildLegacyReview(supabase);
    candidate = review.candidates.find(
      (item) => item.legacySource === payload.legacySource && item.legacyId === payload.legacyId
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    console.error("[IMMO-DREAMS83] Legacy review candidate reload failed", message);
    return NextResponse.json(
      { success: false, message: "Le cas legacy n'a pas pu etre relu avant decision." },
      { status: 500 }
    );
  }

  if (!candidate) {
    return NextResponse.json({ success: false, message: "Cas legacy introuvable." }, { status: 404 });
  }

  const decisionPayload = {
    decision: payload.decision,
    decisionLabel: legacyReviewDecisionLabels[payload.decision],
    legacySource: candidate.legacySource,
    legacyId: candidate.legacyId,
    decidedAt: new Date().toISOString(),
    migrationPerformed: false,
  };
  const actorName = auth.session.profile.full_name ?? auth.session.user.email;
  const note = payload.note?.trim() || legacyReviewDecisionLabels[payload.decision];

  const { error: logError } = await supabase.from("lead_merge_logs").insert({
    match_category: candidate.matchCategory,
    matched_keys: candidate.matchedKeys,
    previous_payload: candidate,
    next_payload: decisionPayload,
    actor_id: auth.session.user.id,
    actor_email: auth.session.user.email,
    note,
  });

  if (logError) {
    console.error("[IMMO-DREAMS83] Legacy review log failed", logError.message);
    return NextResponse.json({ success: false, message: "La decision n'a pas pu etre journalisee." }, { status: 500 });
  }

  if (candidate.legacySource === "contact") {
    const { error: updateError } = await supabase
      .from("contacts")
      .update({ dedupe_status: getContactDedupeStatus(payload.decision, candidate.matchCategory) })
      .eq("id", candidate.legacyId);

    if (updateError) {
      console.error("[IMMO-DREAMS83] Contact dedupe status update failed", updateError.message);
    }
  }

  await supabase.from("activities").insert({
    entity_type: "legacy_review",
    entity_id: candidate.legacyId,
    action: `Revue legacy : ${legacyReviewDecisionLabels[payload.decision]}`,
    user_name: actorName,
  });
  await writeAdminAuditLog(auth.session, "legacy.review", "legacy_contact", candidate.legacyId, {
    decision: payload.decision,
    legacySource: candidate.legacySource,
    matchCategory: candidate.matchCategory,
    migrationPerformed: false,
  });

  return NextResponse.json({
    success: true,
    message: "Decision de revue enregistree. Aucune migration legacy n'a ete executee.",
    decision: decisionPayload,
  });
}

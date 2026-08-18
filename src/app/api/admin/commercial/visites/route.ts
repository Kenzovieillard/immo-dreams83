import { NextRequest, NextResponse } from "next/server";
import { actorName, commercialApiError } from "@/lib/commercial-api";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import { loadCommercialVisits } from "@/lib/commercial-service";
import { visitMutationSchema } from "@/lib/commercial-validation";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const params = request.nextUrl.searchParams;
  try {
    const payload = await loadCommercialVisits(auth.session, {
      id: params.get("id"),
      query: params.get("q") ?? undefined,
      status: params.get("status") ?? undefined,
      page: Number(params.get("page") ?? 1),
      limit: Number(params.get("limit") ?? 50),
    });
    if (params.get("id") && !payload.detail)
      return NextResponse.json(
        { success: false, message: "Visite introuvable." },
        { status: 404 },
      );
    return NextResponse.json({ success: true, source: "supabase", ...payload });
  } catch (error) {
    return commercialApiError(error, "Les visites n'ont pas pu être chargées.");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;
  const parsed = visitMutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        success: false,
        message: "Mutation de visite invalide.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return NextResponse.json(
      { success: false, message: "Supabase serveur n'est pas configuré." },
      { status: 503 },
    );
  const input = parsed.data;
  try {
    if (input.action === "create") {
      const { data, error } = await supabase.rpc("create_commercial_visit", {
        p_property_id: input.propertyId,
        p_contact_id: input.contactId,
        p_lead_id: input.leadId ?? null,
        p_assigned_to: input.assignedTo,
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt ?? null,
        p_location: input.location ?? "",
        p_notes: input.notes ?? "",
        p_actor_id: auth.session.user.id,
        p_actor_name: actorName(auth.session),
      });
      if (error) throw error;
      await writeAdminAuditLog(
        auth.session,
        "commercial.visit.create",
        "appointment",
        data,
        { propertyId: input.propertyId, contactId: input.contactId },
      );
      return NextResponse.json(
        { success: true, id: data, message: "Visite planifiée." },
        { status: 201 },
      );
    }
    if (input.action === "set-status") {
      const { data, error } = await supabase.rpc("update_commercial_visit", {
        p_visit_id: input.id,
        p_action: "SET_STATUS",
        p_visit_status: input.status,
        p_starts_at: null,
        p_ends_at: null,
        p_actor_id: auth.session.user.id,
        p_actor_name: actorName(auth.session),
      });
      if (error) throw error;
      await writeAdminAuditLog(
        auth.session,
        "commercial.visit.status",
        "appointment",
        input.id,
        { status: input.status },
      );
      return NextResponse.json({
        success: true,
        id: data,
        message: "Statut de visite mis à jour.",
      });
    }
    if (input.action === "reschedule") {
      const { data, error } = await supabase.rpc("update_commercial_visit", {
        p_visit_id: input.id,
        p_action: "RESCHEDULE",
        p_visit_status: null,
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt ?? null,
        p_actor_id: auth.session.user.id,
        p_actor_name: actorName(auth.session),
      });
      if (error) throw error;
      await writeAdminAuditLog(
        auth.session,
        "commercial.visit.reschedule",
        "appointment",
        input.id,
        { startsAt: input.startsAt },
      );
      return NextResponse.json({
        success: true,
        id: data,
        message: "Visite replanifiée.",
      });
    }
    const { data, error } = await supabase.rpc(
      "submit_commercial_visit_report",
      {
        p_visit_id: input.id,
        p_general_impression: input.generalImpression,
        p_positive_points: input.positivePoints,
        p_blocking_points: input.blockingPoints,
        p_interest_level: input.interestLevel,
        p_comments: input.comments,
        p_next_action: input.nextAction,
        p_follow_up_at: input.followUpAt ?? null,
        p_actor_id: auth.session.user.id,
        p_actor_name: actorName(auth.session),
      },
    );
    if (error) throw error;
    await writeAdminAuditLog(
      auth.session,
      "commercial.visit.report",
      "appointment",
      input.id,
      { nextAction: input.nextAction, interestLevel: input.interestLevel },
    );
    return NextResponse.json({
      success: true,
      result: data,
      message: "Compte rendu enregistré.",
    });
  } catch (error) {
    return commercialApiError(error, "La mutation de visite a échoué.");
  }
}

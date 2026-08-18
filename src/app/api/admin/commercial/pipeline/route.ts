import { NextRequest, NextResponse } from "next/server";
import { actorName, commercialApiError } from "@/lib/commercial-api";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import { loadCommercialPipeline } from "@/lib/commercial-service";
import { pipelineMutationSchema } from "@/lib/commercial-validation";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  try {
    const payload = await loadCommercialPipeline(auth.session);
    return NextResponse.json({ success: true, source: "supabase", ...payload });
  } catch (error) {
    return commercialApiError(
      error,
      "Le pipeline commercial n'a pas pu être chargé.",
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;
  const parsed = pipelineMutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        success: false,
        message: "Mutation pipeline invalide.",
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
    if (input.action === "move-stage") {
      const { data, error } = await supabase.rpc("move_commercial_pipeline", {
        p_lead_id: input.id,
        p_stage: input.stage,
        p_actor_id: auth.session.user.id,
        p_actor_name: actorName(auth.session),
      });
      if (error) throw error;
      await writeAdminAuditLog(
        auth.session,
        "commercial.pipeline.move",
        "lead",
        input.id,
        { stage: input.stage },
      );
      return NextResponse.json({
        success: true,
        id: data,
        message: "Étape mise à jour.",
      });
    }
    if (input.action === "create-case") {
      const { data, error } = await supabase.rpc("create_commercial_case", {
        p_contact_id: input.contactId,
        p_pipeline_type: input.pipelineType,
        p_assigned_to: input.assignedTo ?? auth.session.user.id,
        p_property_id: input.propertyId ?? null,
        p_estimation_id: input.estimationId ?? null,
        p_priority: input.priority,
        p_title: input.title,
        p_notes: input.notes ?? "",
        p_actor_id: auth.session.user.id,
        p_actor_name: actorName(auth.session),
      });
      if (error) throw error;
      await writeAdminAuditLog(
        auth.session,
        "commercial.case.create",
        "lead",
        data,
        { pipelineType: input.pipelineType, contactId: input.contactId },
      );
      return NextResponse.json(
        { success: true, id: data, message: "Dossier commercial créé." },
        { status: 201 },
      );
    }
    if (input.action === "create-mandate") {
      const mandateNumber = `MAND-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
      const { data, error } = await supabase
        .from("mandates")
        .insert({
          mandate_number: mandateNumber,
          mandate_type: input.mandateType,
          status: input.status,
          lead_id: input.leadId,
          property_id: input.propertyId,
          signed_at:
            input.signedAt ??
            (input.status === "signed" ? new Date().toISOString() : null),
          expires_at: input.expiresAt ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const stage =
        input.status === "signed"
          ? "SELLER_MANDATE_SIGNED"
          : "SELLER_MANDATE_PROPOSED";
      const { error: moveError } = await supabase.rpc(
        "move_commercial_pipeline",
        {
          p_lead_id: input.leadId,
          p_stage: stage,
          p_actor_id: auth.session.user.id,
          p_actor_name: actorName(auth.session),
        },
      );
      if (moveError) throw moveError;
      await supabase
        .from("activities")
        .insert({
          entity_type: "mandate",
          entity_id: data.id,
          action: "Mandat créé",
          user_name: actorName(auth.session),
          actor_id: auth.session.user.id,
          metadata: {
            lead_id: input.leadId,
            property_id: input.propertyId,
            status: input.status,
          },
        });
      await writeAdminAuditLog(
        auth.session,
        "commercial.mandate.create",
        "mandate",
        data.id,
        { leadId: input.leadId, propertyId: input.propertyId },
      );
      return NextResponse.json(
        {
          success: true,
          id: data.id,
          message: "Mandat créé et dossier mis à jour.",
        },
        { status: 201 },
      );
    }
    if (input.action === "create-task") {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          lead_id: input.leadId,
          appointment_id: input.appointmentId ?? null,
          offer_id: input.offerId ?? null,
          title: input.title,
          description: input.description ?? null,
          due_at: input.dueAt ?? null,
          priority: input.priority,
          assigned_to: input.assignedTo ?? auth.session.user.id,
          created_by: auth.session.user.id,
          status: "TODO",
          task_type: "FOLLOW_UP",
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase
        .from("activities")
        .insert({
          entity_type: "lead",
          entity_id: input.leadId,
          action: `Tâche créée : ${input.title}`,
          user_name: actorName(auth.session),
          actor_id: auth.session.user.id,
          metadata: { task_id: data.id },
        });
      await writeAdminAuditLog(
        auth.session,
        "commercial.task.create",
        "task",
        data.id,
        { leadId: input.leadId },
      );
      return NextResponse.json(
        { success: true, id: data.id, message: "Tâche créée." },
        { status: 201 },
      );
    }
    if (input.action === "update-task") {
      const { data: current, error: currentError } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", input.id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current)
        return NextResponse.json(
          { success: false, message: "Tâche introuvable." },
          { status: 404 },
        );
      const status = input.status ?? current.status;
      const { error } = await supabase
        .from("tasks")
        .update({
          title: input.title ?? current.title,
          description:
            input.description === undefined
              ? current.description
              : input.description,
          due_at: input.dueAt === undefined ? current.due_at : input.dueAt,
          priority: input.priority ?? current.priority,
          assigned_to:
            input.assignedTo === undefined
              ? current.assigned_to
              : input.assignedTo,
          status,
          completed_at:
            status === "COMPLETED"
              ? (current.completed_at ?? new Date().toISOString())
              : null,
          completed_by: status === "COMPLETED" ? auth.session.user.id : null,
        })
        .eq("id", input.id);
      if (error) throw error;
      if (current.lead_id)
        await supabase
          .from("activities")
          .insert({
            entity_type: "lead",
            entity_id: current.lead_id,
            action:
              status === "COMPLETED"
                ? `Tâche terminée : ${input.title ?? current.title}`
                : `Tâche mise à jour : ${input.title ?? current.title}`,
            user_name: actorName(auth.session),
            actor_id: auth.session.user.id,
            metadata: { task_id: input.id, status },
          });
      await writeAdminAuditLog(
        auth.session,
        "commercial.task.update",
        "task",
        input.id,
        { status },
      );
      return NextResponse.json({
        success: true,
        id: input.id,
        message: "Tâche mise à jour.",
      });
    }
    const { data: current, error: currentError } = await supabase
      .from("tasks")
      .select("lead_id,title")
      .eq("id", input.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current)
      return NextResponse.json(
        { success: false, message: "Tâche introuvable." },
        { status: 404 },
      );
    const { error } = await supabase
      .from("tasks")
      .update({ status: "CANCELLED" })
      .eq("id", input.id);
    if (error) throw error;
    if (current.lead_id)
      await supabase
        .from("activities")
        .insert({
          entity_type: "lead",
          entity_id: current.lead_id,
          action: `Tâche archivée : ${current.title}`,
          user_name: actorName(auth.session),
          actor_id: auth.session.user.id,
          metadata: { task_id: input.id },
        });
    await writeAdminAuditLog(
      auth.session,
      "commercial.task.archive",
      "task",
      input.id,
    );
    return NextResponse.json({
      success: true,
      id: input.id,
      message: "Tâche archivée.",
    });
  } catch (error) {
    return commercialApiError(error, "La mutation pipeline a échoué.");
  }
}

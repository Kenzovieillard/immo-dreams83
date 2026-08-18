import { NextRequest, NextResponse } from "next/server";
import { actorName, commercialApiError } from "@/lib/commercial-api";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import { generateEstimationPdf } from "@/lib/commercial-pdf";
import { loadCommercialEstimations } from "@/lib/commercial-service";
import { estimationMutationSchema } from "@/lib/commercial-validation";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return NextResponse.json(
      { success: false, message: "Supabase serveur n'est pas configuré." },
      { status: 503 },
    );
  try {
    if (params.get("download") === "report") {
      if (!id)
        return NextResponse.json(
          { success: false, message: "Identifiant d'estimation requis." },
          { status: 400 },
        );
      const { data, error } = await supabase
        .from("estimations")
        .select("report_storage_path")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data?.report_storage_path)
        return NextResponse.json(
          { success: false, message: "Aucun rapport PDF n'est disponible." },
          { status: 404 },
        );
      const signed = await supabase.storage
        .from("estimation-reports")
        .createSignedUrl(data.report_storage_path, 300, {
          download: `estimation-${id}.pdf`,
        });
      if (signed.error) throw signed.error;
      return NextResponse.json({
        success: true,
        url: signed.data.signedUrl,
        expiresIn: 300,
      });
    }
    const payload = await loadCommercialEstimations(auth.session, {
      id,
      query: params.get("q") ?? undefined,
      status: params.get("status") ?? undefined,
      page: Number(params.get("page") ?? 1),
      limit: Number(params.get("limit") ?? 30),
    });
    if (id && !payload.detail)
      return NextResponse.json(
        { success: false, message: "Estimation introuvable." },
        { status: 404 },
      );
    return NextResponse.json({ success: true, source: "supabase", ...payload });
  } catch (error) {
    return commercialApiError(
      error,
      "Les estimations n'ont pas pu être chargées.",
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;
  const parsed = estimationMutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        success: false,
        message: "Mutation estimation invalide.",
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
    if (input.action === "transform") {
      const { data, error } = await supabase.rpc(
        "transform_commercial_estimation",
        {
          p_estimation_id: input.id,
          p_listing_price: input.listingPrice,
          p_mandate_type: input.mandateType,
          p_actor_id: auth.session.user.id,
          p_actor_name: actorName(auth.session),
        },
      );
      if (error) throw error;
      await writeAdminAuditLog(
        auth.session,
        "commercial.estimation.transform",
        "estimation",
        input.id,
        data && typeof data === "object" && !Array.isArray(data) ? data : {},
      );
      return NextResponse.json({
        success: true,
        result: data,
        message: "Estimation transformée en bien, dossier vendeur et mandat.",
      });
    }
    if (input.action === "generate-report") {
      const payload = await loadCommercialEstimations(auth.session, {
        id: input.id,
        limit: 1,
      });
      if (!payload.detail)
        return NextResponse.json(
          { success: false, message: "Estimation introuvable." },
          { status: 404 },
        );
      const bytes = await generateEstimationPdf(payload.detail);
      const storagePath = `${input.id}/${Date.now()}-rapport-estimation.pdf`;
      const upload = await supabase.storage
        .from("estimation-reports")
        .upload(storagePath, bytes, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upload.error) throw upload.error;
      const { error } = await supabase
        .from("estimations")
        .update({
          report_storage_path: storagePath,
          report_generated_at: new Date().toISOString(),
          commercial_status:
            payload.detail.status === "FINISHED" ? "FINISHED" : "REPORT_SENT",
        })
        .eq("id", input.id);
      if (error) {
        await supabase.storage.from("estimation-reports").remove([storagePath]);
        throw error;
      }
      await supabase
        .from("activities")
        .insert({
          entity_type: "estimation",
          entity_id: input.id,
          action: "Rapport PDF généré",
          user_name: actorName(auth.session),
          actor_id: auth.session.user.id,
          metadata: { storage_path: storagePath },
        });
      await writeAdminAuditLog(
        auth.session,
        "commercial.estimation.report.generate",
        "estimation",
        input.id,
        { storagePath },
      );
      return NextResponse.json({
        success: true,
        message: "Rapport PDF généré.",
        storagePath,
      });
    }
    if (input.action === "create") {
      const [contactResult, profileResult] = await Promise.all([
        supabase
          .from("contacts")
          .select("*")
          .eq("id", input.contactId)
          .eq("archived", false)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("id,is_active")
          .eq("id", input.assignedTo)
          .maybeSingle(),
      ]);
      if (contactResult.error || profileResult.error)
        throw contactResult.error ?? profileResult.error;
      if (!contactResult.data)
        return NextResponse.json(
          { success: false, message: "Contact introuvable." },
          { status: 404 },
        );
      if (!profileResult.data?.is_active)
        return NextResponse.json(
          { success: false, message: "Conseiller invalide." },
          { status: 400 },
        );
      const slot = new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(new Date(input.appointmentAt));
      const { data, error } = await supabase
        .from("estimations")
        .insert({
          contact_id: input.contactId,
          assigned_to: input.assignedTo,
          name: contactResult.data.name,
          email: contactResult.data.email,
          phone: contactResult.data.phone ?? "Non renseigné",
          property_address: input.propertyAddress,
          city: input.city,
          postal_code: input.postalCode,
          property_type: input.propertyType,
          surface: input.surface,
          rooms: input.rooms ?? null,
          construction_year: input.constructionYear ?? null,
          property_condition: input.propertyCondition ?? null,
          appointment_at: input.appointmentAt,
          time_slot: slot,
          duration_minutes: input.durationMinutes,
          appointment_location:
            input.appointmentLocation ?? input.propertyAddress,
          notes: input.notes ?? null,
          message: "Estimation créée depuis le CRM Commercial.",
          commercial_status: "SCHEDULED",
          status: "NEW",
        })
        .select("id,commercial_reference")
        .single();
      if (error) throw error;
      await supabase
        .from("activities")
        .insert({
          entity_type: "estimation",
          entity_id: data.id,
          action: "Estimation créée",
          user_name: actorName(auth.session),
          actor_id: auth.session.user.id,
          metadata: {
            contact_id: input.contactId,
            appointment_at: input.appointmentAt,
          },
        });
      await writeAdminAuditLog(
        auth.session,
        "commercial.estimation.create",
        "estimation",
        data.id,
        { contactId: input.contactId },
      );
      return NextResponse.json(
        {
          success: true,
          id: data.id,
          reference: data.commercial_reference,
          message: "Estimation créée.",
        },
        { status: 201 },
      );
    }
    const { data: current, error: currentError } = await supabase
      .from("estimations")
      .select("*")
      .eq("id", input.id)
      .eq("archived", false)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current)
      return NextResponse.json(
        { success: false, message: "Estimation introuvable." },
        { status: 404 },
      );
    const appointmentAt = input.appointmentAt ?? current.appointment_at;
    const update = {
      contact_id: input.contactId ?? current.contact_id,
      assigned_to: input.assignedTo ?? current.assigned_to,
      property_address: input.propertyAddress ?? current.property_address,
      city: input.city ?? current.city,
      postal_code: input.postalCode ?? current.postal_code,
      property_type: input.propertyType ?? current.property_type,
      surface: input.surface ?? current.surface,
      rooms: input.rooms === undefined ? current.rooms : input.rooms,
      construction_year:
        input.constructionYear === undefined
          ? current.construction_year
          : input.constructionYear,
      property_condition:
        input.propertyCondition === undefined
          ? current.property_condition
          : input.propertyCondition,
      appointment_at: appointmentAt,
      time_slot: appointmentAt
        ? new Intl.DateTimeFormat("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "Europe/Paris",
          }).format(new Date(appointmentAt))
        : null,
      duration_minutes: input.durationMinutes ?? current.duration_minutes,
      appointment_location:
        input.appointmentLocation === undefined
          ? current.appointment_location
          : input.appointmentLocation,
      notes: input.notes === undefined ? current.notes : input.notes,
      commercial_status: input.commercialStatus ?? current.commercial_status,
      estimated_value:
        input.estimatedValue === undefined
          ? current.estimated_value
          : input.estimatedValue,
      estimate_low:
        input.estimateLow === undefined
          ? current.estimate_low
          : input.estimateLow,
      estimate_high:
        input.estimateHigh === undefined
          ? current.estimate_high
          : input.estimateHigh,
    };
    const { error } = await supabase
      .from("estimations")
      .update(update)
      .eq("id", input.id);
    if (error) throw error;
    await supabase
      .from("activities")
      .insert({
        entity_type: "estimation",
        entity_id: input.id,
        action: "Estimation modifiée",
        user_name: actorName(auth.session),
        actor_id: auth.session.user.id,
        metadata: {
          fields: Object.keys(input).filter(
            (key) => !["action", "id"].includes(key),
          ),
        },
      });
    await writeAdminAuditLog(
      auth.session,
      "commercial.estimation.update",
      "estimation",
      input.id,
    );
    return NextResponse.json({
      success: true,
      id: input.id,
      message: "Estimation mise à jour.",
    });
  } catch (error) {
    return commercialApiError(error, "La mutation d'estimation a échoué.");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actorName, commercialApiError } from "@/lib/commercial-api";
import {
  assertEligibleCommercialAssignee,
  assertLeadAccess,
  assertOfferAccess,
  assertVisitAccess,
} from "@/lib/commercial-access";
import {
  hasAdminPermission,
  requireAdminSession,
  writeAdminAuditLog,
} from "@/lib/admin-auth";
import { loadCommercialOffers } from "@/lib/commercial-service";
import {
  normalizeCommercialPrefill,
  offerMutationSchema,
} from "@/lib/commercial-validation";
import { canTransitionCommercialOfferStatus } from "@/lib/crm-pipeline-rules";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { CommercialOfferStatus } from "@/types/crm";

const uuidSchema = z.string().uuid();
const allowedFiles = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxFileSize = 10 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const params = request.nextUrl.searchParams;
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return NextResponse.json(
      { success: false, message: "Supabase serveur n'est pas configuré." },
      { status: 503 },
    );
  try {
    const documentId = params.get("documentId");
    if (documentId) {
      if (!uuidSchema.safeParse(documentId).success)
        return NextResponse.json(
          { success: false, message: "Document invalide." },
          { status: 400 },
        );
      const { data, error } = await supabase
        .from("offer_documents")
        .select("offer_id,storage_bucket,storage_path,file_name")
        .eq("id", documentId)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        return NextResponse.json(
          { success: false, message: "Document introuvable." },
          { status: 404 },
        );
      await assertOfferAccess(
        supabase,
        auth.session,
        data.offer_id,
      );
      const signed = await supabase.storage
        .from(data.storage_bucket)
        .createSignedUrl(data.storage_path, 300, { download: data.file_name });
      if (signed.error) throw signed.error;
      return NextResponse.json({
        success: true,
        url: signed.data.signedUrl,
        expiresIn: 300,
      });
    }
    const prefill = normalizeCommercialPrefill(params);
    const payload = await loadCommercialOffers(auth.session, {
      id: params.get("id"),
      query: params.get("q") ?? undefined,
      status: params.get("status") ?? undefined,
      page: Number(params.get("page") ?? 1),
      limit: Number(params.get("limit") ?? 50),
      propertyId: prefill.propertyId,
      contactId: prefill.contactId,
      visitId: prefill.visitId,
    });
    if (params.get("id") && !payload.detail)
      return NextResponse.json(
        { success: false, message: "Offre introuvable." },
        { status: 404 },
      );
    if (prefill.visitId) {
      await assertVisitAccess(supabase, auth.session, prefill.visitId);
      const { data: visit, error } = await supabase
        .from("appointments")
        .select("property_id,contact_id,lead_id")
        .eq("id", prefill.visitId)
        .eq("appointment_type", "VISIT")
        .maybeSingle();
      if (error) throw error;
      if (!visit)
        return NextResponse.json(
          { success: false, message: "La visite transmise n'existe pas." },
          { status: 404 },
        );
      payload.prefill.propertyId = prefill.propertyId ?? visit.property_id;
      payload.prefill.contactId = prefill.contactId ?? visit.contact_id;
      payload.prefill.buyerDossierId =
        visit.lead_id ??
        payload.options.buyerCases.find(
          (lead) => lead.contactId === visit.contact_id,
        )?.id ??
        null;
    }
    return NextResponse.json({ success: true, source: "supabase", ...payload });
  } catch (error) {
    return commercialApiError(error, "Les offres n'ont pas pu être chargées.");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("offer.write");
  if (auth.response) return auth.response;
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return NextResponse.json(
      { success: false, message: "Supabase serveur n'est pas configuré." },
      { status: 503 },
    );
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const offerId = String(form.get("offerId") ?? "");
      const documentType =
        String(form.get("documentType") ?? "OTHER")
          .trim()
          .slice(0, 80) || "OTHER";
      const file = form.get("file");
      if (!uuidSchema.safeParse(offerId).success || !(file instanceof File))
        return NextResponse.json(
          { success: false, message: "Offre ou fichier invalide." },
          { status: 400 },
        );
      if (
        !allowedFiles.has(file.type) ||
        file.size <= 0 ||
        file.size > maxFileSize
      )
        return NextResponse.json(
          {
            success: false,
            message: "Fichier refusé : PDF, JPG ou PNG, 10 Mo maximum.",
          },
          { status: 400 },
        );
      const exists = await supabase
        .from("offers")
        .select("id")
        .eq("id", offerId)
        .eq("is_test", false)
        .maybeSingle();
      if (exists.error) throw exists.error;
      if (!exists.data)
        return NextResponse.json(
          { success: false, message: "Offre introuvable." },
          { status: 404 },
        );
      await assertOfferAccess(supabase, auth.session, offerId);
      const extension =
        file.name
          .split(".")
          .pop()
          ?.replace(/[^a-z0-9]/gi, "")
          .toLowerCase() || (file.type === "application/pdf" ? "pdf" : "bin");
      const path = `${offerId}/${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage
        .from("offer-documents")
        .upload(path, await file.arrayBuffer(), {
          contentType: file.type,
          upsert: false,
        });
      if (upload.error) throw upload.error;
      const { data, error } = await supabase
        .from("offer_documents")
        .insert({
          offer_id: offerId,
          document_type: documentType,
          storage_bucket: "offer-documents",
          storage_path: path,
          file_name: file.name.slice(0, 255),
          mime_type: file.type,
          uploaded_by: auth.session.user.id,
          file_size: file.size,
          document_status: "READY",
          confidentiality: "PRIVATE",
          version: 1,
        })
        .select("id")
        .single();
      if (error) {
        await supabase.storage.from("offer-documents").remove([path]);
        throw error;
      }
      await supabase
        .from("activities")
        .insert({
          entity_type: "offer",
          entity_id: offerId,
          action: `Document ajouté : ${file.name.slice(0, 120)}`,
          user_name: actorName(auth.session),
          actor_id: auth.session.user.id,
          metadata: { document_id: data.id, mime_type: file.type },
        });
      await writeAdminAuditLog(
        auth.session,
        "commercial.offer.document.upload",
        "offer_document",
        data.id,
        { offerId, size: file.size, mimeType: file.type },
      );
      return NextResponse.json(
        { success: true, id: data.id, message: "Document ajouté." },
        { status: 201 },
      );
    }

    const parsed = offerMutationSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        {
          success: false,
          message: "Mutation d'offre invalide.",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    const input = parsed.data;
    if (input.action === "create") {
      await assertEligibleCommercialAssignee(
        supabase,
        auth.session,
        input.responsibleUserId,
      );
      await assertLeadAccess(
        supabase,
        auth.session,
        input.buyerDossierId,
      );
      if (input.visitId) {
        await assertVisitAccess(supabase, auth.session, input.visitId);
      }
      const { data, error } = await supabase.rpc("create_commercial_offer", {
        p_property_id: input.propertyId,
        p_buyer_dossier_id: input.buyerDossierId,
        p_buyer_contact_id: input.buyerContactId,
        p_visit_id: input.visitId ?? null,
        p_responsible_user_id: input.responsibleUserId,
        p_amount: input.amount,
        p_offer_date: input.offerDate,
        p_valid_until: input.validUntil,
        p_financing_type: input.financingType,
        p_down_payment_amount: input.downPaymentAmount ?? null,
        p_loan_amount: input.loanAmount ?? null,
        p_suspensive_conditions: input.suspensiveConditions ?? "",
        p_included_furniture: input.includedFurniture ?? "",
        p_negotiation_comment: input.negotiationComment ?? "",
        p_submission: input.submission,
        p_actor_id: auth.session.user.id,
        p_actor_name: actorName(auth.session),
      });
      if (error) throw error;
      await writeAdminAuditLog(
        auth.session,
        "commercial.offer.create",
        "offer",
        null,
        {
          submission: input.submission,
          propertyId: input.propertyId,
          result: data,
        },
      );
      return NextResponse.json(
        {
          success: true,
          result: data,
          message:
            input.submission === "draft"
              ? "Brouillon sauvegardé."
              : "Offre créée.",
        },
        { status: 201 },
      );
    }
    await assertOfferAccess(supabase, auth.session, input.id);
    const { data: current, error: currentError } = await supabase
      .from("offers")
      .select("id,status,valid_until,is_test")
      .eq("id", input.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current || current.is_test)
      return NextResponse.json(
        { success: false, message: "Offre introuvable." },
        { status: 404 },
      );
    const currentStatus = current.status as CommercialOfferStatus;
    const nextStatus = input.status as CommercialOfferStatus;
    if (!canTransitionCommercialOfferStatus(currentStatus, nextStatus))
      return NextResponse.json(
        { success: false, message: "Transition de statut non autorisée." },
        { status: 409 },
      );
    if (
      ["ACCEPTED", "REJECTED"].includes(nextStatus) &&
      !hasAdminPermission(auth.session.profile.role, "offer.decide")
    )
      return NextResponse.json(
        {
          success: false,
          message: "Seule la direction peut décider cette offre.",
        },
        { status: 403 },
      );
    if (
      nextStatus === "ACCEPTED" &&
      current.valid_until &&
      current.valid_until < new Date().toISOString().slice(0, 10)
    )
      return NextResponse.json(
        { success: false, message: "Une offre expirée ne peut pas être acceptée." },
        { status: 409 },
      );
    if (["REJECTED", "WITHDRAWN"].includes(nextStatus) && !input.reason)
      return NextResponse.json(
        { success: false, message: "Une raison est obligatoire." },
        { status: 400 },
      );
    const { data: result, error } = await supabase.rpc(
      "transition_commercial_offer",
      {
        p_offer_id: input.id,
        p_next_status: nextStatus,
        p_reason: input.reason ?? "",
        p_actor_id: auth.session.user.id,
        p_actor_name: actorName(auth.session),
      },
    );
    if (error) throw error;
    await writeAdminAuditLog(
      auth.session,
      "commercial.offer.status",
      "offer",
      input.id,
      { previousStatus: currentStatus, nextStatus },
    );
    return NextResponse.json({
      success: true,
      id: input.id,
      result,
      message: "Statut de l'offre mis à jour.",
    });
  } catch (error) {
    return commercialApiError(error, "La mutation d'offre a échoué.");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminSession("offer.write");
  if (auth.response) return auth.response;
  const documentId = request.nextUrl.searchParams.get("documentId");
  if (!documentId || !uuidSchema.safeParse(documentId).success)
    return NextResponse.json(
      { success: false, message: "Document invalide." },
      { status: 400 },
    );
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return NextResponse.json(
      { success: false, message: "Supabase serveur n'est pas configuré." },
      { status: 503 },
    );
  try {
    const { data, error } = await supabase
      .from("offer_documents")
      .select("offer_id,storage_bucket,storage_path,file_name")
      .eq("id", documentId)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json(
        { success: false, message: "Document introuvable." },
        { status: 404 },
      );
    await assertOfferAccess(supabase, auth.session, data.offer_id);
    const deleted = await supabase
      .from("offer_documents")
      .delete()
      .eq("id", documentId);
    if (deleted.error) throw deleted.error;
    const removed = await supabase.storage
      .from(data.storage_bucket)
      .remove([data.storage_path]);
    if (removed.error)
      console.error(
        "[IMMO-DREAMS83] Orphan offer file cleanup failed",
        removed.error.message,
      );
    await supabase
      .from("activities")
      .insert({
        entity_type: "offer",
        entity_id: data.offer_id,
        action: `Document supprimé : ${data.file_name}`,
        user_name: actorName(auth.session),
        actor_id: auth.session.user.id,
        metadata: { document_id: documentId },
      });
    await writeAdminAuditLog(
      auth.session,
      "commercial.offer.document.delete",
      "offer_document",
      documentId,
      { offerId: data.offer_id },
    );
    return NextResponse.json({ success: true, message: "Document supprimé." });
  } catch (error) {
    return commercialApiError(error, "Le document n'a pas pu être supprimé.");
  }
}

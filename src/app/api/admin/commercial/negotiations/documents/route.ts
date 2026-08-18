import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

const bucket = "negotiation-documents";
const maxFileSize = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const documentTypes = [
  "FINANCING_CERTIFICATE",
  "IDENTITY",
  "ADDRESS_PROOF",
  "PURCHASE_OFFER",
  "COMPROMISE",
  "OTHER",
] as const;

function safeFileName(value: string) {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return (
    normalized
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "document"
  );
}

async function loadNegotiationAccess(negotiationId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return { supabase: null, negotiation: null, error: "NOT_CONFIGURED" };
  const { data, error } = await supabase
    .from("negotiations")
    .select("id,responsible_user_id")
    .eq("id", negotiationId)
    .maybeSingle();
  return {
    supabase,
    negotiation: data,
    error: error?.message ?? null,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("offer.write");
  if (auth.response) return auth.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const negotiationId = z
    .string()
    .uuid()
    .safeParse(formData?.get("negotiationId"));
  const requestedType = z
    .enum(documentTypes)
    .safeParse(formData?.get("documentType") ?? "OTHER");
  if (
    !(file instanceof File) ||
    !negotiationId.success ||
    !requestedType.success
  ) {
    return NextResponse.json(
      { success: false, message: "Document ou négociation invalide." },
      { status: 400 },
    );
  }
  if (
    !allowedMimeTypes.has(file.type) ||
    file.size <= 0 ||
    file.size > maxFileSize
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Seuls les PDF, JPG et PNG de 10 Mo maximum sont acceptés.",
      },
      { status: 422 },
    );
  }

  const access = await loadNegotiationAccess(negotiationId.data);
  if (!access.supabase)
    return NextResponse.json(
      { success: false, message: "Supabase serveur n'est pas configuré." },
      { status: 503 },
    );
  if (access.error)
    return NextResponse.json(
      { success: false, message: "La négociation n'a pas pu être vérifiée." },
      { status: 500 },
    );
  if (!access.negotiation)
    return NextResponse.json(
      { success: false, message: "Négociation introuvable." },
      { status: 404 },
    );
  if (
    auth.session.profile.role === "AGENT" &&
    access.negotiation.responsible_user_id !== auth.session.user.id
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Cette négociation est assignée à un autre conseiller.",
      },
      { status: 403 },
    );
  }

  const fileName = safeFileName(file.name);
  const storagePath = `${negotiationId.data}/${crypto.randomUUID()}-${fileName}`;
  const { error: storageError } = await access.supabase.storage
    .from(bucket)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
  if (storageError) {
    const missingBucket = /bucket.*not found/i.test(storageError.message);
    return NextResponse.json(
      {
        success: false,
        message: missingBucket
          ? "La migration Storage du hub Négociations doit être appliquée."
          : "Le fichier n'a pas pu être stocké.",
      },
      { status: missingBucket ? 503 : 500 },
    );
  }

  const { data, error } = await access.supabase
    .from("negotiation_documents")
    .insert({
      negotiation_id: negotiationId.data,
      file_name: fileName,
      storage_bucket: bucket,
      storage_path: storagePath,
      document_type: requestedType.data,
      mime_type: file.type,
      document_status: "READY",
      version: 1,
      confidentiality: "PRIVATE",
      uploaded_by: auth.session.user.id,
    })
    .select("id,file_name,document_type,mime_type,created_at")
    .single();
  if (error) {
    await access.supabase.storage.from(bucket).remove([storagePath]);
    return NextResponse.json(
      {
        success: false,
        message: "Les métadonnées du document n'ont pas pu être enregistrées.",
      },
      { status: 500 },
    );
  }

  const document = data;
  await writeAdminAuditLog(
    auth.session,
    "commercial.negotiation.document.upload",
    "negotiation",
    negotiationId.data,
    {
      documentId: document.id,
      documentType: requestedType.data,
      mimeType: file.type,
      size: file.size,
    },
  );
  return NextResponse.json(
    {
      success: true,
      message: "Document ajouté à la négociation.",
      document: {
        id: document.id,
        fileName: document.file_name,
        documentType: document.document_type,
        mimeType: document.mime_type,
        createdAt: document.created_at,
      },
    },
    { status: 201 },
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const documentId = z
    .string()
    .uuid()
    .safeParse(request.nextUrl.searchParams.get("id"));
  if (!documentId.success)
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

  const { data, error } = await supabase
    .from("negotiation_documents")
    .select("id,negotiation_id,storage_bucket,storage_path")
    .eq("id", documentId.data)
    .maybeSingle();
  const document = data;
  if (error)
    return NextResponse.json(
      { success: false, message: "Le document n'a pas pu être relu." },
      { status: 500 },
    );
  if (!document)
    return NextResponse.json(
      { success: false, message: "Document introuvable." },
      { status: 404 },
    );

  if (auth.session.profile.role === "AGENT") {
    const access = await loadNegotiationAccess(document.negotiation_id);
    if (
      !access.negotiation ||
      access.negotiation.responsible_user_id !== auth.session.user.id
    ) {
      return NextResponse.json(
        { success: false, message: "Accès refusé à ce document." },
        { status: 403 },
      );
    }
  }
  const { data: signed, error: signError } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60);
  if (signError || !signed?.signedUrl)
    return NextResponse.json(
      {
        success: false,
        message: "Le lien de téléchargement n'a pas pu être créé.",
      },
      { status: 500 },
    );
  await writeAdminAuditLog(
    auth.session,
    "commercial.negotiation.document.download",
    "negotiation_document",
    document.id,
  );
  return NextResponse.redirect(signed.signedUrl);
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAdminSession,
  writeAdminAuditLog,
  type AdminPermission,
} from "@/lib/admin-auth";
import {
  documentKinds,
  propertyDocumentLimit,
  type PropertyDocument,
} from "@/lib/property-workspace";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

const bucket = "crm-property-documents";
const documentKind = z.enum(documentKinds);
type Params = { params: Promise<{ id: string }> };
type DocumentRow = Database["public"]["Tables"]["property_documents"]["Row"];

function error(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

async function access(params: Params["params"], permission: AdminPermission) {
  const auth = await requireAdminSession(permission);
  if (auth.response) return { response: auth.response };
  const id = z.uuid().safeParse((await params).id);
  if (!id.success)
    return { response: error("Identifiant de bien invalide.", 400) };
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return { response: error("Supabase serveur n’est pas configuré.", 503) };
  const { data: property, error: lookupError } = await supabase
    .from("properties")
    .select("id,advisor_id,created_by")
    .eq("id", id.data)
    .maybeSingle();
  if (lookupError)
    return { response: error("Le dossier n’a pas pu être vérifié.", 503) };
  if (
    !property ||
    (auth.session.profile.role === "AGENT" &&
      (property.advisor_id ?? property.created_by) !== auth.session.user.id)
  )
    return { response: error("Dossier introuvable ou inaccessible.", 404) };
  return { supabase, propertyId: id.data, session: auth.session };
}

function summary(row: DocumentRow): PropertyDocument {
  return {
    id: row.id,
    fileName: row.file_name,
    kind: documentKind.parse(row.kind),
    createdAt: row.created_at,
    folderId: row.folder_id,
    sizeBytes: row.size_bytes,
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  const result = await access(params, "crm.read");
  if (result.response) return result.response;
  const { supabase, propertyId } = result;
  const query = supabase
    .from("property_documents")
    .select("*")
    .eq("property_id", propertyId)
    .is("archived_at", null);
  const requestedDocument = request.nextUrl.searchParams.get("document");
  if (!requestedDocument) {
    const [documents, folders] = await Promise.all([
      query.order("created_at", { ascending: false }),
      supabase
        .from("property_document_folders")
        .select("id,name")
        .eq("property_id", propertyId)
        .order("name"),
    ]);
    if (documents.error || folders.error)
      return error("Les documents privés ne sont pas disponibles.", 503);
    return NextResponse.json(
      {
        success: true,
        documents: documents.data.map(summary),
        folders: folders.data,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const id = z.uuid().safeParse(requestedDocument);
  if (!id.success) return error("Identifiant de document invalide.", 400);
  const { data, error: readError } = await query
    .eq("id", id.data)
    .maybeSingle();
  if (readError) return error("Le document ne peut pas être chargé.", 503);
  if (!data) return error("Document introuvable.", 404);
  const signed = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.storage_path, 60, { download: data.file_name });
  if (signed.error)
    return error(
      "Le téléchargement du document ne peut pas être préparé.",
      503,
    );
  return NextResponse.redirect(signed.data.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function identifyMime(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (
    bytes
      .slice(0, 5)
      .every((byte, index) => byte === [37, 80, 68, 70, 45][index]) &&
    bytes.length >= 5
  )
    return "application/pdf";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (
    bytes.length === 8 &&
    bytes.every(
      (byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index],
    )
  )
    return "image/png";
  return null;
}

export async function POST(request: NextRequest, { params }: Params) {
  const result = await access(params, "property.write");
  if (result.response) return result.response;
  const { supabase, propertyId, session } = result;
  if (request.headers.get("content-type")?.includes("application/json")) {
    const folder = z
      .object({ name: z.string().trim().min(1).max(80) })
      .safeParse(await request.json().catch(() => null));
    if (!folder.success)
      return error("Saisissez un nom de dossier de 1 à 80 caractères.", 400);
    const created = await supabase
      .from("property_document_folders")
      .insert({ property_id: propertyId, name: folder.data.name })
      .select("id,name")
      .single();
    if (created.error?.code === "23505")
      return error("Un dossier portant ce nom existe déjà.", 409);
    if (created.error) return error("Le dossier n’a pas pu être créé.", 503);
    await writeAdminAuditLog(
      session,
      "property.document.folder",
      "property",
      propertyId,
      { folderId: created.data.id },
    );
    return NextResponse.json(
      { success: true, folder: created.data },
      { status: 201 },
    );
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const id = z.uuid().safeParse(form?.get("id"));
  const kind = documentKind.safeParse(form?.get("kind"));
  if (
    !id.success ||
    !kind.success ||
    !(file instanceof File) ||
    !file.size ||
    file.size > propertyDocumentLimit
  ) {
    return error(
      "Choisissez un document PDF, JPEG ou PNG de 4 Mio maximum et sa catégorie.",
      400,
    );
  }
  const mimeType = await identifyMime(file);
  if (!mimeType || mimeType !== file.type)
    return error(
      "Le contenu ne correspond pas au format de document annoncé.",
      400,
    );
  const requestedFolder = form?.get("folderId");
  let folderId = null;
  if (requestedFolder) {
    const parsed = z.uuid().safeParse(requestedFolder);
    if (!parsed.success) return error("Dossier de classement invalide.", 400);
    const folder = await supabase
      .from("property_document_folders")
      .select("id")
      .eq("property_id", propertyId)
      .eq("id", parsed.data)
      .maybeSingle();
    if (folder.error)
      return error("Le dossier de classement n’a pas pu être vérifié.", 503);
    if (!folder.data) return error("Dossier de classement introuvable.", 404);
    folderId = folder.data.id;
  }
  const findDocument = () =>
    supabase
      .from("property_documents")
      .select("*")
      .eq("id", id.data)
      .eq("property_id", propertyId)
      .is("archived_at", null)
      .maybeSingle();
  const prior = await findDocument();
  if (prior.error)
    return error("Le stockage des documents n’est pas disponible.", 503);
  if (prior.data)
    return NextResponse.json({ success: true, document: summary(prior.data) });
  const storagePath = `${propertyId}/${id.data}`;
  const upload = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { contentType: mimeType, upsert: false });
  if (upload.error) {
    const retry = await findDocument();
    if (retry.data)
      return NextResponse.json({
        success: true,
        document: summary(retry.data),
      });
    return error("L’envoi du document a échoué. Réessayez.", 503);
  }
  const { data, error: insertError } = await supabase
    .from("property_documents")
    .insert({
      id: id.data,
      property_id: propertyId,
      kind: kind.data,
      mime_type: mimeType,
      file_name:
        file.name.replace(/[\x00-\x1F\x7F/\\]/g, "_").slice(0, 200) ||
        "document",
      storage_path: storagePath,
      created_by: session.user.id,
      size_bytes: file.size,
      folder_id: folderId,
    })
    .select("*")
    .single();
  if (insertError) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return error("Le document n’a pas pu être associé au dossier.", 503);
  }
  await writeAdminAuditLog(
    session,
    "property.document.add",
    "property",
    propertyId,
    { documentId: id.data, kind: kind.data },
  );
  return NextResponse.json(
    { success: true, document: summary(data) },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const result = await access(params, "property.write");
  if (result.response) return result.response;
  const { supabase, propertyId, session } = result;
  const id = z.uuid().safeParse(request.nextUrl.searchParams.get("document"));
  if (!id.success) return error("Identifiant de document invalide.", 400);
  const archived = await supabase
    .from("property_documents")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("property_id", propertyId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (archived.error) return error("Le document n’a pas pu être archivé.", 503);
  if (!archived.data)
    return error("Document introuvable ou déjà archivé.", 404);
  await writeAdminAuditLog(
    session,
    "property.document.archive",
    "property",
    propertyId,
    { documentId: id.data },
  );
  return NextResponse.json({ success: true });
}

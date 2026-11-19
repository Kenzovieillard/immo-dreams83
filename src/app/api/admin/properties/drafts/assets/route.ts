import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  propertyDraftAssetPath,
  propertyDraftBucket,
} from "@/lib/property-draft-storage";
import {
  draftAssetSchema,
  draftAssetsSchema,
  propertyDocumentLimit,
} from "@/lib/property-workspace";
import { getSupabaseAdminClient } from "@/lib/supabase";

function failure(status: number, message: string) {
  return NextResponse.json({ success: false, message }, { status });
}

async function access(request: NextRequest) {
  const auth = await requireAdminSession("property.write");
  if (auth.response) return { response: auth.response };
  const parsed = z.object({ draft: z.uuid(), asset: z.uuid() }).safeParse({
    draft: request.nextUrl.searchParams.get("draft"),
    asset: request.nextUrl.searchParams.get("asset"),
  });
  if (!parsed.success)
    return { response: failure(400, "Fichier ou brouillon invalide.") };
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return {
      response: failure(503, "Le stockage des brouillons est indisponible."),
    };
  const author = auth.session.user.id;
  const { draft, asset } = parsed.data;
  const result = await supabase
    .from("property_drafts")
    .select("attachments")
    .eq("id", draft)
    .eq("author_id", author)
    .maybeSingle();
  if (result.error)
    return { response: failure(503, "Le brouillon n’a pas pu être vérifié.") };
  // The author can stage files before committing the draft. Only saved files can be read.
  return {
    bucket: supabase.storage.from(propertyDraftBucket),
    path: propertyDraftAssetPath(author, draft, asset),
    saved: draftAssetsSchema
      .safeParse(result.data?.attachments)
      .data?.some(({ id }) => id === asset),
    asset,
  };
}

export async function POST(request: NextRequest) {
  const resource = await access(request);
  if (resource.response) return resource.response;
  if (resource.saved) return failure(409, "Ce fichier est déjà enregistré.");
  const body = await request.formData().catch(() => null);
  const file = body?.get("file");
  if (
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > propertyDocumentLimit ||
    !draftAssetSchema.safeParse({
      id: resource.asset,
      name: file.name,
      mimeType: file.type,
      kind: body?.get("kind"),
    }).success
  ) {
    return failure(
      400,
      "Choisissez un fichier au format accepté de 4 Mio maximum.",
    );
  }
  const result = await resource.bucket.upload(resource.path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (result.error)
    return failure(503, "Le fichier du brouillon n’a pas pu être enregistré.");
  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const resource = await access(request);
  if (resource.response) return resource.response;
  if (!resource.saved)
    return failure(404, "Fichier introuvable dans ce brouillon.");
  const { data, error } = await resource.bucket.download(resource.path);
  if (error)
    return failure(503, "Le fichier du brouillon n’a pas pu être chargé.");
  return new Response(data, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": data.type || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  propertyDraftAssetPath,
  propertyDraftBucket,
} from "@/lib/property-draft-storage";
import {
  draftAssetsSchema,
  propertyDraftFormSchema,
  type PropertyDraft,
} from "@/lib/property-workspace";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

type DraftRow = Database["public"]["Tables"]["property_drafts"]["Row"];
const draftInput = z.object({
  id: z.uuid(),
  step: z.number().int().min(0).max(7),
  form: propertyDraftFormSchema,
  attachments: draftAssetsSchema.optional(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
});

function mapDraft(row: DraftRow): PropertyDraft | null {
  const form = propertyDraftFormSchema.safeParse(row.form);
  return form.success
    ? {
        id: row.id,
        step: row.step,
        form: form.data,
        attachments: draftAssetsSchema.safeParse(row.attachments).data ?? [],
        updatedAt: row.updated_at,
      }
    : null;
}

function error(message: string, status = 503) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET() {
  const auth = await requireAdminSession("property.write");
  if (auth.response) return auth.response;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return error("Supabase serveur n’est pas configuré.");
  const result = await supabase
    .from("property_drafts")
    .select("*")
    .eq("author_id", auth.session.user.id)
    .order("updated_at", { ascending: false });
  if (result.error)
    return error("Les brouillons de biens n’ont pas pu être chargés.");
  return NextResponse.json({
    success: true,
    drafts: result.data.map(mapDraft).filter(Boolean),
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminSession("property.write");
  if (auth.response) return auth.response;
  const input = draftInput.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return error(
      "Vérifiez le formulaire avant de sauvegarder le brouillon.",
      400,
    );
  const supabase = getSupabaseAdminClient();
  if (!supabase) return error("Supabase serveur n’est pas configuré.");
  const { id, step, form, expectedUpdatedAt, attachments } = input.data;
  const author = auth.session.user.id;
  const bucket = supabase.storage.from(propertyDraftBucket);
  const folder = propertyDraftAssetPath(author, id);
  if (attachments?.length) {
    const objects = await bucket.list(folder, { limit: 1000 });
    if (objects.error)
      return error("Impossible de vérifier les fichiers du brouillon.");
    const present = new Set(objects.data.map(({ name }) => name));
    if (attachments.some(({ id }) => !present.has(id)))
      return error(
        "Certains fichiers du brouillon doivent être envoyés à nouveau.",
        409,
      );
  }
  const values = {
    step,
    form,
    ...(attachments ? { attachments } : {}),
    updated_at: new Date().toISOString(),
  };
  const result = expectedUpdatedAt
    ? await supabase
        .from("property_drafts")
        .update(values)
        .eq("id", id)
        .eq("author_id", auth.session.user.id)
        .eq("updated_at", expectedUpdatedAt)
        .select("*")
        .maybeSingle()
    : await supabase
        .from("property_drafts")
        .insert({ id, ...values, author_id: auth.session.user.id })
        .select("*")
        .maybeSingle();
  if ((!result.error && !result.data) || result.error?.code === "23505") {
    return error(
      "Ce brouillon a déjà été sauvegardé. Rouvrez-le depuis le portefeuille.",
      409,
    );
  }
  if (result.error || !result.data)
    return error("Le brouillon n’a pas pu être sauvegardé.");
  return NextResponse.json({ success: true, draft: mapDraft(result.data) });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminSession("property.write");
  if (auth.response) return auth.response;
  const id = z.uuid().safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return error("Identifiant de brouillon invalide.", 400);
  const supabase = getSupabaseAdminClient();
  if (!supabase) return error("Supabase serveur n’est pas configuré.");
  const result = await supabase
    .from("property_drafts")
    .delete()
    .eq("id", id.data)
    .eq("author_id", auth.session.user.id)
    .select("id")
    .maybeSingle();
  if (result.error)
    return error("Le brouillon n’a pas pu être retiré de la liste.");
  if (result.data) {
    const bucket = supabase.storage.from(propertyDraftBucket);
    const folder = propertyDraftAssetPath(auth.session.user.id, id.data);
    const files = await bucket.list(folder, { limit: 1000 });
    const cleanup = files.data?.length
      ? await bucket.remove(files.data.map(({ name }) => `${folder}/${name}`))
      : null;
    if (files.error || cleanup?.error)
      console.error(
        "[Biens] Nettoyage des fichiers du brouillon non terminé",
        (files.error ?? cleanup?.error)?.message,
      );
  }
  return NextResponse.json({ success: true });
}

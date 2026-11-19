import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

const input = z.object({
  scheduledAt: z.iso.datetime({ offset: true }).nullable(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession("property.write");
  if (auth.response) return auth.response;
  const id = z.uuid().safeParse((await params).id);
  const payload = input.safeParse(await request.json().catch(() => null));
  if (!id.success || !payload.success)
    return failure("Indiquez une date de publication valide.", 400);
  const { scheduledAt, expectedUpdatedAt } = payload.data;
  if (scheduledAt && Date.parse(scheduledAt) <= Date.now())
    return failure("La publication doit être programmée dans le futur.", 400);
  const supabase = getSupabaseAdminClient();
  if (!supabase) return failure("Supabase serveur n’est pas configuré.", 503);
  const { data: property, error: loadError } = await supabase
    .from("properties")
    .select("id,reference,status,publication_status")
    .eq("id", id.data)
    .maybeSingle();
  if (loadError)
    return failure(
      "Les données de publication ne peuvent pas être chargées.",
      503,
    );
  if (!property) return failure("Bien introuvable.", 404);
  if (scheduledAt) {
    if (
      !["DRAFT", "UNPUBLISHED"].includes(property.publication_status) ||
      property.status === "sold"
    ) {
      return failure(
        "La programmation est réservée aux annonces en brouillon ou dépubliées qui ne sont pas vendues.",
        409,
      );
    }
    const readiness = await supabase.rpc("check_property_publication", {
      property_key: id.data,
    });
    if (readiness.error || !readiness.data)
      return failure("La complétude du dossier n’a pas pu être vérifiée.", 503);
    if (readiness.data.length) return failure(readiness.data.join(" "), 422);
  }
  const actorId = auth.session.user.id;
  const { data: updated, error } = await supabase
    .from("properties")
    .update({
      scheduled_publication_at: scheduledAt,
      publication_scheduled_by: scheduledAt ? actorId : null,
      publication_schedule_error: null,
      updated_by: actorId,
    })
    .eq("id", id.data)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at,scheduled_publication_at")
    .maybeSingle();
  if (error)
    return failure("La programmation n’a pas pu être enregistrée.", 503);
  if (!updated)
    return failure(
      "Ce bien a été modifié depuis son ouverture. Rechargez-le et réessayez.",
      409,
    );
  await writeAdminAuditLog(
    auth.session,
    scheduledAt ? "property.publication.queue" : "property.publication.cancel",
    "property",
    id.data,
    { scheduledAt, reference: property.reference },
  );
  return NextResponse.json({
    success: true,
    updatedAt: updated.updated_at,
    scheduledPublicationAt: updated.scheduled_publication_at,
  });
}

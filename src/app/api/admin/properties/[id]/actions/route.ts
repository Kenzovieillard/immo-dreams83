import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { propertyActionSchema } from "@/lib/property-workspace";
import { getSupabaseAdminClient } from "@/lib/supabase";

type Context = { params: Promise<{ id: string }> };
const revision = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});
const confirmation = revision.extend({ confirm: z.literal(true) });

const failures = {
  forbidden: [403, "Vous n’avez pas l’autorisation de modifier ce bien."],
  missing: [404, "Bien introuvable."],
  conflict: [
    409,
    "Ce bien a été modifié. Rechargez le portefeuille avant de réessayer.",
  ],
  linked: [
    409,
    "Ce bien est associé à un document ou à un dossier CRM. Archivez-le pour conserver ces liens.",
  ],
  invalid_state: [
    409,
    "Cette action est indisponible pour l’état actuel du bien.",
  ],
  not_public: [
    409,
    "Publiez le bien avant de le mettre à la une. Le site affiche les biens disponibles et réservés.",
  ],
  incomplete: [422, "Complétez le dossier avant de publier le bien."],
} as const;

function failure(status: number, message: string) {
  return NextResponse.json({ success: false, message }, { status });
}

async function apply(request: Request, { params }: Context, deleting = false) {
  const auth = await requireAdminSession(
    deleting ? "property.delete" : "property.write",
  );
  if (auth.response) return auth.response;
  const id = z.uuid().safeParse((await params).id);
  const input: unknown = await request.json().catch(() => null);
  const version = (deleting ? confirmation : revision).safeParse(input);
  const operation = deleting
    ? { success: true as const, data: { action: "delete" } }
    : propertyActionSchema.safeParse(input);
  if (!id.success || !version.success || !operation.success)
    return failure(400, "Vérifiez l’action sélectionnée et sa confirmation.");

  const supabase = getSupabaseAdminClient();
  if (!supabase) return failure(503, "Le service des biens est indisponible.");
  const result = await supabase.rpc("apply_property_workspace_action", {
    property_key: id.data,
    expected_updated_at: version.data.expectedUpdatedAt,
    actor_key: auth.session.user.id,
    property_action: operation.data.action,
    ...("value" in operation.data
      ? { action_value: String(operation.data.value) }
      : {}),
  });
  if (
    result.error ||
    !result.data ||
    typeof result.data !== "object" ||
    Array.isArray(result.data)
  ) {
    if (result.error?.code === "23503") return failure(...failures.linked);
    if (result.error?.code === "23514")
      return failure(422, result.error.message);
    return failure(503, "L’action sur le bien a échoué. Réessayez.");
  }
  if (
    typeof result.data.error === "string" &&
    Object.hasOwn(failures, result.data.error)
  ) {
    const [status, message] =
      failures[result.data.error as keyof typeof failures];
    return failure(
      status,
      typeof result.data.message === "string" ? result.data.message : message,
    );
  }
  return NextResponse.json({ success: true, result: result.data });
}

export async function PATCH(request: Request, context: Context) {
  return apply(request, context);
}

export async function DELETE(request: Request, context: Context) {
  return apply(request, context, true);
}

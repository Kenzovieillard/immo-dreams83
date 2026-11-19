import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { contactActionSchema } from "@/lib/contact-rules";
import { checkContactAccess } from "@/lib/contact-access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;
  const { id } = await params;
  const parsed = contactActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!z.string().uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json(
      { success: false, message: "Vérifiez les champs de l'action." },
      { status: 400 },
    );
  const client = getSupabaseAdminClient();
  if (!client)
    return NextResponse.json(
      { success: false, message: "Supabase non configuré." },
      { status: 503 },
    );
  const denied = await checkContactAccess(client, auth.session, id);
  if (denied)
    return NextResponse.json(
      { success: false, message: denied.message },
      { status: denied.status },
    );
  const { data, error } = await client.rpc("contact_workspace_action", {
    p_contact_id: id,
    p_actor_id: auth.session.user.id,
    p_action: parsed.data,
  });
  if (error)
    return NextResponse.json(
      {
        success: false,
        message:
          error.code === "42501"
            ? "Action non autorisée pour ce contact."
            : error.code === "23514"
              ? "Action incompatible avec l'état du contact ou de la tâche."
              : "L'action n'a pas pu être enregistrée.",
      },
      {
        status:
          error.code === "42501" ? 403 : error.code === "23514" ? 409 : 500,
      },
    );
  return NextResponse.json({
    success: true,
    id: data,
    message: "Action enregistrée.",
  });
}

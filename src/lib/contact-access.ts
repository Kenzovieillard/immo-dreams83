import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AdminSession } from "@/types/admin";

export async function checkContactAccess(
  client: SupabaseClient<Database>,
  session: AdminSession,
  id: string,
) {
  const { data, error } = await client
    .from("contacts")
    .select("id,assigned_to,archived")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return {
      status: 500,
      message: "Impossible de vérifier les droits du contact.",
    };
  if (!data) return { status: 404, message: "Contact introuvable." };
  if (session.profile.role === "AGENT" && data.assigned_to !== session.user.id)
    return {
      status: 403,
      message: "Ce contact n'est pas attribué à votre compte.",
    };
  return null;
}

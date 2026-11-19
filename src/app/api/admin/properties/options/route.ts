import { NextResponse } from "next/server";
import { hasAdminPermission, requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const supabase = getSupabaseAdminClient();
  if (!supabase)
    return NextResponse.json(
      { success: false, message: "Supabase serveur n’est pas configuré." },
      { status: 503 },
    );

  let contacts = supabase
    .from("contacts")
    .select("id,name")
    .eq("archived", false)
    .order("name");
  if (auth.session.profile.role === "AGENT")
    contacts = contacts.eq("assigned_to", auth.session.user.id);
  const canWrite = hasAdminPermission(
    auth.session.profile.role,
    "property.write",
  );
  const [people, profiles] = await Promise.all([
    canWrite ? contacts : { data: [], error: null },
    supabase
      .from("profiles")
      .select("id,full_name,email")
      .eq("is_active", true)
      .in("role", ["ADMIN", "DIRECTOR", "AGENT", "ASSISTANT"])
      .order("full_name"),
  ]);
  if (people.error || profiles.error) {
    return NextResponse.json(
      {
        success: false,
        message: "Le référentiel des contacts et conseillers est indisponible.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({
    success: true,
    owners: people.data ?? [],
    advisors: (profiles.data ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name || profile.email,
    })),
  });
}

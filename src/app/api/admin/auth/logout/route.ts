import { NextResponse } from "next/server";
import { clearAdminSessionCookies, getAdminSession, getCrmAuthTokens, writeAdminAuditLog } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST() {
  const session = await getAdminSession();
  const response = NextResponse.json({
    success: true,
    message: "Session admin fermée.",
    redirectTo: "/admin/login",
  });

  clearAdminSessionCookies(response);
  const { access_token } = await getCrmAuthTokens();
  if (access_token) await getSupabaseAdminClient()?.auth.admin.signOut(access_token, "local");
  await writeAdminAuditLog(session, "admin.logout", "auth", session?.user.id ?? null);

  return response;
}

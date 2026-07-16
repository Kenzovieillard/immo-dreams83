import { NextResponse } from "next/server";
import { clearAdminSessionCookies, getAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";

export async function POST() {
  const session = await getAdminSession();
  const response = NextResponse.json({
    success: true,
    message: "Session admin fermée.",
    redirectTo: "/admin/login",
  });

  clearAdminSessionCookies(response);
  await writeAdminAuditLog(session, "admin.logout", "auth", session?.user.id ?? null);

  return response;
}

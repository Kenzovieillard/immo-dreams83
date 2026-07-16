import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile, setAdminSessionCookies, writeAdminAuditLog } from "@/lib/admin-auth";
import { getSupabaseClient } from "@/lib/supabase";

function getStringField(payload: unknown, field: string) {
  if (!payload || typeof payload !== "object") return "";
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const email = getStringField(payload, "email").toLowerCase();
  const password = getStringField(payload, "password");

  if (!email || !password) {
    return NextResponse.json(
      { success: false, message: "Email et mot de passe obligatoires." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "Supabase Auth n'est pas configuré." },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user.email) {
    return NextResponse.json(
      { success: false, message: "Identifiants invalides." },
      { status: 401 }
    );
  }

  const profile = await getAdminProfile({ id: data.user.id, email: data.user.email });
  if (!profile) {
    return NextResponse.json(
      {
        success: false,
        message: "Compte authentifié, mais aucun profil CRM actif n'est associé.",
      },
      { status: 403 }
    );
  }

  const response = NextResponse.json({
    success: true,
    message: "Connexion réussie.",
    redirectTo: "/admin",
    profile: {
      email: profile.email,
      role: profile.role,
      fullName: profile.full_name,
    },
  });

  setAdminSessionCookies(response, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
  });

  await writeAdminAuditLog(
    {
      user: { id: data.user.id, email: data.user.email },
      profile,
    },
    "admin.login",
    "auth",
    data.user.id
  );

  return response;
}

import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile, setAdminSessionCookies, writeAdminAuditLog } from "@/lib/admin-auth";
import { createCrmAuthClient } from "@/lib/supabase";

function getStringField(payload: unknown, field: string) {
  if (!payload || typeof payload !== "object") return "";
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

function crmRedirect(value: string) {
  try {
    const base = "https://crm.invalid";
    const url = new URL(value, base);
    if (url.origin === base && (/^\/admin(?:\/|$)/.test(url.pathname) || /^\/commercial(?:\/|$)/.test(url.pathname))
      && url.pathname !== "/admin/login") return url.pathname + url.search + url.hash;
  } catch {
    // Invalid targets fall back to the dashboard.
  }
  return "/admin";
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const email = getStringField(payload, "email").trim().toLowerCase();
  const password = getStringField(payload, "password");
  const code = getStringField(payload, "code").trim();

  if (!email || !password) {
    return NextResponse.json(
      { success: false, message: "Email et mot de passe obligatoires." },
      { status: 400 }
    );
  }

  const supabase = createCrmAuthClient();
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
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json(
      {
        success: false,
        message: "Compte authentifié, mais aucun profil CRM actif n'est associé.",
      },
      { status: 403 }
    );
  }

  let credentials = data.session;
  const verified = data.user.factors?.filter(factor => factor.status === "verified") ?? [];
  if (verified.length) {
    const factor = verified.find(row => row.factor_type === "totp");
    if (!factor || !/^\d{6}$/.test(code)) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.json({
        success: false, mfaRequired: Boolean(factor),
        message: factor ? "Saisissez le code de votre application d’authentification." : "Ce compte utilise un facteur non disponible dans le CRM. Contactez l’administrateur.",
      }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const proof = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (proof.error || !proof.data) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.json({ success: false, mfaRequired: true, message: "Code invalide ou expiré." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    credentials = { ...credentials, ...proof.data };
  }

  const response = NextResponse.json({
    success: true,
    message: "Connexion réussie.",
    redirectTo: crmRedirect(getStringField(payload, "redirect")),
    profile: {
      email: profile.email,
      role: profile.role,
      fullName: profile.full_name,
    },
  });

  setAdminSessionCookies(response, {
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expires_in: credentials.expires_in,
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

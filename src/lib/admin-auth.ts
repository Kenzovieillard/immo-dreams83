import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseClient } from "@/lib/supabase";
import { adminRoles, type AdminProfile, type AdminRole, type AdminSession } from "@/types/admin";

const accessTokenCookie = "immo_admin_access_token";
const refreshTokenCookie = "immo_admin_refresh_token";

export const adminRoleLabels: Record<AdminRole, string> = {
  ADMIN: "Administrateur",
  DIRECTOR: "Direction",
  AGENT: "Agent",
  ASSISTANT: "Assistant",
  MARKETING: "Marketing",
  READ_ONLY: "Lecture seule",
};

export type AdminPermission =
  | "crm.read"
  | "lead.write"
  | "property.write"
  | "photo.write"
  | "audit.read"
  | "users.manage";

const permissionMatrix: Record<AdminRole, AdminPermission[]> = {
  ADMIN: ["crm.read", "lead.write", "property.write", "photo.write", "audit.read", "users.manage"],
  DIRECTOR: ["crm.read", "lead.write", "property.write", "photo.write", "audit.read"],
  AGENT: ["crm.read", "lead.write", "property.write", "photo.write"],
  ASSISTANT: ["crm.read", "lead.write", "property.write", "photo.write"],
  MARKETING: ["crm.read", "property.write", "photo.write"],
  READ_ONLY: ["crm.read"],
};

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && adminRoles.includes(value as AdminRole);
}

function parseBootstrapEmails() {
  return (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function normalizeProfile(value: AdminProfile | null) {
  if (!value || !isAdminRole(value.role) || !value.is_active) return null;
  return value;
}

export function hasAdminPermission(role: AdminRole, permission: AdminPermission) {
  return permissionMatrix[role].includes(permission);
}

export async function getAdminProfile(user: { id: string; email?: string | null }) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !user.email) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,is_active,created_at,updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[IMMO-DREAMS83] Admin profile lookup failed", error.message);
    return null;
  }

  const profile = normalizeProfile(data as AdminProfile | null);
  if (profile) return profile;

  const bootstrapEmails = parseBootstrapEmails();
  if (!bootstrapEmails.includes(user.email.toLowerCase())) return null;

  const { data: createdProfile, error: createError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      full_name: user.email,
      role: "ADMIN",
      is_active: true,
    })
    .select("id,email,full_name,role,is_active,created_at,updated_at")
    .single();

  if (createError) {
    console.error("[IMMO-DREAMS83] Admin bootstrap profile failed", createError.message);
    return null;
  }

  return normalizeProfile(createdProfile as AdminProfile | null);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(accessTokenCookie)?.value;
  if (!accessToken) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;

  const profile = await getAdminProfile({
    id: data.user.id,
    email: data.user.email,
  });
  if (!profile) return null;

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    profile,
  };
}

export async function requireAdminSession(permission: AdminPermission = "crm.read") {
  const session = await getAdminSession();
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ success: false, message: "Session admin requise." }, { status: 401 }),
    };
  }

  if (!hasAdminPermission(session.profile.role, permission)) {
    return {
      session: null,
      response: NextResponse.json({ success: false, message: "Droits insuffisants." }, { status: 403 }),
    };
  }

  return { session, response: null };
}

export function setAdminSessionCookies(response: NextResponse, session: { access_token: string; refresh_token: string; expires_in: number }) {
  response.cookies.set(accessTokenCookie, session.access_token, getCookieOptions(session.expires_in));
  response.cookies.set(refreshTokenCookie, session.refresh_token, getCookieOptions(60 * 60 * 24 * 30));
}

export function clearAdminSessionCookies(response: NextResponse) {
  response.cookies.set(accessTokenCookie, "", getCookieOptions(0));
  response.cookies.set(refreshTokenCookie, "", getCookieOptions(0));
}

export async function writeAdminAuditLog(
  session: AdminSession | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from("audit_logs").insert({
    actor_id: session?.user.id ?? null,
    actor_email: session?.user.email ?? "system",
    actor_role: session?.profile.role ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: metadata ?? {},
  });
}

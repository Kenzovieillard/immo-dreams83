import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { CrmOnboardingProgress, CrmOnboardingStepKey } from "@/types/crm";
import type { Tables, TablesUpdate } from "@/types/supabase";

type OnboardingRow = Tables<"crm_onboarding_progress">;

const stepColumns: Record<CrmOnboardingStepKey, keyof TablesUpdate<"crm_onboarding_progress">> = {
  profile: "profile_completed",
  contacts: "contacts_completed",
  pipeline: "pipeline_completed",
  appointment: "appointment_completed",
};

function isStepKey(value: unknown): value is CrmOnboardingStepKey {
  return typeof value === "string" && value in stepColumns;
}

function normalizeProgress(row: OnboardingRow): CrmOnboardingProgress {
  return {
    profileCompleted: row.profile_completed,
    contactsCompleted: row.contacts_completed,
    pipelineCompleted: row.pipeline_completed,
    appointmentCompleted: row.appointment_completed,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function allStepsCompleted(row: Pick<OnboardingRow, "profile_completed" | "contacts_completed" | "pipeline_completed" | "appointment_completed">) {
  return row.profile_completed && row.contacts_completed && row.pipeline_completed && row.appointment_completed;
}

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("crm_onboarding_progress")
    .select("*")
    .eq("user_id", auth.session.user.id)
    .maybeSingle();

  if (error) {
    console.error("[IMMO-DREAMS83] Onboarding progress load failed", error.message);
    return NextResponse.json({ success: false, message: "La progression de démarrage n'a pas pu être chargée." }, { status: 500 });
  }

  return NextResponse.json({ success: true, progress: data ? normalizeProgress(data) : null });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as {
    start?: boolean;
    step?: CrmOnboardingStepKey;
    completed?: boolean;
  } | null;

  const startsOnboarding = payload?.start === true;
  const updatesStep = isStepKey(payload?.step) && typeof payload?.completed === "boolean";
  if (!startsOnboarding && !updatesStep) {
    return NextResponse.json({ success: false, message: "Mise à jour de progression invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const { data: existing, error: readError } = await supabase
    .from("crm_onboarding_progress")
    .select("*")
    .eq("user_id", auth.session.user.id)
    .maybeSingle();

  if (readError) {
    console.error("[IMMO-DREAMS83] Onboarding progress read failed", readError.message);
    return NextResponse.json({ success: false, message: "La progression n'a pas pu être relue." }, { status: 500 });
  }

  const baseRow = existing ?? {
    user_id: auth.session.user.id,
    profile_completed: false,
    contacts_completed: false,
    pipeline_completed: false,
    appointment_completed: false,
    started_at: new Date().toISOString(),
    completed_at: null,
    updated_at: new Date().toISOString(),
  };
  const step = updatesStep ? payload.step : null;
  const completed = updatesStep ? payload.completed : null;
  const nextRow = updatesStep
    ? { ...baseRow, [stepColumns[step!]]: completed! }
    : baseRow;
  const updates: TablesUpdate<"crm_onboarding_progress"> = {
    ...(updatesStep ? { [stepColumns[step!]]: completed! } : {}),
    completed_at: allStepsCompleted(nextRow) ? existing?.completed_at ?? new Date().toISOString() : null,
  };

  const query = existing
    ? supabase
        .from("crm_onboarding_progress")
        .update(updates)
        .eq("user_id", auth.session.user.id)
    : supabase
        .from("crm_onboarding_progress")
        .insert({ user_id: auth.session.user.id, ...updates });
  const { data, error } = await query.select("*").single();

  if (error) {
    console.error("[IMMO-DREAMS83] Onboarding progress update failed", error.message);
    return NextResponse.json({ success: false, message: "La progression n'a pas pu être enregistrée." }, { status: 500 });
  }

  if (updatesStep) {
    await writeAdminAuditLog(auth.session, "crm.onboarding.update", "crm_onboarding_progress", auth.session.user.id, {
      step: payload.step,
      completed: payload.completed,
    });
  }

  return NextResponse.json({
    success: true,
    message: "Progression enregistrée.",
    progress: normalizeProgress(data),
  });
}

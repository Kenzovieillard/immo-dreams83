import { NextResponse } from "next/server";
import { CommercialDataError } from "@/lib/commercial-service";
import {
  commercialApiErrorMessage,
  isCommercialConflictError,
} from "@/lib/commercial-api-error";

export function commercialApiError(error: unknown, fallback: string) {
  if (error instanceof CommercialDataError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  const message = commercialApiErrorMessage(error);
  console.error(`[IMMO-DREAMS83] ${fallback}`, message);
  const conflict = isCommercialConflictError(message);
  return NextResponse.json(
    { success: false, message: conflict ? "L'action ne respecte pas les règles métier ou les relations actuelles." : fallback },
    { status: conflict ? 409 : 500 }
  );
}

export function actorName(session: { profile: { full_name: string | null }; user: { email: string } }) {
  return session.profile.full_name ?? session.user.email;
}

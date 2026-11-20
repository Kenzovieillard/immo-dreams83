import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { readCrmInbox } from "@/lib/crm-settings-inbox";
import { getSupabaseAdminClient } from "@/lib/supabase";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const db = getSupabaseAdminClient();
  try {
    if (!db) throw new Error("Stockage indisponible");
    return NextResponse.json({ success: true, ...await readCrmInbox(db, auth.session) }, { headers });
  } catch {
    return NextResponse.json({ success: false, message: "Les notifications sont momentanément indisponibles." }, { status: 503, headers });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { readCommuneReference } from "@/lib/property-commune-reference";
import { isMapPostalCode } from "@/lib/property-communes";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const codes = Array.from(
    new Set((request.nextUrl.searchParams.get("codes") ?? "").split(",")),
  );
  if (
    !codes.length ||
    codes.length > 24 ||
    codes.some((code) => !isMapPostalCode(code))
  ) {
    return NextResponse.json(
      { message: "Codes postaux invalides." },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { index: readCommuneReference(codes) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

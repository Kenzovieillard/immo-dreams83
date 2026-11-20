import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { parisDay, validAgendaDay } from "@/lib/agenda-time";
import { canRecordSales } from "@/lib/statistics-data";
import { getSupabaseAdminClient } from "@/lib/supabase";

const headers = { "Cache-Control": "private, no-store" };
const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status, headers });
const amount = z.number().finite().min(0).max(1_000_000_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001);
const saleInput = z.object({
  propertyId: z.uuid(),
  advisorId: z.uuid().nullable(),
  signedOn: z.string().refine(value => validAgendaDay(value) && value >= "2000-01-01" && value <= parisDay()),
  price: amount.positive(),
  fee: amount,
  expected: z.iso.datetime({ offset: true }).nullable(),
}).refine(value => value.fee <= value.price);

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  if (!canRecordSales(auth.session.profile.role)) return fail("La saisie des ventes est réservée à la direction.", 403);
  const db = getSupabaseAdminClient();
  if (!db) return fail("La connexion au CRM est indisponible.", 503);
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80).replace(/[^\p{L}\p{N} ._'’-]/gu, " ").trim().replaceAll("_", "\\_");
  const propertyId = z.uuid().optional().safeParse(request.nextUrl.searchParams.get("property") ?? undefined);
  if (!propertyId.success) return fail("Référence du bien invalide.", 400);
  const properties = db.from("properties").select("id,title,reference,city,advisor_id").eq("transaction_type", "sale");
  const sold = propertyId.data ? properties.eq("id", propertyId.data) : properties.or("commercial_status.eq.SOLD,and(commercial_status.is.null,status.eq.sold)");
  const filtered = query ? sold.or(`title.ilike.%${query}%,reference.ilike.%${query}%,city.ilike.%${query}%`) : sold;
  const { data, error } = await filtered.order("reference").order("id").limit(40);
  if (error) return fail("La liste des biens vendus est indisponible.", 503);
  const ids = (data ?? []).map(row => row.id);
  const sales = ids.length ? await db.from("crm_sales").select("property_id,advisor_id,signed_on,sale_price,fee_excl_tax,updated_at").in("property_id", ids) : null;
  if (sales?.error) return fail("Le registre des ventes est indisponible.", 503);
  const records = new Map(sales?.data?.map(row => [row.property_id, row]));
  return NextResponse.json({
    success: true, properties: (data ?? []).map(row => ({
      id: row.id, label: `${row.reference} · ${row.title}${row.city ? ` · ${row.city}` : ""}`,
      advisorId: row.advisor_id, sale: records.get(row.id) ?? null,
    })),
  }, { headers });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  if (!canRecordSales(auth.session.profile.role)) return fail("La saisie des ventes est réservée à la direction.", 403);
  const db = getSupabaseAdminClient();
  if (!db) return fail("La connexion au CRM est indisponible.", 503);
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") return fail("Utilisez le format JSON pour saisir une vente.", 415);
  const input = saleInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("Renseignez une date d’acte et des montants valides.", 400);
  const { propertyId, advisorId, signedOn, price, fee, expected } = input.data;
  const { data, error } = await db.rpc("record_crm_sale", {
    p_actor: auth.session.user.id, p_property: propertyId, p_advisor: advisorId, p_signed_on: signedOn, p_sale_price: price, p_fee: fee, p_expected: expected,
  });
  if (error) return fail("L’enregistrement a échoué. Réessayez dans un instant.", 503);
  if (data === "forbidden") return fail("Droits insuffisants.", 403);
  if (data === "missing") return fail("Bien introuvable.", 404);
  if (data === "conflict") return fail("La vente a été modifiée. Rechargez le bien avant de réessayer.", 409);
  if (data === "invalid_state") return fail("Passez le bien au statut Vendu avant de saisir son acte.", 409);
  if (data !== "ok") return fail("Vérifiez la date, le conseiller et les montants.", 400);
  return NextResponse.json({ success: true }, { headers });
}

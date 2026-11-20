import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { buildCrmStatistics } from "@/lib/statistics-crm";
import { canRecordSales, canSeeSales } from "@/lib/statistics-data";
import { loadStatisticsData } from "@/lib/statistics-service";
import { loadWebStatistics } from "@/lib/statistics-web";
import { statisticsCsv, statisticsPeriod, statisticsView, statisticsViews, validStatisticsPeriod, webSegments } from "@/lib/statistics";

const headers = { "Cache-Control": "private, no-store" };
const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status, headers });

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const params = request.nextUrl.searchParams;
  const rawView = params.get("view") ?? "overview";
  const view = statisticsView(rawView);
  const range = statisticsPeriod("month");
  const period = { from: params.get("from") ?? range.from, to: params.get("to") ?? range.to };
  const member = z.uuid().optional().safeParse(params.get("advisor") ?? undefined);
  const segment = z.enum(webSegments).safeParse(params.get("segment") ?? "all");
  if (!statisticsViews.some(row => row.id === rawView) || !validStatisticsPeriod(period) || !member.success || !segment.success
    || params.has("from") !== params.has("to") || !["json", "csv"].includes(params.get("format") ?? "json")) {
    return fail("Période, vue ou filtre statistique invalide.", 400);
  }

  const now = new Date();
  const { session } = auth;
  const unrestricted = session.profile.role !== "AGENT";
  if (!unrestricted && member.data && member.data !== session.user.id) return fail("Ce conseiller est hors de votre périmètre.", 403);
  try {
    let report;
    if (view === "web") report = await loadWebStatistics(period, segment.data, now);
    else {
      const db = getSupabaseAdminClient();
      if (!db) return fail("La connexion au CRM est indisponible.", 503);
      const data = await loadStatisticsData(db, session);
      const advisors = data.profiles.map(({ id, full_name, is_active }) => ({
        id, label: full_name?.trim() || (id === session.user.id ? "Mon portefeuille" : "Conseiller sans nom"), active: is_active,
      })).sort((a, b) => a.label.localeCompare(b.label, "fr"));
      if (member.data && !advisors.some(({ id }) => id === member.data)) return fail("Le conseiller sélectionné est introuvable.", 400);
      report = buildCrmStatistics(data, {
        view, period, now, advisors, team: unrestricted,
        selectedAdvisor: unrestricted ? member.data ?? null : session.user.id,
        canRecordSales: canRecordSales(session.profile.role),
        offersVisible: canSeeSales(session.profile.role),
      });
    }
    if (params.get("format") === "csv") {
      return new NextResponse(statisticsCsv(report), {
        headers: {
          ...headers, "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="statistiques-${view}-${period.from}-${period.to}.csv"`,
        },
      });
    }
    return NextResponse.json({ success: true, report }, { headers });
  } catch (error) {
    console.error("[CRM statistiques]", error instanceof Error ? error.message : "erreur inconnue");
    return fail("Les statistiques CRM n’ont pas pu être chargées. Réessayez dans un instant.", 503);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { agendaMutationSchema, agendaViews } from "@/lib/agenda";
import { parisDay, validAgendaDay } from "@/lib/agenda-time";
import {
  AgendaDataError,
  loadAgenda,
  loadAgendaEntry,
  searchAgendaOptions,
} from "@/lib/agenda-service";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Json } from "@/types/supabase";

const headers = { "Cache-Control": "private, no-store" };
const response = (payload: unknown, status = 200) =>
  NextResponse.json(payload, { status, headers });
const failure = (message: string, status = 503) =>
  response({ success: false, message }, status);
const sourceSchema = z.enum(["appointment", "estimation", "task"]);

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;
  const q = request.nextUrl.searchParams;
  try {
    if (q.has("lookup")) {
      const type = z
        .enum(["contact", "property", "estimation"])
        .safeParse(q.get("lookup"));
      const id = z
        .uuid()
        .optional()
        .safeParse(q.get("id") ?? undefined);
      if (!type.success || !id.success)
        return failure("Recherche invalide.", 400);
      const options = await searchAgendaOptions(
        auth.session,
        type.data,
        (q.get("q") ?? "").slice(0, 80),
        id.data,
      );
      return response({ success: true, options });
    }
    if (q.has("entry")) {
      const source = sourceSchema.safeParse(q.get("source"));
      const id = z.uuid().safeParse(q.get("entry"));
      if (!source.success || !id.success)
        return failure("Activité invalide.", 400);
      return response({
        success: true,
        ...(await loadAgendaEntry(auth.session, source.data, id.data)),
      });
    }
    const date = q.get("date") ?? parisDay();
    const view = z.enum(agendaViews).safeParse(q.get("view") ?? "day");
    const member = z
      .uuid()
      .optional()
      .safeParse(q.get("assignee") ?? undefined);
    if (!validAgendaDay(date) || !view.success || !member.success)
      return failure("Période ou responsable invalide.", 400);
    return response({
      success: true,
      ...(await loadAgenda(auth.session, date, view.data, member.data)),
    });
  } catch (error) {
    if (error instanceof AgendaDataError)
      return failure(error.message, error.status);
    return failure("L’agenda n’a pas pu être chargé. Réessayez.");
  }
}

const failures = {
  forbidden: [403, "Vous n’avez pas les droits pour cette action."],
  assignee: [403, "Ce responsable est inactif ou hors de votre périmètre."],
  missing: [404, "Cette activité a été supprimée ou déplacée."],
  stale: [
    409,
    "Cette activité a été modifiée. Rechargez sa dernière version avant d’enregistrer.",
  ],
  linked: [
    409,
    "Cette activité est liée à un dossier du CRM. Utilisez son parcours d’origine ou annulez-la.",
  ],
  state: [
    409,
    "Cette action est indisponible pour l’état ou la date de l’activité.",
  ],
  invalid: [400, "Vérifiez les informations de l’activité."],
  duration: [
    422,
    "La durée d’un rendez-vous d’estimation est limitée à huit heures.",
  ],
  contact: [422, "Un contact sélectionné est archivé ou inaccessible."],
  coordinate: [
    422,
    "Le contact ne dispose pas des coordonnées requises pour ce canal.",
  ],
  property: [422, "Le bien sélectionné est archivé ou introuvable."],
  reminder_past: [422, "Le rappel doit être prévu à une heure future."],
  idempotency: [
    409,
    "Une autre opération a déjà utilisé cet identifiant. Rechargez l’activité.",
  ],
  overlap: [409, "Ce responsable a déjà une activité pendant ce créneau."],
} as const;

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("lead.write");
  if (auth.response) return auth.response;
  const parsed = agendaMutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const fields = Object.fromEntries(
      parsed.error.issues.map((issue) => [
        issue.path.at(-1) ?? "form",
        issue.message,
      ]),
    );
    return response(
      { success: false, message: "Vérifiez la saisie.", fields },
      422,
    );
  }
  const db = getSupabaseAdminClient();
  if (!db) return failure("Le service Agenda est indisponible.");
  const { requestId, ...payload } = parsed.data;
  const result = await db.rpc("apply_agenda_mutation", {
    actor_key: auth.session.user.id,
    request_key: requestId,
    payload: payload as Json,
  });
  if (result.error) {
    if (result.error.code === "23503")
      return failure(failures.linked[1], failures.linked[0]);
    console.error("[Agenda] Échec de l’opération Supabase", result.error.code);
    return failure("L’opération n’a pas pu être enregistrée. Réessayez.");
  }
  const data = result.data;
  if (!data || typeof data !== "object" || Array.isArray(data))
    return failure("Réponse Agenda incomplète.");
  if (typeof data.error === "string" && Object.hasOwn(failures, data.error)) {
    const [status, message] = failures[data.error as keyof typeof failures];
    return response(
      { success: false, code: data.error, message, conflict: data.conflict },
      status,
    );
  }
  return response({ success: true, result: data });
}

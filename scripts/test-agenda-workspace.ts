import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { expect, type BrowserContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/supabase";
import type {
  AgendaData,
  AgendaEntry,
  AgendaMutation,
} from "../src/lib/agenda";
import { parisDay, parisInstant, shiftAgendaDay } from "../src/lib/agenda-time";

export async function verifyAgendaWorkspace({
  browserContext,
  readOnlyContext,
  supabase,
  baseUrl,
  runId,
  adminId,
  readerId,
  buyerId,
  ownerId,
  runSql,
  record,
}: {
  browserContext: BrowserContext;
  readOnlyContext: BrowserContext;
  supabase: SupabaseClient<Database>;
  baseUrl: string;
  runId: string;
  adminId: string;
  readerId: string;
  buyerId: string;
  ownerId: string;
  runSql: (sql: string) => void;
  record: (check: string, evidence: string) => void;
}) {
  const endpoint = `${baseUrl}/api/admin/agenda`;
  const request = browserContext.request;
  const page = await browserContext.newPage();
  const day = shiftAgendaDay(parisDay(), 2);
  const next = shiftAgendaDay(day, 1);
  const at = (d: string, time: string) => parisInstant(`${d}T${time}`)!;
  const errors: string[] = [];
  const ids = {
    appointments: new Set<string>(),
    tasks: new Set<string>(),
    estimations: new Set<string>(),
  };
  let propertyId: string | undefined;
  page.on("pageerror", (error) => errors.push(error.message));
  const post = (data: AgendaMutation) => request.post(endpoint, { data });
  async function save(
    entry: Extract<AgendaMutation, { operation: "save" }>["entry"],
    options?: {
      expectedUpdatedAt?: string;
      requestId?: string;
      acceptConflict?: boolean;
    },
  ) {
    const response = await post({
      operation: "save",
      requestId: options?.requestId ?? crypto.randomUUID(),
      expectedUpdatedAt: options?.expectedUpdatedAt,
      acceptConflict: options?.acceptConflict,
      entry,
    });
    const data = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(data));
    const { id, source } = data.result as {
      id: string;
      source: AgendaEntry["source"];
    };
    if (source === "appointment") ids.appointments.add(id);
    if (source === "task") ids.tasks.add(id);
    if (source === "estimation") ids.estimations.add(id);
    return { id, source };
  }
  async function get(source: AgendaEntry["source"], id: string) {
    const response = await request.get(
      `${endpoint}?${new URLSearchParams({ source, entry: id })}`,
    );
    assert.equal(response.status(), 200, await response.text());
    return (await response.json()).item as AgendaEntry;
  }
  async function change(
    item: AgendaEntry,
    operation: "complete" | "reopen" | "cancel" | "delete" | "reminder",
    extra?: {
      confirm?: boolean;
      reason?: string;
      reminderMinutes?: number | null;
    },
  ) {
    return post({
      operation,
      id: item.id,
      source: item.source,
      expectedUpdatedAt: item.updatedAt,
      requestId: crypto.randomUUID(),
      ...extra,
    });
  }
  try {
    assert.equal((await fetch(endpoint)).status, 401);
    const baseMeeting = {
      source: "appointment",
      type: "MEETING",
      title: `${runId} Rendez-vous`,
      assigneeId: adminId,
      contactId: buyerId,
      startsAt: at(day, "10:00"),
      endsAt: at(day, "11:00"),
      notes: runId,
      reminderMinutes: 60,
    } as const;
    const key = crypto.randomUUID();
    const created = await save(baseMeeting, { requestId: key });
    const replay = await save(baseMeeting, { requestId: key });
    assert.equal(created.id, replay.id);
    const conflictId = crypto.randomUUID();
    const overlapping = {
      ...baseMeeting,
      title: `${runId} Appel`,
      type: "CALL",
      startsAt: at(day, "10:30"),
      endsAt: at(day, "10:45"),
      reminderMinutes: null,
    } as const;
    const conflict = await post({
      operation: "save",
      requestId: conflictId,
      entry: overlapping,
    });
    assert.equal(conflict.status(), 409, await conflict.text());
    assert.equal((await conflict.json()).code, "overlap");
    const call = await save(overlapping, {
      requestId: conflictId,
      acceptConflict: true,
    });
    const plan = await get("appointment", created.id);
    const moved = await save(
      {
        ...baseMeeting,
        id: created.id,
        startsAt: at(next, "11:00"),
        endsAt: at(next, "12:00"),
      },
      { expectedUpdatedAt: plan.updatedAt },
    );
    assert.equal(moved.id, created.id);
    const stale = await change(plan, "cancel", { confirm: true });
    assert.equal(stale.status(), 409);
    assert.equal((await get("appointment", created.id)).reminderMinutes, 60);
    const cancelled = await change(
      await get("appointment", created.id),
      "cancel",
      { confirm: true, reason: "Recette" },
    );
    assert.equal(cancelled.status(), 200, await cancelled.text());
    assert.equal((await get("appointment", created.id)).reminderMinutes, null);
    record(
      "Agenda · Événements",
      "idempotence, détection du chevauchement, report du même objet, version 409 et annulation du rappel",
    );

    const property = await request.post(`${baseUrl}/api/admin/properties`, {
      data: {
        title: `${runId} Bien agenda`,
        type: "house",
        status: "available",
        publicationStatus: "DRAFT",
        city: "Toulon",
        postalCode: "83000",
        price: "320000",
        surface: "110",
        descriptionShort: runId,
      },
    });
    assert.equal(property.status(), 200, await property.text());
    propertyId = (await property.json()).property.id;
    const visitInput = {
      source: "appointment",
      type: "VISIT",
      assigneeId: adminId,
      contactId: buyerId,
      propertyId,
      startsAt: at(day, "14:00"),
      endsAt: at(day, "15:00"),
      notes: runId,
      details: { nextDayFollowup: true },
    } as const;
    const visit = await save(visitInput);
    const visitGet = await request.get(
      `${baseUrl}/api/admin/commercial/visites?id=${visit.id}`,
    );
    assert.equal(visitGet.status(), 200, await visitGet.text());
    assert.equal((await visitGet.json()).detail.id, visit.id);
    const followUp = await supabase
      .from("tasks")
      .select("id,due_at")
      .eq("appointment_id", visit.id)
      .single();
    assert.ifError(followUp.error);
    ids.tasks.add(followUp.data.id);
    assert.equal(
      Date.parse(followUp.data.due_at!),
      Date.parse(at(next, "09:00")),
    );
    const visitRow = await get("appointment", visit.id);
    const visitMove = await save(
      {
        ...visitInput,
        id: visit.id,
        startsAt: at(next, "14:00"),
        endsAt: at(next, "15:00"),
      },
      { expectedUpdatedAt: visitRow.updatedAt },
    );
    assert.equal(visitMove.id, visit.id);
    const dueUpdated = await supabase
      .from("tasks")
      .select("id,due_at")
      .eq("appointment_id", visit.id)
      .single();
    assert.ifError(dueUpdated.error);
    assert.equal(dueUpdated.data.id, followUp.data.id);
    assert.equal(
      Date.parse(dueUpdated.data.due_at!),
      Date.parse(at(shiftAgendaDay(next, 1), "09:00")),
    );
    const visitCancel = await change(
      await get("appointment", visit.id),
      "cancel",
      { confirm: true },
    );
    assert.equal(visitCancel.status(), 200, await visitCancel.text());
    const visitState = await supabase
      .from("appointments")
      .select("visit_status")
      .eq("id", visit.id)
      .single();
    assert.ifError(visitState.error);
    assert.equal(visitState.data.visit_status, "CANCELLED");
    const followState = await supabase
      .from("tasks")
      .select("status")
      .eq("id", followUp.data.id)
      .single();
    assert.ifError(followState.error);
    assert.equal(followState.data.status, "CANCELLED");
    record(
      "Agenda · Visite partagée",
      "même visite dans Commercial, tâche du lendemain reprogrammée sans doublon, annulation propagée",
    );

    const estimation = await supabase
      .from("estimations")
      .insert({
        contact_id: ownerId,
        assigned_to: adminId,
        name: `${runId} Propriétaire`,
        email: `${runId.toLowerCase()}-estimation@example.test`,
        phone: "+33600000000",
        property_type: "Maison",
        city: "Toulon",
        postal_code: "83000",
        surface: 110,
        property_address: "Rue de recette",
        message: runId,
      })
      .select("id,updated_at")
      .single();
    assert.ifError(estimation.error);
    ids.estimations.add(estimation.data.id);
    const scheduled = await save(
      {
        id: estimation.data.id,
        source: "estimation",
        type: "ESTIMATION",
        assigneeId: adminId,
        startsAt: at(day, "15:00"),
        endsAt: at(day, "16:00"),
        location: "Lieu existant",
        details: { checklist: ["Plans et diagnostics"] },
      },
      { expectedUpdatedAt: estimation.data.updated_at },
    );
    const commercial = await request.get(
      `${baseUrl}/api/admin/commercial/estimations?id=${scheduled.id}`,
    );
    assert.equal(commercial.status(), 200, await commercial.text());
    assert.equal(
      Date.parse((await commercial.json()).detail.appointmentAt),
      Date.parse(at(day, "15:00")),
    );
    assert.equal(
      (await get("estimation", scheduled.id)).details.checklist?.[0],
      "Plans et diagnostics",
    );
    record(
      "Agenda · Estimation",
      "planification du dossier existant et date identique dans Commercial",
    );

    const follow = await save({
      source: "appointment",
      type: "FOLLOW_UP",
      title: `${runId} Relance`,
      assigneeId: adminId,
      contactId: buyerId,
      startsAt: at(day, "16:00"),
      endsAt: at(day, "16:15"),
      details: {
        channel: "email",
        message: "Message de recette jamais envoyé",
      },
    });
    ids.appointments.add(follow.id);
    const signature = await save({
      source: "appointment",
      type: "SIGNATURE",
      title: `${runId} Signature`,
      assigneeId: adminId,
      contactId: buyerId,
      propertyId,
      startsAt: at(day, "17:00"),
      endsAt: at(day, "17:30"),
      details: {
        sellerId: ownerId,
        act: "Compromis",
        checklist: ["Identités"],
      },
    });
    ids.appointments.add(signature.id);
    assert.equal(
      (await get("appointment", signature.id)).details.sellerId,
      ownerId,
    );

    const taskTitle = `${runId} Préparer le dossier`;
    await page.goto(`${baseUrl}/admin?tab=agenda&date=${day}`);
    const workspace = page.getByRole("region", { name: "Agenda et tâches" });
    await expect(
      workspace.getByRole("heading", { name: "Agenda & Tâches", exact: true }),
    ).toBeVisible();
    await expect(
      workspace.getByRole("button", { name: new RegExp(`${runId} Appel`) }),
    ).toBeVisible({ timeout: 15000 });
    const views = workspace.getByRole("navigation", {
      name: "Vues de l’agenda",
    });
    for (const name of ["Semaine", "Mois", "Jour"]) {
      await views.getByRole("button", { name, exact: true }).click();
      await expect(
        views.getByRole("button", { name, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      assert(new URL(page.url()).searchParams.get("date") === day);
    }
    await workspace
      .getByRole("button", { name: "Nouvelle tâche", exact: true })
      .click();
    const form = page.getByRole("dialog", {
      name: "Nouvelle tâche",
      exact: true,
    });
    await form.getByLabel("Intitulé *", { exact: true }).fill(taskTitle);
    await form.getByLabel("Échéance", { exact: true }).fill(`${day}T18:00`);
    await form
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    const drawer = page.getByRole("dialog", { name: taskTitle, exact: true });
    await expect(drawer).toBeVisible({ timeout: 15000 });
    const taskRow = await supabase
      .from("tasks")
      .select("id")
      .eq("title", taskTitle)
      .single();
    assert.ifError(taskRow.error);
    ids.tasks.add(taskRow.data.id);
    await drawer.getByRole("button", { name: "Fermer", exact: true }).click();
    await views.getByRole("button", { name: /^Tâches/ }).click();
    await expect(
      workspace.getByRole("heading", { name: /^Registre des tâches/ }),
    ).toBeVisible();
    const toggle = workspace.getByRole("checkbox", {
      name: `Terminer la tâche ${taskTitle}`,
    });
    await toggle.click();
    await expect(
      workspace.getByRole("checkbox", {
        name: `Rouvrir la tâche ${taskTitle}`,
      }),
    ).toBeChecked({ timeout: 15000 });
    await workspace.getByRole("button", { name: /^Filtrer/ }).click();
    const filters = page.getByRole("dialog", { name: "Filtrer les tâches" });
    await expect(filters).toBeVisible();
    await filters.getByLabel("État", { exact: true }).selectOption("completed");
    await filters
      .getByRole("button", { name: "Appliquer", exact: true })
      .click();
    await expect(
      workspace.getByRole("button", { name: taskTitle, exact: true }),
    ).toBeVisible();
    const wrong = await readOnlyContext.request.get(
      `${endpoint}?date=${day}&assignee=${adminId}`,
    );
    assert.equal(wrong.status(), 403);
    assert.equal(
      (
        await readOnlyContext.request.get(
          `${endpoint}?source=appointment&entry=${call.id}`,
        )
      ).status(),
      404,
    );
    assert.equal(
      (
        await readOnlyContext.request.post(endpoint, {
          data: { operation: "complete" },
        })
      ).status(),
      403,
    );
    const closedTask = await get("task", taskRow.data.id);
    assert.equal((await change(closedTask, "delete")).status(), 403);
    const deletion = await change(closedTask, "delete", { confirm: true });
    assert.equal(deletion.status(), 200, await deletion.text());
    record(
      "Agenda · Registre et droits",
      "création navigateur, tâche terminée, filtre, lecture refusée hors périmètre et suppression avec confirmation",
    );

    const folder = "work/agenda-qa";
    await mkdir(folder, { recursive: true });
    await views.getByRole("button", { name: "Mois", exact: true }).click();
    await expect(workspace.getByLabel("Calendrier mensuel")).toBeVisible();
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Débordement à ${width}px`,
      );
    }
    await page.screenshot({
      path: `${folder}/agenda-mois.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    const listing = await request.get(`${endpoint}?date=${day}&view=month`);
    assert.equal(listing.status(), 200, await listing.text());
    const loaded = (await listing.json()) as AgendaData;
    assert(loaded.events.some((item) => item.id === scheduled.id));
    assert(
      loaded.events.some(
        (item) => item.id === visit.id && item.status === "cancelled",
      ),
    );
    record(
      "Agenda · Vues et formulaires",
      "jour, semaine, mois, registre, six types d’événement et tâche dans Supabase, sept largeurs et console sans erreur",
    );
  } finally {
    await page.close();
    for (const id of [
      ...ids.appointments,
      ...ids.tasks,
      ...ids.estimations,
      ...(propertyId ? [propertyId] : []),
    ])
      assert.match(id, /^[a-f0-9-]{36}$/i);
    if (ids.tasks.size)
      runSql(
        `delete from public.tasks where id in (${[...ids.tasks].map((id) => `'${id}'`).join(",")});`,
      );
    if (ids.appointments.size)
      runSql(
        `delete from public.tasks where appointment_id in (${[...ids.appointments].map((id) => `'${id}'`).join(",")}); delete from public.appointments where id in (${[...ids.appointments].map((id) => `'${id}'`).join(",")});`,
      );
    if (ids.estimations.size)
      runSql(
        `delete from public.estimations where id in (${[...ids.estimations].map((id) => `'${id}'`).join(",")});`,
      );
    if (propertyId)
      runSql(
        `delete from public.properties where id='${propertyId}' and created_by='${adminId}';`,
      );
    runSql(
      `delete from public.agenda_requests where actor_id in ('${adminId}','${readerId}');`,
    );
    record(
      "Agenda · Nettoyage",
      "activités, données de recette et opérations idempotentes retirées de l’environnement isolé",
    );
  }
}

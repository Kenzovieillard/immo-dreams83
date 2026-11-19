import assert from "node:assert/strict";
import test from "node:test";
import {
  agendaEntryInput,
  agendaMutationSchema,
  type AgendaEntry,
} from "../src/lib/agenda";
import {
  agendaDayItems,
  agendaRange,
  agendaReminderAt,
  parisDay,
  parisInstant,
  shiftAgendaMonth,
  taskGroup,
  validAgendaDay,
} from "../src/lib/agenda-time";

const owner = "00000000-0000-4000-8000-000000000001";
const fixture: AgendaEntry = {
  id: owner,
  source: "task",
  type: "TASK",
  title: "Relancer le propriétaire",
  status: "todo",
  assigneeId: owner,
  assignee: "Conseiller",
  contactId: null,
  contact: null,
  propertyId: null,
  appointmentId: null,
  startsAt: null,
  endsAt: null,
  dueAt: "2026-11-19T15:00:00.000Z",
  location: "",
  notes: "",
  priority: "normal",
  taskType: "FOLLOW_UP",
  reminderMinutes: 60,
  updatedAt: "2026-11-19T09:00:00.000Z",
  completedAt: null,
  details: {},
};

test("interprète les dates à Paris, y compris les deux changements d’heure", () => {
  assert.equal(parisDay("2026-11-18T23:10:00Z"), "2026-11-19");
  assert.equal(parisInstant("2026-03-29T02:30"), null);
  assert.equal(
    parisInstant("2026-10-25T02:30", "2026-10-25T01:30:00.000Z"),
    "2026-10-25T01:30:00.000Z",
  );
  assert.equal(parisInstant("2026-10-25T02:30"), "2026-10-25T00:30:00.000Z");
  assert.equal(parisInstant("2026-07-20T09:00"), "2026-07-20T07:00:00.000Z");
  assert.equal(parisInstant("2026-11-20T09:00"), "2026-11-20T08:00:00.000Z");
  assert.equal(validAgendaDay("2026-02-30"), false);
  assert.equal(shiftAgendaMonth("2026-01-31", 1), "2026-02-28");
});

test("la semaine commence le lundi et la durée de la journée de bascule est correcte", () => {
  assert.equal(agendaRange("2026-11-19", "week").first, "2026-11-16");
  const day = agendaRange("2026-03-29", "day");
  assert.equal((Date.parse(day.to) - Date.parse(day.from)) / 3600000, 23);
  assert.equal(agendaRange("2026-11-19", "month").length, 42);
});

test("un rendez-vous multijour appartient aux deux jours touchés", () => {
  const event: AgendaEntry = {
    ...fixture,
    source: "appointment",
    type: "MEETING",
    startsAt: "2026-11-18T22:30:00Z",
    endsAt: "2026-11-19T00:30:00Z",
  };
  assert.equal(agendaDayItems([event], "2026-11-18").length, 1);
  assert.equal(agendaDayItems([event], "2026-11-19").length, 1);
  assert.equal(agendaDayItems([event], "2026-11-20").length, 0);
});

test("les groupes et rappels reflètent l’état canonique de la tâche", () => {
  const now = new Date("2026-11-19T15:10:00Z");
  assert.equal(agendaReminderAt(fixture), "2026-11-19T14:00:00.000Z");
  assert.equal(taskGroup(fixture, now), "overdue");
  assert.equal(taskGroup({ ...fixture, dueAt: null }, now), "unscheduled");
  assert.equal(taskGroup({ ...fixture, status: "completed" }, now), "closed");
  assert.equal(agendaReminderAt({ ...fixture, status: "cancelled" }), null);
});

test("valide les relations obligatoires et les dates des six types", () => {
  const visit = {
    assigneeId: owner,
    startsAt: "2026-11-19T09:00:00.000Z",
    endsAt: "2026-11-19T09:30:00.000Z",
    source: "appointment" as const,
    type: "VISIT" as const,
  };
  assert(!agendaEntryInput.safeParse(visit).success);
  assert(
    agendaEntryInput.safeParse({
      ...visit,
      contactId: owner,
      propertyId: owner,
    }).success,
  );
  assert(
    !agendaEntryInput.safeParse({
      ...visit,
      contactId: owner,
      propertyId: owner,
      endsAt: visit.startsAt,
    }).success,
  );
  assert(
    !agendaEntryInput.safeParse({
      source: "task",
      type: "TASK",
      assigneeId: owner,
      title: "Tâche",
      reminderMinutes: 10,
    }).success,
  );
  assert(
    !agendaEntryInput.safeParse({
      ...visit,
      source: "estimation",
      type: "ESTIMATION",
    }).success,
  );
  assert(
    !agendaMutationSchema.safeParse({
      operation: "delete",
      source: "appointment",
      id: owner,
      requestId: owner,
    }).success,
  );
});

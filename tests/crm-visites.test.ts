import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  visitCreateSchema,
  visitReportSchema,
  visitRescheduleSchema,
  visitStatusSchema,
} from "../src/lib/commercial-validation";

const propertyId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const agentId = "33333333-3333-4333-8333-333333333333";
const visitId = "44444444-4444-4444-8444-444444444444";

const validCreate = {
  action: "create" as const,
  propertyId,
  contactId,
  assignedTo: agentId,
  startsAt: "2026-08-20T08:00:00.000Z",
  endsAt: "2026-08-20T09:00:00.000Z",
  location: "Adresse du bien",
  notes: "Contact confirmé.",
};

const validReport = {
  action: "submit-report" as const,
  id: visitId,
  generalImpression: "POSITIVE" as const,
  positivePoints: ["Luminosité"],
  blockingPoints: [],
  interestLevel: 4,
  comments: "Le contact souhaite avancer rapidement.",
  nextAction: "CREATE_OFFER" as const,
};

test("valide la planification avec relations et horaires réels", () => {
  assert.equal(visitCreateSchema.safeParse(validCreate).success, true);
});

test("refuse un bien qui n'est pas un UUID", () => {
  assert.equal(
    visitCreateSchema.safeParse({ ...validCreate, propertyId: "demo-property" })
      .success,
    false,
  );
});

test("refuse une fin antérieure au début", () => {
  assert.equal(
    visitCreateSchema.safeParse({
      ...validCreate,
      endsAt: "2026-08-20T07:00:00.000Z",
    }).success,
    false,
  );
});

test("valide la confirmation persistante", () => {
  assert.equal(
    visitStatusSchema.safeParse({
      action: "set-status",
      id: visitId,
      status: "CONFIRMED",
    }).success,
    true,
  );
});

test("valide une replanification cohérente", () => {
  assert.equal(
    visitRescheduleSchema.safeParse({
      action: "reschedule",
      id: visitId,
      startsAt: "2026-08-21T13:00:00.000Z",
      endsAt: "2026-08-21T14:30:00.000Z",
    }).success,
    true,
  );
});

test("valide un compte rendu complet", () => {
  assert.equal(visitReportSchema.safeParse(validReport).success, true);
});

test("refuse un niveau d'intérêt hors bornes", () => {
  assert.equal(
    visitReportSchema.safeParse({ ...validReport, interestLevel: 6 }).success,
    false,
  );
});

test("exige une échéance pour relancer plus tard", () => {
  assert.equal(
    visitReportSchema.safeParse({
      ...validReport,
      nextAction: "FOLLOW_UP_LATER",
    }).success,
    false,
  );
  assert.equal(
    visitReportSchema.safeParse({
      ...validReport,
      nextAction: "FOLLOW_UP_LATER",
      followUpAt: "2026-08-24T08:00:00.000Z",
    }).success,
    true,
  );
});

test("la RPC de compte rendu crée une vraie tâche de relance", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608140001_commercial_remaining.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /function public\.submit_commercial_visit_report/);
  assert.match(migration, /p_next_action = 'FOLLOW_UP_LATER'/);
  assert.match(migration, /insert into public\.tasks/);
});

test("la route dédiée est protégée et utilise les RPC métier", () => {
  const api = readFileSync(
    new URL(
      "../src/app/api/admin/commercial/visites/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(api, /requireAdminSession/);
  assert.match(api, /create_commercial_visit/);
  assert.match(api, /submit_commercial_visit_report/);
  assert.match(api, /assertVisitAccess/);
  assert.match(api, /assertEligibleCommercialAssignee/);
});

test("les pages liste et calendrier chargent les visites Supabase", () => {
  const listPage = readFileSync(
    new URL("../src/app/commercial/visites/page.tsx", import.meta.url),
    "utf8",
  );
  const calendarPage = readFileSync(
    new URL(
      "../src/app/commercial/visites/calendrier/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(listPage, /loadCommercialVisits/);
  assert.match(calendarPage, /loadCommercialVisits/);
  assert.doesNotMatch(`${listPage}\n${calendarPage}`, /visitFixtures|demo-/);
});

test("le compte rendu transmet les identifiants canoniques aux parcours suivants", () => {
  const source = readFileSync(
    new URL(
      "../src/components/commercial/visits-connected.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /bien_id/);
  assert.match(source, /contact_id/);
  assert.match(source, /visite_id/);
  assert.match(source, /PLAN_SECOND_VISIT/);
  const panels = readFileSync(
    new URL(
      "../src/components/commercial/commercial-detail-panels.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source + panels, /tab=properties&property=/);
  assert.doesNotMatch(source, /href=\{`\/biens\//);
});

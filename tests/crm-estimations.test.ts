import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  estimationCreateSchema,
  estimationGenerateReportSchema,
  estimationTransformSchema,
  estimationUpdateSchema,
} from "../src/lib/commercial-validation";
import {
  commercialApiErrorMessage,
  isCommercialConflictError,
} from "../src/lib/commercial-api-error";

const contactId = "11111111-1111-4111-8111-111111111111";
const agentId = "22222222-2222-4222-8222-222222222222";
const estimationId = "33333333-3333-4333-8333-333333333333";

const validCreate = {
  action: "create" as const,
  contactId,
  assignedTo: agentId,
  propertyAddress: "12 avenue de la Mer",
  city: "Saint-Raphaël",
  postalCode: "83700",
  propertyType: "Appartement",
  surface: 72,
  rooms: 3,
  constructionYear: 1998,
  propertyCondition: "Bon état",
  appointmentAt: "2026-08-18T13:45:00.000Z",
  durationMinutes: 75,
  appointmentLocation: "Sur place",
  notes: "Accès confirmé par le propriétaire.",
};

test("accepte une estimation complète fondée sur des UUID réels", () => {
  assert.equal(estimationCreateSchema.safeParse(validCreate).success, true);
});

test("conserve exactement l'heure choisie", () => {
  const parsed = estimationCreateSchema.parse(validCreate);
  assert.equal(parsed.appointmentAt, "2026-08-18T13:45:00.000Z");
});

test("refuse un identifiant de démonstration", () => {
  assert.equal(
    estimationCreateSchema.safeParse({
      ...validCreate,
      contactId: "demo-contact",
    }).success,
    false,
  );
});

test("refuse un code postal non conforme", () => {
  assert.equal(
    estimationCreateSchema.safeParse({ ...validCreate, postalCode: "83" })
      .success,
    false,
  );
});

test("refuse une durée de rendez-vous hors limites", () => {
  assert.equal(
    estimationCreateSchema.safeParse({ ...validCreate, durationMinutes: 5 })
      .success,
    false,
  );
});

test("autorise une modification partielle persistable", () => {
  assert.equal(
    estimationUpdateSchema.safeParse({
      action: "update",
      id: estimationId,
      commercialStatus: "COMPLETED",
      estimateLow: 480000,
      estimateHigh: 520000,
    }).success,
    true,
  );
});

test("valide une transformation métier et refuse un prix nul", () => {
  assert.equal(
    estimationTransformSchema.safeParse({
      action: "transform",
      id: estimationId,
      listingPrice: 510000,
      mandateType: "exclusive",
    }).success,
    true,
  );
  assert.equal(
    estimationTransformSchema.safeParse({
      action: "transform",
      id: estimationId,
      listingPrice: 0,
      mandateType: "exclusive",
    }).success,
    false,
  );
});

test("reconnaît un conflit PostgREST de transformation concurrente", () => {
  const message = commercialApiErrorMessage({
    code: "P0001",
    message: "COMMERCIAL_ESTIMATION_ALREADY_TRANSFORMED",
  });
  assert.equal(message, "COMMERCIAL_ESTIMATION_ALREADY_TRANSFORMED");
  assert.equal(isCommercialConflictError(message), true);
});

test("valide la génération de rapport uniquement pour un UUID", () => {
  assert.equal(
    estimationGenerateReportSchema.safeParse({
      action: "generate-report",
      id: estimationId,
    }).success,
    true,
  );
  assert.equal(
    estimationGenerateReportSchema.safeParse({
      action: "generate-report",
      id: "demo",
    }).success,
    false,
  );
});

test("la route dédiée est protégée et charge le service réel", () => {
  const api = readFileSync(
    new URL(
      "../src/app/api/admin/commercial/estimations/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(api, /requireAdminSession/);
  assert.match(api, /loadCommercialEstimations/);
  assert.match(api, /transform_commercial_estimation/);
});

test("les pages de production n'importent aucune fixture", () => {
  const listPage = readFileSync(
    new URL("../src/app/commercial/estimations/page.tsx", import.meta.url),
    "utf8",
  );
  const detailPage = readFileSync(
    new URL("../src/app/commercial/estimations/[id]/page.tsx", import.meta.url),
    "utf8",
  );
  const screen = readFileSync(
    new URL(
      "../src/components/commercial/estimations-connected.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(listPage, /loadCommercialEstimations/);
  assert.match(detailPage, /loadCommercialEstimations/);
  assert.doesNotMatch(`${listPage}\n${detailPage}`, /estimationFixtures|demo-/);
  assert.match(screen, /tab=contacts&contact=/);
  assert.match(
    screen,
    /router\.push\(`\/admin\?tab=properties&property=\$\{propertyId\}`\)/,
  );
  assert.doesNotMatch(screen, /href=\{`\/biens\//);
});

test("le PDF est produit depuis les champs réels et stocké en privé", () => {
  const pdf = readFileSync(
    new URL("../src/lib/commercial-pdf.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608140001_commercial_remaining.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(pdf, /PDFDocument/);
  assert.match(pdf, /estimation\.address/);
  assert.match(migration, /'estimation-reports', 'estimation-reports', false/);
});

test("la transformation estimation vers bien est atomique et rollbackable", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608140001_commercial_remaining.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const rollback = readFileSync(
    new URL(
      "../supabase/rollbacks/202608140001_commercial_remaining.rollback.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /function public\.transform_commercial_estimation/);
  assert.match(migration, /for update/);
  assert.match(migration, /insert into public\.properties/);
  assert.match(migration, /insert into public\.leads/);
  assert.match(migration, /insert into public\.mandates/);
  assert.match(migration, /insert into public\.activities/);
  assert.match(
    rollback,
    /drop function if exists public\.transform_commercial_estimation/,
  );
});

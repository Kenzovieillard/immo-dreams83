import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  pipelineCaseCreateSchema,
  pipelineMoveSchema,
  pipelineTaskCreateSchema,
  pipelineTaskUpdateSchema,
} from "../src/lib/commercial-validation";
import {
  canTransitionCommercialOfferStatus,
  filterAssignableProfiles,
  getPipelineColumnId,
  getPropertyOfferIneligibility,
  isCommercialOfferExpired,
  isPotentialDuplicateReminder,
  matchesPipelineDossierSearch,
  uniquePipelineRecordsById,
} from "../src/lib/crm-pipeline-rules";

test("conserve uniquement les profils actifs autorises et uniques", () => {
  const profiles = filterAssignableProfiles([
    { id: "antoine", role: "ADMIN", is_active: true },
    { id: "michel", role: "AGENT", is_active: true },
    { id: "michel", role: "AGENT", is_active: true },
    { id: "inactive", role: "AGENT", is_active: false },
    { id: "marketing", role: "MARKETING", is_active: true },
  ]);

  assert.deepEqual(
    profiles.map((profile) => profile.id),
    ["antoine", "michel"],
  );
});

test("recherche un dossier sans tenir compte de la casse ni des accents", () => {
  const dossier = {
    dossierReference: "DOS-2026-0042",
    contactName: "Élodie Martin",
    contactEmail: "elodie@example.fr",
    contactPhone: "06 12 34 56 78",
    requestType: "Achat appartement",
    city: "Saint-Raphaël",
    linkedPropertyTitle: "Réf. 123 - T2 Centre Mourillon",
    assignedToName: "Michel Faridonie",
    status: "CONTACTED",
  };

  assert.equal(matchesPipelineDossierSearch(dossier, "elodie"), true);
  assert.equal(matchesPipelineDossierSearch(dossier, "saint-raphael"), true);
  assert.equal(matchesPipelineDossierSearch(dossier, "123"), true);
  assert.equal(matchesPipelineDossierSearch(dossier, "michel"), true);
});

test("detecte un rappel similaire dans une fenetre de trente minutes", () => {
  const requested = {
    leadId: "dossier-1",
    assignedTo: "michel",
    title: "Relancer l'acquéreur",
    dueAt: "2026-08-04T10:00:00.000Z",
  };

  assert.equal(
    isPotentialDuplicateReminder(
      {
        ...requested,
        title: "RELANCER L'ACQUEREUR",
        dueAt: "2026-08-04T10:20:00.000Z",
      },
      requested,
    ),
    true,
  );
  assert.equal(
    isPotentialDuplicateReminder(
      { ...requested, dueAt: "2026-08-04T11:00:00.000Z" },
      requested,
    ),
    false,
  );
  assert.equal(
    isPotentialDuplicateReminder(
      { ...requested, completedAt: "2026-08-04T09:00:00.000Z" },
      requested,
    ),
    false,
  );
});

test("refuse les biens vendus, archives ou retires de la vente", () => {
  assert.equal(
    getPropertyOfferIneligibility({ commercialStatus: "AVAILABLE" }),
    null,
  );
  assert.equal(
    getPropertyOfferIneligibility({ commercialStatus: "SOLD" }),
    "NOT_FOR_SALE",
  );
  assert.equal(
    getPropertyOfferIneligibility({ commercialStatus: "WITHDRAWN" }),
    "NOT_FOR_SALE",
  );
  assert.equal(
    getPropertyOfferIneligibility({ publicationStatus: "ARCHIVED" }),
    "ARCHIVED",
  );
});

test("applique le cycle de vie lineaire et l'expiration des offres", () => {
  assert.equal(
    canTransitionCommercialOfferStatus("DRAFT", "TO_BE_SIGNED"),
    true,
  );
  assert.equal(canTransitionCommercialOfferStatus("DRAFT", "ACCEPTED"), false);
  assert.equal(canTransitionCommercialOfferStatus("EXPIRED", "DRAFT"), true);
  assert.equal(
    isCommercialOfferExpired(
      "2026-08-03",
      new Date("2026-08-04T12:00:00.000Z"),
    ),
    true,
  );
  assert.equal(
    isCommercialOfferExpired(
      "2026-08-05",
      new Date("2026-08-04T12:00:00.000Z"),
    ),
    false,
  );
});

test("classe chaque dossier une seule fois selon ses objets actifs", () => {
  const unique = uniquePipelineRecordsById([
    { id: "dossier-1" },
    { id: "dossier-1" },
    { id: "dossier-2" },
  ]);
  assert.equal(unique.length, 2);
  assert.equal(
    getPipelineColumnId({
      status: "CONTACTED",
      hasActiveAppointment: true,
      hasActiveOffer: true,
    }),
    "offers",
  );
  assert.equal(
    getPipelineColumnId({
      status: "CONTACTED",
      hasActiveAppointment: true,
      hasActiveOffer: false,
    }),
    "appointment",
  );
});

const contactId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";
const agentId = "33333333-3333-4333-8333-333333333333";

test("valide un déplacement persistant avec un UUID réel", () => {
  assert.equal(
    pipelineMoveSchema.safeParse({
      action: "move-stage",
      id: leadId,
      stage: "BUYER_VISIT",
    }).success,
    true,
  );
  assert.equal(
    pipelineMoveSchema.safeParse({
      action: "move-stage",
      id: "demo-dossier",
      stage: "BUYER_VISIT",
    }).success,
    false,
  );
});

test("valide la création typée d'un dossier commercial", () => {
  assert.equal(
    pipelineCaseCreateSchema.safeParse({
      action: "create-case",
      contactId,
      pipelineType: "BUYER",
      assignedTo: agentId,
      priority: "high",
      title: "Projet résidence principale",
    }).success,
    true,
  );
});

test("valide la création et la réouverture d'une tâche persistante", () => {
  assert.equal(
    pipelineTaskCreateSchema.safeParse({
      action: "create-task",
      leadId,
      title: "Rappeler le contact",
      dueAt: "2026-08-15T08:30:00.000Z",
      priority: "urgent",
    }).success,
    true,
  );
  assert.equal(
    pipelineTaskUpdateSchema.safeParse({
      action: "update-task",
      id: contactId,
      status: "TODO",
    }).success,
    true,
  );
});

test("la route de production utilise le service réel et la RPC atomique", () => {
  const page = readFileSync(
    new URL("../src/app/commercial/pipeline/page.tsx", import.meta.url),
    "utf8",
  );
  const api = readFileSync(
    new URL(
      "../src/app/api/admin/commercial/pipeline/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const screen = readFileSync(
    new URL(
      "../src/components/commercial/pipeline-connected.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /loadCommercialPipeline/);
  assert.doesNotMatch(page, /pipelineFixtures|demo-/);
  assert.match(api, /move_commercial_pipeline/);
  assert.match(api, /requireAdminSession/);
  assert.match(screen, /filters\.agent/);
  assert.match(screen, /filters\.period/);
  assert.match(screen, /query\.error/);
  assert.match(screen, /previous/);
  assert.match(screen, /tab=contacts&contact=/);
  assert.match(screen, /tab=properties&property=/);
  assert.doesNotMatch(screen, /href=\{`\/biens\//);
  assert.match(screen, /\/commercial\/offres\//);
});

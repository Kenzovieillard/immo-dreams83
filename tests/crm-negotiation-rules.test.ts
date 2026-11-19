import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateNegotiationGap,
  calculateNegotiationKpis,
  isNegotiationTerminal,
  negotiationReminderRecipient,
  requiresNegotiationAction,
} from "../src/lib/crm-negotiation-rules";

test("calcule l'écart avec deux décimales", () => {
  assert.equal(calculateNegotiationGap(900000, 865000), -3.89);
  assert.equal(calculateNegotiationGap(0, 865000), null);
});

test("identifie les statuts terminaux", () => {
  assert.equal(isNegotiationTerminal("CONCLUDED"), true);
  assert.equal(isNegotiationTerminal("WAITING_SELLER"), false);
});

test("demande une action sur urgence ou inactivité sans rouvrir un dossier clos", () => {
  assert.equal(
    requiresNegotiationAction({
      status: "IN_PROGRESS",
      isUrgent: true,
      daysWithoutActivity: 0,
    }),
    true,
  );
  assert.equal(
    requiresNegotiationAction({
      status: "WAITING_BUYER",
      isUrgent: false,
      daysWithoutActivity: 3,
    }),
    true,
  );
  assert.equal(
    requiresNegotiationAction({
      status: "ACCEPTED",
      isUrgent: true,
      daysWithoutActivity: 8,
    }),
    false,
  );
});

test("agrège uniquement le volume et l'écart des négociations actives", () => {
  const result = calculateNegotiationKpis(
    [
      {
        status: "WAITING_SELLER",
        currentAmount: 865000,
        currentGapPercent: -3.9,
        isUrgent: true,
        daysWithoutActivity: 0,
        concludedAt: null,
      },
      {
        status: "WAITING_BUYER",
        currentAmount: 520000,
        currentGapPercent: -5.5,
        isUrgent: false,
        daysWithoutActivity: 3,
        concludedAt: null,
      },
      {
        status: "ACCEPTED",
        currentAmount: 180000,
        currentGapPercent: -2.7,
        isUrgent: false,
        daysWithoutActivity: 0,
        concludedAt: "2026-08-04T12:00:00.000Z",
      },
    ],
    new Date("2026-08-13T10:00:00.000Z"),
  );

  assert.deepEqual(result, {
    active: 2,
    awaitingResponse: 2,
    actionRequired: 2,
    acceptedThisMonth: 1,
    averageGap: -4.7,
    totalVolume: 1385000,
  });
});

test("ne considère pas un statut terminal comme action requise", () => {
  for (const status of [
    "ACCEPTED",
    "REJECTED",
    "EXPIRED",
    "CONCLUDED",
  ] as const) {
    assert.equal(
      requiresNegotiationAction({
        status,
        isUrgent: true,
        daysWithoutActivity: 30,
      }),
      false,
    );
  }
});

test("retourne une moyenne nulle sans négociation active", () => {
  const result = calculateNegotiationKpis(
    [],
    new Date("2026-08-13T10:00:00.000Z"),
  );
  assert.equal(result.averageGap, null);
  assert.equal(result.totalVolume, 0);
});

test("adresse la relance à la partie réellement attendue", () => {
  assert.equal(negotiationReminderRecipient("WAITING_BUYER", true), "BUYER");
  assert.equal(negotiationReminderRecipient("WAITING_SELLER", true), "SELLER");
  assert.equal(negotiationReminderRecipient("WAITING_SELLER", false), null);
  assert.equal(negotiationReminderRecipient("IN_PROGRESS", true), null);
});

test("sépare explicitement note interne et relance client", () => {
  const source = readFileSync(
    new URL(
      "../src/components/commercial/negotiations-screens.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const api = readFileSync(
    new URL(
      "../src/app/api/admin/commercial/negotiations/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const documents = readFileSync(
    new URL(
      "../src/app/api/admin/commercial/negotiations/documents/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const realtime = readFileSync(
    new URL(
      "../src/app/api/admin/commercial/negotiations/realtime/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /Note interne/);
  assert.match(source, /Relance client/);
  assert.match(api, /client-reminder/);
  assert.match(api, /COMMUNICATION_PROVIDER_NOT_CONFIGURED/);
  assert.match(documents, /createSignedUrl/);
  assert.match(documents, /requireAdminSession/);
  assert.match(documents, /assertNegotiationAccess/);
  assert.match(realtime, /commercialRealtimeStream/);
  const stream = readFileSync(new URL("../src/lib/commercial-realtime-stream.ts", import.meta.url), "utf8");
  assert.match(stream, /text\/event-stream/);
  assert.match(stream, /requireAdminSession\("crm.read"\)/);
  assert.match(stream, /payload.extension !== "postgres_changes"/);
});

test("la nouvelle offre issue d'une négociation transmet les paramètres canoniques", () => {
  const source = readFileSync(
    new URL(
      "../src/components/commercial/negotiations-screens.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /bien_id=/);
  assert.match(source, /contact_id=/);
  assert.match(source, /tab=properties&property=/);
  assert.doesNotMatch(source, /href=\{`\/biens\//);
  assert.doesNotMatch(source, /negotiationFixtures/);
});

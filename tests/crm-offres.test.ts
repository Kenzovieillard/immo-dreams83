import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeCommercialPrefill,
  offerCreateSchema,
  offerStatusSchema,
} from "../src/lib/commercial-validation";

const propertyId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const dossierId = "33333333-3333-4333-8333-333333333333";
const agentId = "44444444-4444-4444-8444-444444444444";
const visitId = "55555555-5555-4555-8555-555555555555";
const offerId = "66666666-6666-4666-8666-666666666666";

const validOffer = {
  action: "create" as const,
  submission: "draft" as const,
  propertyId,
  buyerDossierId: dossierId,
  buyerContactId: contactId,
  visitId,
  responsibleUserId: agentId,
  amount: 465000,
  offerDate: "2026-08-13",
  validUntil: "2026-08-20",
  financingType: "LOAN" as const,
  downPaymentAmount: 165000,
  loanAmount: 300000,
  suspensiveConditions: "Obtention du financement.",
};

test("valide la sauvegarde d'un brouillon réel", () => {
  assert.equal(offerCreateSchema.safeParse(validOffer).success, true);
});

test("valide la création d'offre avec le même contrat serveur", () => {
  assert.equal(
    offerCreateSchema.safeParse({ ...validOffer, submission: "create" })
      .success,
    true,
  );
});

test("refuse un identifiant de bien de démonstration", () => {
  assert.equal(
    offerCreateSchema.safeParse({ ...validOffer, propertyId: "demo-property" })
      .success,
    false,
  );
});

test("refuse une date de validité antérieure à l'offre", () => {
  assert.equal(
    offerCreateSchema.safeParse({ ...validOffer, validUntil: "2026-08-12" })
      .success,
    false,
  );
});

test("refuse un montant nul", () => {
  assert.equal(
    offerCreateSchema.safeParse({ ...validOffer, amount: 0 }).success,
    false,
  );
});

test("normalise les paramètres canoniques", () => {
  assert.deepEqual(
    normalizeCommercialPrefill(
      new URLSearchParams({
        bien_id: propertyId,
        contact_id: contactId,
        visite_id: visitId,
      }),
    ),
    { propertyId, contactId, visitId },
  );
});

test("conserve temporairement les paramètres historiques", () => {
  assert.deepEqual(
    normalizeCommercialPrefill(
      new URLSearchParams({ bien: propertyId, acq: contactId }),
    ),
    { propertyId, contactId, visitId: null },
  );
});

test("ignore les paramètres de préremplissage invalides", () => {
  assert.deepEqual(
    normalizeCommercialPrefill(
      new URLSearchParams({ bien_id: "demo", contact_id: "invalide" }),
    ),
    { propertyId: null, contactId: null, visitId: null },
  );
});

test("valide une transition de statut avec UUID réel", () => {
  assert.equal(
    offerStatusSchema.safeParse({
      action: "set-status",
      id: offerId,
      status: "NEGOTIATING",
    }).success,
    true,
  );
});

test("la route GET dédiée est protégée et charge liste ou détail", () => {
  const api = readFileSync(
    new URL("../src/app/api/admin/commercial/offres/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(api, /export async function GET/);
  assert.match(api, /requireAdminSession/);
  assert.match(api, /loadCommercialOffers/);
  assert.match(api, /assertOfferAccess/);
  assert.match(api, /assertLeadAccess/);
  assert.match(api, /params\.get\("id"\)/);
});

test("la RPC distingue réellement brouillon et offre créée", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608140001_commercial_remaining.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /function public\.create_commercial_offer/);
  assert.match(migration, /DRAFT/);
  assert.match(migration, /TO_BE_SIGNED/);
  assert.match(migration, /insert into public\.offer_status_history/);
});

test("les transitions d'offre sont atomiques et protégées côté base", () => {
  const route = readFileSync(
    new URL("../src/app/api/admin/commercial/offres/route.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202609040001_commercial_completion_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(route, /rpc\(\s*["']transition_commercial_offer["']/);
  assert.doesNotMatch(route, /from\(["']offer_status_history["']\)\s*\.insert/);
  assert.match(migration, /for update/i);
  assert.match(migration, /COMMERCIAL_OFFER_EXPIRED/);
  assert.match(migration, /insert into public\.offer_status_history/);
  assert.match(migration, /update public\.negotiations/);
  assert.match(migration, /COMMERCIAL_PROPERTY_NOT_FOR_SALE/);
  assert.match(migration, /role in \('ADMIN', 'DIRECTOR', 'AGENT'\)/);
});

test("les documents sont privés, limités et téléchargeables par URL signée", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608140001_commercial_remaining.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const api = readFileSync(
    new URL("../src/app/api/admin/commercial/offres/route.ts", import.meta.url),
    "utf8",
  );
  const page = readFileSync(
    new URL("../src/app/commercial/offres/page.tsx", import.meta.url),
    "utf8",
  );
  const screen = readFileSync(
    new URL(
      "../src/components/commercial/offers-connected.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /'offer-documents', 'offer-documents', false, 10485760/,
  );
  assert.match(api, /createSignedUrl/);
  assert.match(api, /10 \* 1024 \* 1024/);
  assert.doesNotMatch(page, /offerFixtures|demo-/);
  const panels = readFileSync(
    new URL(
      "../src/components/commercial/commercial-detail-panels.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(screen + panels, /tab=contacts&contact=/);
  assert.match(screen + panels, /tab=properties&property=/);
  assert.doesNotMatch(screen, /href=\{`\/biens\//);
  assert.match(screen + panels, /\/commercial\/pipeline\?dossier=/);
  assert.match(screen + panels, /\/commercial\/visites\//);
  assert.match(screen, /\/commercial\/negociations\//);
  assert.match(screen, /defaultValue=\{data\.prefill\.propertyId \?\? ""\}/);
  assert.match(screen, /defaultValue=\{data\.prefill\.visitId \?\? ""\}/);
});

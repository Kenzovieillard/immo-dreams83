import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { cleanupContactRecipe } from "./cleanup-contact-recipe";
import { checkContactPaginationUi } from "./check-contact-pagination-ui";
import type { Database } from "../src/types/supabase";

// Explicit opt-in, verified project identity, no .env loading and no production fallback.
const ref = process.env.CRM_E2E_PROJECT_REF;
assert.equal(process.env.CRM_E2E_ALLOW_MUTATIONS, "isolated-project");
assert.equal(ref, "ddflbwfxebiytkxhshel");
assert.notEqual(ref, readFileSync("supabase/.temp/project-ref", "utf8").trim());
const cli = process.env.CRM_E2E_SUPABASE_CLI_PATH!;
assert(cli);
function cliJson(args: string[]) {
  const result = spawnSync(cli, [...args, "--output", "json"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
  });
  assert.equal(
    result.status,
    0,
    `Supabase CLI ${args[0]} failed (output withheld)`,
  );
  return JSON.parse(result.stdout);
}
const projects = cliJson(["projects", "list"]) as Array<{
  id: string;
  name: string;
}>;
assert.equal(
  projects.find((project) => project.id === ref)?.name,
  "immo-dreams83-e2e-20260909143411",
);
const keys = cliJson(["projects", "api-keys", "--project-ref", ref]) as Array<{
  name: string;
  api_key: string;
}>;
const anonKey = keys.find((key) => key.name === "anon")?.api_key;
const serviceKey = keys.find((key) => key.name === "service_role")?.api_key;
assert(anonKey && serviceKey);
const url = `https://${ref}.supabase.co`;
const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const run = `CONTACT_E2E_${Date.now()}`;
const password = `Test!${crypto.randomUUID()}Aa9`;
const port = Number(process.env.CRM_E2E_PORT ?? 3057);
const base = `http://127.0.0.1:${port}`;
const users: string[] = [],
  contacts: string[] = [],
  checks: string[] = [];
const propertyIds: string[] = [],
  offerIds: string[] = [],
  projectIds: string[] = [],
  visitIds: string[] = [];
let server: ReturnType<typeof spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const reportDir = join("work", "contacts-e2e", run);
mkdirSync(reportDir, { recursive: true });
const pass = (name: string) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(
  path: string,
  method: string,
  body?: unknown,
  cookie = "",
  status = 200,
) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const payload = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${JSON.stringify(payload)}`,
  );
  return payload;
}
async function user(role: "ADMIN" | "AGENT" | "READ_ONLY") {
  const email = `${run.toLowerCase()}-${role.toLowerCase()}@example.test`;
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  const id = created.data.user!.id;
  users.push(id);
  assert.ifError(
    (
      await db
        .from("profiles")
        .upsert({
          id,
          email,
          full_name: `${run} ${role}`,
          role,
          is_active: true,
        })
    ).error,
  );
  const response = await fetch(base + "/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `Login ${role}`);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert(cookie.includes("immo_admin_access_token="));
  return { id, cookie };
}
async function createContact(
  cookie: string,
  suffix: string,
  assignedTo?: string,
) {
  const result = await api(
    "/api/admin/leads",
    "POST",
    {
      firstName: run,
      lastName: suffix,
      phone: "0600000011",
      email: `${run.toLowerCase()}-${suffix}@example.test`,
      requestType: "Achat",
      city: "Hyères",
      estimatedBudget: "450000",
      source: "AGENCY",
      assignedTo: assignedTo ?? "UNASSIGNED",
      message: `${run} projet`,
    },
    cookie,
  );
  contacts.push(result.contact.id);
  return result.contact.id as string;
}
async function main() {
  let failure: unknown;
  try {
    const marker = await fetch(
      `${url}/rest/v1/crm_e2e_environment?select=project_ref`,
      {
        headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
      },
    );
    assert.equal(marker.status, 200, "Isolated database marker is required");
    assert.deepEqual(await marker.json(), [{ project_ref: ref }]);
    if (process.env.CRM_E2E_CLEANUP_RUN) {
      const previous = process.env.CRM_E2E_CLEANUP_RUN;
      await cleanupContactRecipe(db, previous);
      pass(
        "Nettoyage du contact isolé créé lors du précédent essai interrompu",
      );
    }
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "-p",
        String(port),
      ],
      {
        windowsHide: true,
        stdio: "pipe",
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: url,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
          SUPABASE_SERVICE_ROLE_KEY: serviceKey,
          ADMIN_BOOTSTRAP_EMAILS: "",
          NEXT_PUBLIC_SITE_URL: base,
          CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_URL: "",
          CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_TOKEN: "",
        },
      },
    );
    server.stdout?.on("data", () => undefined);
    server.stderr?.on("data", chunk => {
      const message = String(chunk);
      if (message.includes("Contact merge failed")) console.error(message.trim());
    });
    let ready = false;
    for (let i = 0; i < 90; i++) {
      try {
        if ((await fetch(base + "/admin/login")).status === 200) {
          ready = true;
          break;
        }
      } catch {}
      await sleep(1000);
    }
    assert(ready, "Server did not start");
    const admin = await user("ADMIN"),
      agent = await user("AGENT"),
      reader = await user("READ_ONLY");
    const id = await createContact(admin.cookie, "principal", admin.id);
    const other = await createContact(admin.cookie, "second", agent.id);
    const disposable = await createContact(
      admin.cookie,
      "suppression",
      admin.id,
    );
    pass("Création réelle de trois contacts");
    if (process.env.CRM_E2E_ONLY_MERGE === "1") {
      await api("/api/admin/leads", "PATCH", { table: "contacts", id, action: "merge-contacts", secondaryContactId: other }, admin.cookie);
      pass("Fusion atomique ciblée");
      return;
    }
    await api(`/api/admin/contacts/${id}`, "GET", undefined, "", 401);
    await api(`/api/admin/contacts/${id}`, "GET", undefined, agent.cookie, 403);
    await api(`/api/admin/contacts/${other}`, "GET", undefined, agent.cookie);
    const agentList = await api(
      "/api/admin/leads",
      "GET",
      undefined,
      agent.cookie,
    );
    assert(
      agentList.contacts.every(
        (row: { assigned_to: string }) => row.assigned_to === agent.id,
      ),
    );
    await api(
      "/api/admin/leads",
      "PATCH",
      { table: "contacts", id, notes: "forbidden" },
      agent.cookie,
      403,
    );
    await api(
      `/api/admin/contacts/${id}/actions`,
      "POST",
      { action: "log-activity", kind: "CALL", description: "forbidden" },
      reader.cookie,
      403,
    );
    await api(
      "/api/admin/leads",
      "PATCH",
      { table: "contacts", id: other, assignedTo: admin.id },
      agent.cookie,
      403,
    );
    pass("Permissions API : anonyme, lecture seule et agent hors périmètre");
    await api(
      "/api/admin/leads",
      "PATCH",
      {
        table: "contacts",
        id,
        interestScore: 80,
        profession: "Architecte",
        estimatedBudget: 480000,
        qualificationStatus: "QUALIFIED",
        contactRole: "BUYER",
        activeProspect: true,
      },
      admin.cookie,
    );
    const task = await api(
      `/api/admin/contacts/${id}/actions`,
      "POST",
      {
        action: "create-task",
        title: `${run} rappeler`,
        dueAt: new Date(Date.now() - 3600000).toISOString(),
        description: "Confirmer le projet",
        assignedTo: admin.id,
      },
      admin.cookie,
    );
    const stored = await db
      .from("tasks")
      .select("contact_id,status")
      .eq("id", task.id)
      .single();
    assert.ifError(stored.error);
    assert.equal(stored.data!.contact_id, id);
    await api(
      `/api/admin/contacts/${other}/actions`,
      "POST",
      { action: "complete-task", taskId: task.id, completed: true },
      admin.cookie,
      403,
    );
    await api(
      `/api/admin/contacts/${id}/actions`,
      "POST",
      { action: "complete-task", taskId: task.id, completed: true },
      admin.cookie,
    );
    assert.equal(
      (await db.from("tasks").select("status").eq("id", task.id).single()).data
        ?.status,
      "COMPLETED",
    );
    await api(
      `/api/admin/contacts/${id}/actions`,
      "POST",
      { action: "complete-task", taskId: task.id, completed: false },
      admin.cookie,
    );
    const activity = await api(
      `/api/admin/contacts/${id}/actions`,
      "POST",
      {
        action: "log-activity",
        kind: "CALL",
        description: `${run} appel réel consigné pour recette`,
      },
      admin.cookie,
    );
    assert.equal(
      (await db.from("activities").select("id").eq("id", activity.id).single())
        .data?.id,
      activity.id,
    );
    assert(
      (
        await db
          .from("contacts")
          .select("last_contacted_at")
          .eq("id", id)
          .single()
      ).data?.last_contacted_at,
    );
    pass("Qualification, tâche créée/terminée/rouverte et échange persistés");
    await api(
      "/api/admin/leads",
      "DELETE",
      { id, confirmation: true },
      admin.cookie,
      409,
    );
    await api(
      "/api/admin/leads",
      "DELETE",
      { id: disposable, confirmation: true },
      admin.cookie,
    );
    await api(
      "/api/admin/leads",
      "PATCH",
      { table: "contacts", id, archived: true },
      admin.cookie,
    );
    await api(
      `/api/admin/contacts/${id}/actions`,
      "POST",
      { action: "log-activity", kind: "NOTE", description: "blocked archive" },
      admin.cookie,
      409,
    );
    await api(
      "/api/admin/leads",
      "PATCH",
      { table: "contacts", id, archived: false },
      admin.cookie,
    );
    pass(
      "Suppression protégée, suppression sans dépendance, archivage/restauration",
    );
    await api(
      "/api/admin/leads",
      "PATCH",
      {
        table: "contacts",
        id,
        qualificationStatus: "QUALIFIED",
        contactRole: "BUYER",
        activeProspect: true,
      },
      admin.cookie,
    );
    const prospect = await api(
      "/api/admin/pipeline",
      "POST",
      { action: "create-lead-from-contact", contactId: id },
      admin.cookie,
    );
    projectIds.push(prospect.leadId);
    await api(
      `/api/admin/contacts/${id}/actions`,
      "POST",
      {
        action: "update-project",
        projectId: prospect.leadId,
        budgetMin: 400000,
        budgetMax: 480000,
        financingApproved: true,
        city: "Hyères, Toulon",
        notes: "3 pièces, terrasse et stationnement",
      },
      admin.cookie,
    );
    await api(
      `/api/admin/contacts/${other}/actions`,
      "POST",
      {
        action: "update-project",
        projectId: prospect.leadId,
        budgetMin: null,
        budgetMax: null,
        financingApproved: false,
        city: "",
        notes: "",
      },
      admin.cookie,
      403,
    );
    const project = await db
      .from("leads")
      .select("budget_min,financing_approved")
      .eq("id", prospect.leadId)
      .single();
    assert.equal(project.data?.budget_min, 400000);
    assert.equal(project.data?.financing_approved, true);
    pass("Projet : budget, financement, critères et isolation entre contacts");
    const propertyId = crypto.randomUUID();
    propertyIds.push(propertyId);
    assert.ifError(
      (
        await db
          .from("properties")
          .insert({
            id: propertyId,
            reference: run,
            slug: run.toLowerCase(),
            title: `${run} appartement`,
            city: "Hyères",
            postal_code: "83400",
            price: 450000,
            surface: 80,
            type: "apartment",
            status: "available",
            publication_status: "DRAFT",
            created_by: admin.id,
          })
      ).error,
    );
    for (const contactId of [id, other]) {
      const visitId = crypto.randomUUID();
      visitIds.push(visitId);
      assert.ifError(
        (
          await db
            .from("appointments")
            .insert({
              id: visitId,
              contact_id: contactId,
              appointment_type: "VISIT",
              lead_id: contactId === id ? prospect.leadId : null,
              assigned_to: admin.id,
              property_id: propertyId,
              title: `${run} visite`,
              starts_at: new Date(Date.now() + 86400000).toISOString(),
              ends_at: new Date(Date.now() + 90000000).toISOString(),
            })
        ).error,
      );
    }
    const draftOffer = await api(
      "/api/admin/commercial/offres",
      "POST",
      {
        action: "create",
        submission: "draft",
        propertyId,
        buyerDossierId: prospect.leadId,
        buyerContactId: id,
        visitId: visitIds[0],
        responsibleUserId: admin.id,
        amount: 430000,
        offerDate: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 14 * 86400000)
          .toISOString()
          .slice(0, 10),
        financingType: "CASH",
      },
      admin.cookie,
      201,
    );
    offerIds.push(draftOffer.result.offer_id);
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("CONTACT RECIPE ONLY");
    const form = new FormData();
    form.set("offerId", offerIds[0]);
    form.set(
      "file",
      new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" }),
      `${run}.pdf`,
    );
    const upload = await fetch(base + "/api/admin/commercial/offres", {
      method: "POST",
      headers: { Cookie: admin.cookie },
      body: form,
    });
    const uploadBody = await upload.json();
    assert.equal(upload.status, 201, JSON.stringify(uploadBody));
    const linked = await api(
      `/api/admin/contacts/${id}`,
      "GET",
      undefined,
      admin.cookie,
    );
    assert(
      linked.data.properties.some(
        (row: { id: string }) => row.id === propertyId,
      ),
    );
    assert(
      linked.data.visits.some((row: { id: string }) => row.id === visitIds[0]),
    );
    assert(
      linked.data.documents.some(
        (row: { id: string }) => row.id === uploadBody.id,
      ),
    );
    const signed = await api(
      `/api/admin/commercial/offres?documentId=${uploadBody.id}`,
      "GET",
      undefined,
      admin.cookie,
    );
    assert.equal((await fetch(signed.url)).status, 200);
    pass(
      "Biens, visites et document PDF privé liés, téléchargement signé réel",
    );
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies(
      admin.cookie.split("; ").map((value) => {
        const index = value.indexOf("=");
        return {
          name: value.slice(0, index),
          value: value.slice(index + 1),
          url: base,
        };
      }),
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const paginationFixture = await db.from("contacts").select("*").eq("id", id).single();
    assert.ifError(paginationFixture.error);
    await checkContactPaginationUi(page, base, paginationFixture.data!, reportDir);
    pass("Pagination : 4 tailles, accès direct, filtres, cartes, bornes et 7 largeurs (lignes synthétiques navigateur uniquement)");
    await page.goto(`${base}/admin?tab=contacts&contact=${id}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("heading", { name: `${run} principal`, exact: true })
      .waitFor({ timeout: 60000 });
    await page.getByRole("button", { name: "Plus d'actions" }).click();
    await page
      .getByRole("button", { name: "Modifier la fiche", exact: true })
      .click();
    await page.locator("#edit-contact-name").fill("Brouillon annulé");
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await page
      .getByRole("heading", { name: `${run} principal`, exact: true })
      .waitFor();
    assert.equal(
      (await db.from("contacts").select("name").eq("id", id).single()).data
        ?.name,
      `${run} principal`,
    );
    pass("Annulation : aucun brouillon conservé ni enregistré");
    await page.getByRole("button", { name: "Plus d'actions" }).click();
    await page
      .getByRole("button", { name: "Modifier la fiche", exact: true })
      .click();
    await page.locator("#edit-contact-profession").fill("Architecte confirmé");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      (await db.from("contacts").select("profession").eq("id", id).single())
        .data?.profession,
      "Architecte confirmé",
    );
    await page.getByRole("button", { name: "Plus d'actions" }).click();
    await page
      .getByRole("button", { name: "Changer de responsable", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Choisir le nouveau responsable")
      .selectOption(agent.id);
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    assert.equal(
      (await db.from("contacts").select("assigned_to").eq("id", id).single())
        .data?.assigned_to,
      admin.id,
    );
    pass(
      "Modification enregistrée et changement de responsable annulé par l’interface",
    );
    for (const tab of [
      "Aperçu",
      "Projet",
      "Activités",
      "Biens",
      "Visites",
      "Documents",
    ]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await page.screenshot({
        path: join(reportDir, `${tab}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("tab", { name: "Aperçu", exact: true }).click();
    await page
      .getByRole("button", { name: "Créer une tâche", exact: true })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .locator('input[name="title"]')
      .fill(`${run} tâche UI`);
    await page
      .getByRole("dialog")
      .locator('input[name="dueAt"]')
      .fill("2026-09-12T10:00");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Créer la tâche", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByText(`${run} tâche UI`, { exact: true }).filter({ visible: true }).waitFor();
    pass("Six onglets et création de tâche par le navigateur");
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Débordement à ${width}px`,
      );
      await page.screenshot({
        path: join(reportDir, `contact-${width}.png`),
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    pass("Responsive 7 largeurs et absence d’erreur JavaScript");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/admin?tab=contacts`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("textbox", { name: "Rechercher un contact", exact: true })
      .fill("hyeres");
    await page.getByRole("button", { name: "Vue cartes", exact: true }).click();
    assert.match(await page.getByRole("combobox", { name: "Filtrer par rôle" }).innerText(), /Tous les rôles/);
    assert.match(await page.getByRole("combobox", { name: "Filtrer par vendeur" }).innerText(), /Tous les vendeurs/);
    await page
      .getByRole("heading", { name: `${run} principal`, exact: true })
      .waitFor();
    await page.screenshot({
      path: join(reportDir, "contacts-cartes.png"),
      fullPage: true,
    });
    await page
      .getByRole("textbox", { name: "Rechercher un contact", exact: true })
      .fill("aucune-correspondance-recette");
    await page.getByText("Aucun résultat", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Réinitialiser", exact: true })
      .click();
    await page
      .getByRole("heading", { name: `${run} principal`, exact: true })
      .waitFor();
    pass("Recherche accentuée, cartes et aucun résultat/réinitialisation");
    await page.getByRole("checkbox", { name: `Sélectionner ${run} principal`, exact: true }).check();
    await page.getByRole("checkbox", { name: `Sélectionner ${run} second`, exact: true }).check();
    await page.route("**/api/admin/leads", async route => {
      if (route.request().method() === "PATCH" && route.request().postDataJSON()?.id === other) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Indisponibilité simulée pour la recette" }) });
      } else await route.continue();
    });
    await page.getByRole("button", { name: "Archiver", exact: true }).click();
    await page.getByText(/1 action\(s\) réussie\(s\).*1 échec/).waitFor();
    assert(await page.getByRole("checkbox", { name: `Sélectionner ${run} second`, exact: true }).isChecked());
    assert.equal((await db.from("contacts").select("archived").eq("id", id).single()).data?.archived, true);
    assert.equal((await db.from("contacts").select("archived").eq("id", other).single()).data?.archived, false);
    await page.unroute("**/api/admin/leads");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exporter", exact: true }).last().click();
    const csvFile = await (await downloadPromise).path(); assert(csvFile);
    const csv = readFileSync(csvFile, "utf8"); assert(csv.includes(`${run} second`)); assert(!csv.includes(`${run} principal`));
    pass("Action groupée partiellement échouée : sélection préservée et export filtré exact");
    await api("/api/admin/leads", "PATCH", { table: "contacts", id, archived: false }, admin.cookie);
    await page.route("**/api/admin/leads", route => route.abort("failed"));
    await page.goto(`${base}/admin?tab=contacts`, { waitUntil: "domcontentloaded" });
    await page.getByText("Le CRM n'a pas pu être chargé", { exact: true }).waitFor();
    await page.unroute("**/api/admin/leads");
    await page.getByRole("button", { name: "Réessayer", exact: true }).click();
    await page.getByRole("textbox", { name: "Rechercher un contact", exact: true }).waitFor();
    await page.route(`**/api/admin/contacts/${id}`, async route => { await sleep(2000); await route.continue().catch(() => undefined); });
    await page.goto(`${base}/admin?tab=contacts&contact=${id}`, { waitUntil: "domcontentloaded" });
    await page.getByText("Chargement des données liées…", { exact: true }).first().waitFor();
    await page.getByText(`${run} tâche UI`, { exact: true }).filter({ visible: true }).waitFor();
    await page.unroute(`**/api/admin/contacts/${id}`);
    pass("États chargement et erreur réseau récupérable");
    const readContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await readContext.addCookies(reader.cookie.split("; ").map(value => { const index = value.indexOf("="); return { name: value.slice(0, index), value: value.slice(index + 1), url: base }; }));
    const readPage = await readContext.newPage();
    await readPage.goto(`${base}/admin?tab=contacts&contact=${id}`, { waitUntil: "domcontentloaded" });
    await readPage.getByRole("heading", { name: `${run} principal`, exact: true }).waitFor();
    assert(await readPage.getByRole("button", { name: "Créer une tâche", exact: true }).first().isDisabled());
    await readContext.close(); pass("Lecture seule : actions d’écriture désactivées dans l’interface");
    await page.getByRole("tab", { name: "Projet", exact: true }).click();
    await page.getByRole("button", { name: "Modifier le projet", exact: true }).click();
    await page.getByRole("dialog").locator('input[name="max"]').fill("490000");
    await page.getByRole("button", { name: "Enregistrer le projet", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal((await db.from("leads").select("budget_max").eq("id", prospect.leadId).single()).data?.budget_max, 490000);
    await page.goto(`${base}/admin?tab=contacts`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Nouveau contact", exact: true }).click();
    await page.locator("#contact-first-name").fill(run);
    await page.locator("#contact-last-name").fill("UI");
    await page.locator("#contact-phone").fill("0600000012");
    await page.locator("#contact-message").fill("Création depuis le formulaire réel de recette");
    await page.getByRole("button", { name: "Enregistrer le contact", exact: true }).click();
    await page.getByRole("heading", { name: `${run} UI`, exact: true }).waitFor();
    const uiContact = await db.from("contacts").select("id").eq("name", `${run} UI`).single(); assert.ifError(uiContact.error); contacts.push(uiContact.data!.id);
    pass("Création par formulaire et modification du projet depuis l’interface");
    const normalized = await db
      .from("contacts")
      .select("normalized_email,normalized_phone")
      .eq("id", id)
      .single();
    assert.equal(normalized.data?.normalized_phone, "0600000011");
    assert(normalized.data?.normalized_email);
    await api(
      "/api/admin/leads",
      "PATCH",
      {
        table: "contacts",
        id,
        action: "ignore-duplicate",
        secondaryContactId: other,
      },
      admin.cookie,
    );
    assert.equal(
      (
        await db
          .from("contacts")
          .select("dedupe_status")
          .eq("id", other)
          .single()
      ).data?.dedupe_status,
      "IGNORED",
    );
    await api(
      "/api/admin/leads",
      "PATCH",
      {
        table: "contacts",
        id,
        action: "merge-contacts",
        secondaryContactId: other,
      },
      admin.cookie,
    );
    assert.equal(
      (
        await db
          .from("contacts")
          .select("archived,canonical_contact_id")
          .eq("id", other)
          .single()
      ).data?.canonical_contact_id,
      id,
    );
    assert.equal(
      (
        await db
          .from("appointments")
          .select("contact_id")
          .eq("id", visitIds[1])
          .single()
      ).data?.contact_id,
      id,
    );
    pass(
      "Détection normalisée, conservation des doublons et fusion avec transfert des visites",
    );
    await api("/api/admin/leads", "PATCH", { table: "contacts", id: other, archived: false }, admin.cookie, 409);
    pass("Une fiche fusionnée ne peut pas être restaurée comme doublon actif");
  } catch (error) {
    failure = error;
    console.error(error instanceof Error ? error.message : "Recette échouée");
  } finally {
    await browser?.close();
    server?.kill();
    const untracked = await db
      .from("contacts")
      .select("id")
      .like("name", `${run} %`);
    assert.ifError(untracked.error);
    for (const row of untracked.data ?? [])
      if (!contacts.includes(row.id)) contacts.push(row.id);
    if (contacts.length) {
      const relatedProjects = await db
        .from("leads")
        .select("id")
        .in("contact_id", contacts);
      assert.ifError(relatedProjects.error);
      for (const row of relatedProjects.data ?? [])
        if (!projectIds.includes(row.id)) projectIds.push(row.id);
      if (offerIds.length) {
        const docs = await db
          .from("offer_documents")
          .select("storage_bucket,storage_path")
          .in("offer_id", offerIds);
        assert.ifError(docs.error);
        for (const doc of docs.data ?? [])
          assert.ifError(
            (
              await db.storage
                .from(doc.storage_bucket)
                .remove([doc.storage_path])
            ).error,
          );
        assert.ifError(
          (await db.from("offer_documents").delete().in("offer_id", offerIds))
            .error,
        );
        assert.ifError(
          (
            await db
              .from("offer_status_history")
              .delete()
              .in("offer_id", offerIds)
          ).error,
        );
        assert.ifError(
          (await db.from("offers").delete().in("id", offerIds)).error,
        );
      }
      if (visitIds.length)
        assert.ifError(
          (await db.from("appointments").delete().in("id", visitIds)).error,
        );
      if (projectIds.length)
        assert.ifError(
          (await db.from("tasks").delete().in("lead_id", projectIds)).error,
        );
      assert.ifError(
        (await db.from("tasks").delete().in("contact_id", contacts)).error,
      );
      assert.ifError(
        (
          await db
            .from("activities")
            .delete()
            .in("entity_id", [
              ...contacts,
              ...projectIds,
              ...offerIds,
              ...visitIds,
              ...propertyIds,
            ])
        ).error,
      );
      assert.ifError(
        (
          await db
            .from("audit_logs")
            .delete()
            .in("entity_id", [
              ...contacts,
              ...projectIds,
              ...offerIds,
              ...visitIds,
              ...propertyIds,
            ])
        ).error,
      );
      assert.ifError(
        (
          await db
            .from("lead_merge_logs")
            .delete()
            .in("primary_contact_id", contacts)
        ).error,
      );
      if (projectIds.length)
        assert.ifError(
          (await db.from("leads").delete().in("id", projectIds)).error,
        );
      if (propertyIds.length)
        assert.ifError(
          (await db.from("properties").delete().in("id", propertyIds)).error,
        );
      assert.ifError(
        (await db.from("contacts").delete().in("id", contacts)).error,
      );
      assert.equal(
        (
          await db
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .in("id", contacts)
        ).count,
        0,
      );
    }
    for (const id of users) {
      assert.ifError(
        (await db.from("audit_logs").delete().eq("actor_id", id)).error,
      );
      assert.ifError((await db.from("profiles").delete().eq("id", id)).error);
      assert.ifError((await db.auth.admin.deleteUser(id)).error);
    }
    pass("Nettoyage ciblé des seules données temporaires de cette recette");
    writeFileSync(
      join(reportDir, "report.json"),
      JSON.stringify(
        {
          run,
          projectRef: ref,
          checks,
          success: !failure,
          failure: failure instanceof Error ? failure.message : null,
        },
        null,
        2,
      ),
    );
  }
  if (failure) process.exitCode = 1;
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect, type Browser, type BrowserContext, type Page, type Request as BrowserRequest } from "@playwright/test";
import type { Database } from "../src/types/supabase";
import { verifyPropertyWorkspace } from "./test-property-workspace";

type JsonObject = Record<string, unknown>;

type ApiResult = {
  status: number;
  body: JsonObject;
  response: Response;
};

type CreatedIds = {
  adminUserId: string;
  readOnlyUserId: string;
  sellerContactId: string;
  buyerContactId: string;
  rollbackContactId: string;
  estimationId: string;
  rollbackEstimationId: string;
  propertyId: string;
  sellerCaseId: string;
  mandateId: string;
  buyerCaseId: string;
  visitId: string;
  followUpTaskId: string;
  draftOfferId: string;
  negotiationId: string;
  negotiationStepId: string;
  newOfferId: string;
  documentId: string;
};

const repoRoot = process.cwd();
const productionRefPath = join(repoRoot, "supabase", ".temp", "project-ref");
const supabaseCliVersion = "2.116.0";
const projectRef = requiredEnv("CRM_E2E_PROJECT_REF");
const projectName = requiredEnv("CRM_E2E_PROJECT_NAME");
const supabaseUrl = requiredEnv("CRM_E2E_SUPABASE_URL");
const anonKey = requiredEnv("CRM_E2E_SUPABASE_ANON_KEY");
const serviceRoleKey = requiredEnv("CRM_E2E_SUPABASE_SERVICE_ROLE_KEY");
const allowMutations = requiredEnv("CRM_E2E_ALLOW_MUTATIONS");
const port = Number(process.env.CRM_E2E_PORT ?? 3042);
const baseUrl = `http://127.0.0.1:${port}`;
const runId = `E2E_CRM_${new Date().toISOString().replace(/[-:.TZ]/g, "")}`;
const adminEmail = `${runId.toLowerCase()}-admin@example.test`;
const readOnlyEmail = `${runId.toLowerCase()}-readonly@example.test`;
const userPassword = `E2e!${crypto.randomUUID()}Aa1`;
const futureStart = new Date(Date.now() + 2 * 86_400_000);
futureStart.setUTCHours(9, 30, 0, 0);
const futureEnd = new Date(futureStart.getTime() + 60 * 60_000);
const rescheduledStart = new Date(futureStart.getTime() + 24 * 60 * 60_000);
const rescheduledEnd = new Date(rescheduledStart.getTime() + 75 * 60_000);
const followUpAt = new Date(rescheduledStart.getTime() + 2 * 86_400_000);
const today = new Date().toISOString().slice(0, 10);
const validUntil = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

const ids: CreatedIds = {
  adminUserId: "",
  readOnlyUserId: "",
  sellerContactId: "",
  buyerContactId: "",
  rollbackContactId: "",
  estimationId: "",
  rollbackEstimationId: "",
  propertyId: "",
  sellerCaseId: "",
  mandateId: "",
  buyerCaseId: "",
  visitId: "",
  followUpTaskId: "",
  draftOfferId: "",
  negotiationId: "",
  negotiationStepId: "",
  newOfferId: "",
  documentId: "",
};

const results: Array<{ check: string; status: "PASS" | "FAIL"; evidence: string }> = [];
const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let server: ChildProcessWithoutNullStreams | null = null;
let browser: Browser | null = null;
let failureTriggerInstalled = false;
let adminCookie = "";
let baselinePipelineTotal = 0;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function objectValue(value: unknown, label: string): JsonObject {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as JsonObject;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  assert(value.length > 0, `${label} must not be empty`);
  return value;
}

function record(check: string, evidence: string) {
  results.push({ check, status: "PASS", evidence });
  console.log(`PASS ${check} — ${evidence}`);
}

function assertOperation(
  result: { error: unknown },
  label: string,
) {
  if (result.error) {
    const detail = result.error instanceof Error
      ? result.error.message
      : JSON.stringify(result.error);
    throw new Error(`${label}: ${detail}`);
  }
  return result;
}

async function readPipelineStatsTotal() {
  const stats = await supabase
    .from("v_commercial_pipeline_stats")
    .select("dossier_count");
  assert.ifError(stats.error);
  return (stats.data ?? []).reduce(
    (total, row) => total + Number(row.dossier_count ?? 0),
    0,
  );
}

function assertSafeTarget() {
  assert.equal(allowMutations, "isolated-project", "CRM_E2E_ALLOW_MUTATIONS must equal isolated-project");
  assert.match(projectRef, /^[a-z0-9]{20}$/);
  assert.match(projectName, /^immo-dreams83-e2e-\d+$/);
  const targetUrl = new URL(supabaseUrl);
  assert.equal(targetUrl.protocol, "https:", "The E2E Supabase URL must use HTTPS");
  assert.equal(
    targetUrl.hostname,
    `${projectRef}.supabase.co`,
    "Supabase URL and E2E project ref mismatch",
  );
  assert(
    existsSync(productionRefPath),
    "Linked production ref is required to prove that the E2E target is isolated",
  );
  const productionRef = readFileSync(productionRefPath, "utf8").trim();
  assert.match(productionRef, /^[a-z0-9]{20}$/);
  assert.notEqual(projectRef, productionRef, "Refusing to mutate the linked production project");
}

function supabaseCli(args: string[]) {
  // Windows cannot spawn .cmd files without a shell. Prefer the native CLI.
  const executable = process.env.CRM_E2E_SUPABASE_CLI_PATH;
  if (executable) {
    assert(existsSync(executable), "Configured Supabase CLI does not exist");
    return spawnSync(executable, args, {
      cwd: repoRoot, encoding: "utf8", shell: false, windowsHide: true,
    });
  }
  const cliArgs = ["--yes", `supabase@${supabaseCliVersion}`, ...args];
  return process.platform === "win32"
    ? spawnSync("npx.cmd", cliArgs, { cwd: repoRoot, encoding: "utf8", shell: false })
    : spawnSync("npx", cliArgs, { cwd: repoRoot, encoding: "utf8", shell: false });
}

function verifyRemoteProjectIdentity() {
  if (process.env.CRM_E2E_SUPABASE_CLI_PATH) {
    const version = supabaseCli(["--version"]);
    assert.equal(version.status, 0, "Unable to run configured Supabase CLI");
    assert.equal(version.stdout.trim(), supabaseCliVersion, "Unexpected Supabase CLI version");
  }
  const execution = supabaseCli(["projects", "list", "--output", "json"]);
  if (execution.status !== 0) {
    throw new Error(`Unable to verify isolated Supabase project: ${execution.stderr || execution.stdout}`);
  }
  const projects = JSON.parse(execution.stdout || "[]") as Array<{
    id?: string;
    name?: string;
  }>;
  const target = projects.find((project) => project.id === projectRef);
  assert(target, `Supabase project ${projectRef} is not accessible to the authenticated CLI`);
  assert.equal(
    target.name,
    projectName,
    "CRM_E2E_PROJECT_NAME does not match the verified Supabase project",
  );
}

async function jsonResponse(response: Response): Promise<JsonObject> {
  const payload: unknown = await response.json().catch(() => ({}));
  return objectValue(payload, `HTTP ${response.status} payload`);
}

async function api(
  path: string,
  init: RequestInit = {},
  cookie = adminCookie,
): Promise<ApiResult> {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", cookie);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, redirect: "manual" });
  return { status: response.status, body: await jsonResponse(response), response };
}

async function post(path: string, body: JsonObject, cookie = adminCookie) {
  return api(path, { method: "POST", body: JSON.stringify(body) }, cookie);
}

function expectStatus(result: ApiResult, expected: number, label: string) {
  assert.equal(
    result.status,
    expected,
    `${label}: expected ${expected}, received ${result.status}: ${JSON.stringify(result.body)}`,
  );
}

function cookieHeader(response: Response) {
  const cookieHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = cookieHeaders.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const cookie = values
    .filter(Boolean)
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert(cookie.includes("immo_admin_access_token="), "Admin access cookie is missing");
  return cookie;
}

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/admin/login`, { redirect: "manual" });
      if (response.status === 200) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next.js E2E server did not become ready");
}

function startServer() {
  const nextBin = join(repoRoot, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "-p", String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      ADMIN_BOOTSTRAP_EMAILS: adminEmail,
      NEXT_PUBLIC_SITE_URL: baseUrl,
      CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_URL: "",
      CRM_TRANSACTIONAL_COMMUNICATION_WEBHOOK_TOKEN: "",
    },
    stdio: "pipe",
    windowsHide: true,
  });
  child.stdout.on("data", () => undefined);
  child.stderr.on("data", () => undefined);
  return child;
}

function runSql(sql: string) {
  const sqlPath = join(tmpdir(), `immo-crm-e2e-${crypto.randomUUID()}.sql`);
  writeFileSync(sqlPath, sql, { encoding: "utf8", flag: "wx" });
  try {
    const execution = supabaseCli([
      "db",
      "query",
      "--linked",
      "--project-ref",
      projectRef,
      "--file",
      sqlPath,
    ]);
    if (execution.status !== 0) {
      throw new Error(`Supabase SQL failed: ${execution.stderr || execution.stdout}`);
    }
  } finally {
    unlinkSync(sqlPath);
  }
}

async function seedUsersAndContacts() {
  const createdAdmin = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: userPassword,
    email_confirm: true,
    user_metadata: { full_name: `${runId} Admin` },
  });
  assert.ifError(createdAdmin.error);
  ids.adminUserId = stringValue(createdAdmin.data.user?.id, "admin user id");

  const createdReadOnly = await supabase.auth.admin.createUser({
    email: readOnlyEmail,
    password: userPassword,
    email_confirm: true,
    user_metadata: { full_name: `${runId} Read only` },
  });
  assert.ifError(createdReadOnly.error);
  ids.readOnlyUserId = stringValue(createdReadOnly.data.user?.id, "read-only user id");

  const readOnlyProfile = await supabase.from("profiles").insert({
    id: ids.readOnlyUserId,
    email: readOnlyEmail,
    full_name: `${runId} Read only`,
    role: "READ_ONLY",
    is_active: true,
  });
  assert.ifError(readOnlyProfile.error);

  const contacts = await supabase
    .from("contacts")
    .insert([
      {
        name: `${runId} Vendeur`,
        email: `${runId.toLowerCase()}-seller@example.test`,
        phone: "+33600000001",
        request_type: "Vente",
        city: "Toulon",
        message: runId,
        status: "NEW",
        notes: runId,
        archived: false,
      },
      {
        name: `${runId} Acquéreur`,
        email: `${runId.toLowerCase()}-buyer@example.test`,
        phone: "+33600000002",
        request_type: "Achat",
        city: "Toulon",
        message: runId,
        status: "NEW",
        notes: runId,
        archived: false,
      },
      {
        name: `${runId} Rollback`,
        email: `${runId.toLowerCase()}-rollback@example.test`,
        phone: "+33600000003",
        request_type: "Vente",
        city: "Toulon",
        message: runId,
        status: "NEW",
        notes: runId,
        archived: false,
      },
    ])
    .select("id,name");
  assert.ifError(contacts.error);
  for (const contact of contacts.data ?? []) {
    if (contact.name.endsWith("Vendeur")) ids.sellerContactId = contact.id;
    if (contact.name.endsWith("Acquéreur")) ids.buyerContactId = contact.id;
    if (contact.name.endsWith("Rollback")) ids.rollbackContactId = contact.id;
  }
  assert(ids.sellerContactId && ids.buyerContactId && ids.rollbackContactId);
  record("Seed temporaire", `3 contacts et 2 utilisateurs isolés · ${runId}`);
}

async function login(email: string) {
  const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: userPassword }),
    redirect: "manual",
  });
  const body = await jsonResponse(response);
  assert.equal(response.status, 200, `Login failed: ${JSON.stringify(body)}`);
  return cookieHeader(response);
}

async function verifySecurity() {
  const unauthorizedApi = await fetch(`${baseUrl}/api/admin/commercial/pipeline`);
  assert.equal(unauthorizedApi.status, 401);
  const unauthorizedPage = await fetch(`${baseUrl}/commercial/pipeline`, { redirect: "manual" });
  assert.equal(unauthorizedPage.status, 307);
  assert.match(unauthorizedPage.headers.get("location") ?? "", /\/admin\/login/);

  const readOnlyCookie = await login(readOnlyEmail);
  const forbidden = await post(
    "/api/admin/commercial/pipeline",
    {
      action: "create-case",
      contactId: ids.buyerContactId,
      pipelineType: "BUYER",
      assignedTo: ids.readOnlyUserId,
      propertyId: null,
      estimationId: null,
      priority: "normal",
      title: `${runId} forbidden`,
      notes: runId,
    },
    readOnlyCookie,
  );
  expectStatus(forbidden, 403, "read-only mutation");
  const rpcArgs = {
    p_estimation_id: crypto.randomUUID(),
    p_listing_price: 420000,
    p_mandate_type: "exclusive",
    p_actor_id: ids.adminUserId,
    p_actor_name: runId,
  };
  const anonClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonRpc = await anonClient.rpc("transform_commercial_estimation", rpcArgs);
  assert(anonRpc.error, "Anonymous role unexpectedly executed a sensitive RPC");

  const authenticatedClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authenticatedLogin = await authenticatedClient.auth.signInWithPassword({
    email: adminEmail,
    password: userPassword,
  });
  assert.ifError(authenticatedLogin.error);
  const authenticatedRpc = await authenticatedClient.rpc(
    "transform_commercial_estimation",
    rpcArgs,
  );
  assert(
    authenticatedRpc.error,
    "Authenticated role unexpectedly executed a service-role-only RPC",
  );
  record("Sécurité des routes", "307 page, 401 API, 403 rôle READ_ONLY, admin autorisé");
  record("Sécurité RPC", "transform_commercial_estimation refusée à anon et authenticated");
}

async function createEstimation(contactId: string, suffix: string) {
  const result = await post("/api/admin/commercial/estimations", {
    action: "create",
    contactId,
    assignedTo: ids.adminUserId,
    propertyAddress: `10 rue ${runId} ${suffix}`,
    city: "Toulon",
    postalCode: "83000",
    propertyType: "Appartement T3",
    surface: 72,
    rooms: 3,
    constructionYear: 2018,
    propertyCondition: "Bon état",
    appointmentAt: futureStart.toISOString(),
    durationMinutes: 60,
    appointmentLocation: `10 rue ${runId}`,
    notes: `${runId} ${suffix}`,
  });
  expectStatus(result, 201, `create estimation ${suffix}`);
  return stringValue(result.body.id, `estimation ${suffix} id`);
}

async function verifyRollback() {
  ids.rollbackEstimationId = await createEstimation(ids.rollbackContactId!, "ROLLBACK");
  const before = await supabase
    .from("estimations")
    .select("converted_to_property,converted_property_id")
    .eq("id", ids.rollbackEstimationId)
    .single();
  assert.ifError(before.error);

  runSql(`
    create or replace function public.e2e_crm_fail_mandate_${runId.toLowerCase()}()
    returns trigger language plpgsql set search_path=public as $$
    begin
      raise exception 'E2E_FORCED_MANDATE_FAILURE';
    end $$;
    create trigger e2e_crm_fail_mandate_${runId.toLowerCase()}
    before insert on public.mandates
    for each row execute function public.e2e_crm_fail_mandate_${runId.toLowerCase()}();
  `);
  failureTriggerInstalled = true;
  const failed = await post("/api/admin/commercial/estimations", {
    action: "transform",
    id: ids.rollbackEstimationId,
    listingPrice: 395000,
    mandateType: "exclusive",
  });
  assert.equal(failed.status, 500);
  await dropFailureTrigger();

  const estimation = await supabase
    .from("estimations")
    .select("converted_to_property,converted_property_id")
    .eq("id", ids.rollbackEstimationId)
    .single();
  assert.ifError(estimation.error);
  assert.equal(estimation.data.converted_to_property, false);
  assert.equal(estimation.data.converted_property_id, null);
  const partialLeads = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("estimation_id", ids.rollbackEstimationId);
  const partialMandates = await supabase
    .from("mandates")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", ids.rollbackEstimationId);
  assert.equal(partialLeads.count, 0);
  assert.equal(partialMandates.count, 0);
  record("Rollback estimation → bien", "échec forcé après insertions initiales, 0 création partielle");
}

async function dropFailureTrigger() {
  if (!failureTriggerInstalled) return;
  runSql(`
    drop trigger if exists e2e_crm_fail_mandate_${runId.toLowerCase()} on public.mandates;
    drop function if exists public.e2e_crm_fail_mandate_${runId.toLowerCase()}();
  `);
  failureTriggerInstalled = false;
}

async function transformEstimation() {
  const transformActivities = [
    "Estimation transformee en bien",
    "Bien cree depuis une estimation",
    "Dossier vendeur et mandat crees",
    "Mandat signe lie au dossier vendeur",
  ];
  ids.estimationId = await createEstimation(ids.sellerContactId!, "MAIN");
  await verifyResourceLiveSync("estimations", ids.estimationId, "SCHEDULED", "Réalisée", { action: "update", id: ids.estimationId, commercialStatus: "COMPLETED" });
  const body = {
    action: "transform",
    id: ids.estimationId,
    listingPrice: 420000,
    mandateType: "exclusive",
  };
  const [first, second] = await Promise.all([
    post("/api/admin/commercial/estimations", body),
    post("/api/admin/commercial/estimations", body),
  ]);
  const success = [first, second].find((result) => result.status === 200);
  if (success) {
    const transformed = objectValue(success.body.result, "transformation result");
    ids.propertyId = stringValue(transformed.property_id, "property id");
    ids.sellerCaseId = stringValue(transformed.commercial_case_id, "seller case id");
    ids.mandateId = stringValue(transformed.mandate_id, "mandate id");
  }
  const statuses = [first.status, second.status].sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 409]);
  assert(success);
  const transformed = objectValue(success.body.result, "transformation result");
  const slug = stringValue(transformed.property_slug, "property slug");

  const [property, lead, mandate, estimation, activities] = await Promise.all([
    supabase.from("properties").select("id,slug,created_by").eq("id", ids.propertyId).single(),
    supabase.from("leads").select("id,contact_id,linked_property_id,estimation_id,pipeline_stage").eq("id", ids.sellerCaseId).single(),
    supabase.from("mandates").select("id,lead_id,property_id,status").eq("id", ids.mandateId).single(),
    supabase.from("estimations").select("converted_to_property,converted_property_id,commercial_status").eq("id", ids.estimationId).single(),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .in("entity_id", [ids.estimationId, ids.propertyId, ids.sellerCaseId, ids.mandateId])
      .in("action", transformActivities),
  ]);
  for (const query of [property, lead, mandate, estimation, activities]) assert.ifError(query.error);
  assert(property.data);
  assert(lead.data);
  assert(mandate.data);
  assert(estimation.data);
  assert.equal(property.data.slug, slug);
  assert.equal(lead.data.contact_id, ids.sellerContactId);
  assert.equal(lead.data.linked_property_id, ids.propertyId);
  assert.equal(mandate.data.lead_id, ids.sellerCaseId);
  assert.equal(mandate.data.property_id, ids.propertyId);
  assert.equal(estimation.data.converted_to_property, true);
  assert.equal(estimation.data.converted_property_id, ids.propertyId);
  assert.equal(activities.count, 4);
  record("Estimation → Bien", `property=${ids.propertyId} case=${ids.sellerCaseId} mandate=${ids.mandateId}`);
  record("Concurrence transformation", "2 appels simultanés → 1 succès, 1 conflit, 1 seul bien");
}

async function verifyPipelineAndRealtime() {
  const buyerCase = await post("/api/admin/commercial/pipeline", {
    action: "create-case",
    contactId: ids.buyerContactId,
    pipelineType: "BUYER",
    assignedTo: ids.adminUserId,
    propertyId: ids.propertyId,
    estimationId: null,
    priority: "high",
    title: `${runId} Dossier acquéreur`,
    notes: runId,
  });
  expectStatus(buyerCase, 201, "create buyer case");
  ids.buyerCaseId = stringValue(buyerCase.body.id, "buyer case id");
  await verifyPipelineOrder();

  let realtimeResolve: ((value: unknown) => void) | null = null;
  const receivedIds: string[] = [];
  const realtimeEvent = new Promise((resolve) => {
    realtimeResolve = resolve;
  });
  const channel = supabase
    .channel(`${runId}-pipeline`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "leads" },
      (payload) => {
        const updated = objectValue(payload.new, "realtime lead payload");
        receivedIds.push(String(updated.id));
        if (updated.id === ids.sellerCaseId) realtimeResolve?.(payload);
      },
    );
  try {
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const timeout = setTimeout(() => reject(new Error("Realtime PostgreSQL readiness timeout")), 20_000);
      channel.on("system", {}, (payload: { extension?: string; status?: string }) => {
        if (payload.extension === "postgres_changes" && payload.status === "ok") {
          console.log(`Realtime PostgreSQL ready: ${Date.now() - started}ms`);
          clearTimeout(timeout);
          resolve();
        }
      });
      channel.subscribe((status) => {
        console.log(`Realtime channel: ${status} (${Date.now() - started}ms)`);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`Realtime channel failure: ${status}`));
        }
      });
    });

    const moved = await post("/api/admin/commercial/pipeline", {
      action: "move-stage",
      id: ids.sellerCaseId,
      stage: "SELLER_MARKETED",
    });
    expectStatus(moved, 200, "move seller pipeline");
    await Promise.race([
      realtimeEvent,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Realtime update timeout; received lead IDs: ${receivedIds.join(",") || "none"}`)), 20_000)),
    ]);
  } finally {
    await supabase.removeChannel(channel);
  }

  const dbLead = await supabase
    .from("leads")
    .select("pipeline_stage,contact_id,linked_property_id,priority,status,assigned_to")
    .eq("id", ids.sellerCaseId)
    .single();
  assert.ifError(dbLead.error);
  assert.equal(dbLead.data.pipeline_stage, "SELLER_MARKETED");
  assert.equal(dbLead.data.contact_id, ids.sellerContactId);
  assert.equal(dbLead.data.linked_property_id, ids.propertyId);
  const pipeline = await api("/api/admin/commercial/pipeline");
  expectStatus(pipeline, 200, "pipeline read");
  const cards = Array.isArray(pipeline.body.cards) ? pipeline.body.cards : [];
  assert(cards.some((card) => objectValue(card, "pipeline card").id === ids.sellerCaseId));
  assert(cards.some((card) => objectValue(card, "pipeline card").id === ids.buyerCaseId));
  record("Bien → Pipeline", `dossiers vendeur/acquéreur visibles et étape SELLER_MARKETED persistée`);
  record("Realtime PostgreSQL", "événement UPDATE reçu sur public.leads");
}

async function createAndReportVisit() {
  const invalidVisit = await post("/api/admin/commercial/visites", {
    action: "create",
    propertyId: crypto.randomUUID(),
    contactId: ids.buyerContactId,
    leadId: ids.buyerCaseId,
    assignedTo: ids.adminUserId,
    startsAt: futureStart.toISOString(),
    endsAt: futureEnd.toISOString(),
    location: "Toulon",
    notes: runId,
  });
  expectStatus(invalidVisit, 409, "unknown property visit");

  const created = await post("/api/admin/commercial/visites", {
    action: "create",
    propertyId: ids.propertyId,
    contactId: ids.buyerContactId,
    leadId: ids.buyerCaseId,
    assignedTo: ids.adminUserId,
    startsAt: futureStart.toISOString(),
    endsAt: futureEnd.toISOString(),
    location: `Toulon ${runId}`,
    notes: runId,
  });
  expectStatus(created, 201, "create visit");
  ids.visitId = stringValue(created.body.id, "visit id");

  const confirmed = await verifyResourceLiveSync("visites", ids.visitId, "TO_CONFIRM", "Confirmée", {
    action: "set-status",
    id: ids.visitId,
    status: "CONFIRMED",
  });
  expectStatus(confirmed, 200, "confirm visit");
  const invalidReschedule = await post("/api/admin/commercial/visites", {
    action: "reschedule",
    id: ids.visitId,
    startsAt: rescheduledEnd.toISOString(),
    endsAt: rescheduledStart.toISOString(),
  });
  expectStatus(invalidReschedule, 400, "invalid visit reschedule");
  const rescheduled = await verifyVisitCalendarAndReport({
    action: "reschedule",
    id: ids.visitId,
    startsAt: rescheduledStart.toISOString(),
    endsAt: rescheduledEnd.toISOString(),
  });
  expectStatus(rescheduled, 200, "reschedule visit");
  const report = await post("/api/admin/commercial/visites", {
    action: "submit-report",
    id: ids.visitId,
    generalImpression: "POSITIVE",
    positivePoints: ["Localisation", "Luminosité"],
    blockingPoints: ["Travaux mineurs"],
    interestLevel: 4,
    comments: `${runId} compte rendu complet`,
    nextAction: "FOLLOW_UP_LATER",
    followUpAt: followUpAt.toISOString(),
  });
  expectStatus(report, 200, "visit report");
  const reportResult = objectValue(report.body.result, "visit report result");
  ids.followUpTaskId = stringValue(reportResult.task_id, "follow-up task id");
  assert.equal(reportResult.next_action, "FOLLOW_UP_LATER");

  const [visit, task] = await Promise.all([
    supabase.from("appointments").select("visit_status,starts_at,report_next_action,property_id,contact_id,lead_id").eq("id", ids.visitId).single(),
    supabase.from("tasks").select("id,due_at,status,appointment_id").eq("id", ids.followUpTaskId).single(),
  ]);
  assert.ifError(visit.error);
  assert.ifError(task.error);
  assert.equal(visit.data.visit_status, "COMPLETED");
  assert.equal(visit.data.report_next_action, "FOLLOW_UP_LATER");
  assert.equal(
    new Date(visit.data.starts_at).getTime(),
    rescheduledStart.getTime(),
  );
  assert.equal(task.data.appointment_id, ids.visitId);
  assert.equal(task.data.status, "TODO");
  assert(task.data.due_at);
  assert.equal(new Date(task.data.due_at).getTime(), followUpAt.getTime());
  const detail = await api(`/api/admin/commercial/visites?id=${ids.visitId}`);
  expectStatus(detail, 200, "visit detail");
  record("Pipeline → Visite", `visit=${ids.visitId}, confirmation et replanification persistées`);
  record("FOLLOW_UP_LATER", `task=${ids.followUpTaskId}, date=${followUpAt.toISOString()}`);
}

async function verifyPipelineOrder() {
  const second = await post('/api/admin/commercial/pipeline', {
    action: 'create-case', contactId: ids.rollbackContactId, pipelineType: 'BUYER',
    assignedTo: ids.adminUserId, propertyId: null, estimationId: null,
    priority: 'normal', title: `${runId} Ordre`, notes: runId,
  });
  expectStatus(second, 201, 'second ordering case');
  const targetId = stringValue(second.body.id, 'ordering target');
  const before = await supabase.from('leads').select('status,pipeline_stage,stage_entered_at,updated_at').eq('id', ids.buyerCaseId).single();
  assert.ifError(before.error);
  const input = { action: 'reorder', id: ids.buyerCaseId, targetId, stage: 'BUYER_NEW', placement: 'before' };
  expectStatus(await post('/api/admin/commercial/pipeline', input), 200, 'reorder before');
  async function readOrder() {
    const result = await api('/api/admin/commercial/pipeline');
    expectStatus(result, 200, 'read persisted ordering');
    return (result.body.cards as JsonObject[]).filter(c => c.stage === 'BUYER_NEW').map(c => c.id);
  }
  let order = await readOrder();
  assert(order.indexOf(ids.buyerCaseId) < order.indexOf(targetId));
  expectStatus(await post('/api/admin/commercial/pipeline', { ...input, placement: 'after' }), 200, 'reorder after');
  order = await readOrder();
  assert(order.indexOf(ids.buyerCaseId) > order.indexOf(targetId));
  const after = await supabase.from('leads').select('status,pipeline_stage,stage_entered_at,updated_at').eq('id', ids.buyerCaseId).single();
  assert.ifError(after.error);
  assert.deepEqual(after.data, before.data, 'ordering must not mutate business dates/status');
  const saved = await supabase.from('commercial_pipeline_order').select('*').in('lead_id', [ids.buyerCaseId, targetId]).order('position');
  assert.ifError(saved.error);
  const readOnlyCookie = await login(readOnlyEmail);
  expectStatus(await post('/api/admin/commercial/pipeline', input, readOnlyCookie), 403, 'readonly reorder');
  expectStatus(await post('/api/admin/commercial/pipeline', { ...input, stage: 'SELLER_MARKETED' }), 409, 'stale stage reorder');
  expectStatus(await post('/api/admin/commercial/pipeline', { ...input, targetId: 'invalid' }), 400, 'invalid reorder');
  expectStatus(await post('/api/admin/commercial/pipeline', { ...input, targetId: crypto.randomUUID() }), 409, 'missing reorder');
  const unchanged = await supabase.from('commercial_pipeline_order').select('*').in('lead_id', [ids.buyerCaseId, targetId]).order('position');
  assert.deepEqual(unchanged.data, saved.data);
  const anonymous = createClient<Database>(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const args = { p_lead_id: ids.buyerCaseId, p_target_id: targetId, p_stage: 'BUYER_NEW', p_placement: 'before', p_actor_id: ids.adminUserId };
  assert((await anonymous.rpc('reorder_commercial_pipeline', args)).error);
  assert((await anonymous.from('commercial_pipeline_order').select('*')).error);
  assert.ifError((await anonymous.auth.signInWithPassword({ email: adminEmail, password: userPassword })).error);
  assert((await anonymous.rpc('reorder_commercial_pipeline', args)).error, 'authenticated RPC must be denied');
  assert((await supabase.rpc('reorder_commercial_pipeline', { ...args, p_actor_id: ids.readOnlyUserId })).error);
  try {
    assert.ifError((await supabase.from('profiles').update({ role: 'AGENT' }).eq('id', ids.readOnlyUserId)).error);
    expectStatus(await post('/api/admin/commercial/pipeline', input, readOnlyCookie), 403, 'agent other owner reorder');
    assert((await supabase.rpc('reorder_commercial_pipeline', { ...args, p_actor_id: ids.readOnlyUserId })).error, 'SQL ownership check');
    assert.ifError((await supabase.from('profiles').update({ role: 'ASSISTANT' }).eq('id', ids.readOnlyUserId)).error);
    expectStatus(await post('/api/admin/commercial/pipeline', input, readOnlyCookie), 200, 'assistant lead.write reorder');
  } finally {
    assert.ifError((await supabase.from('profiles').update({ role: 'READ_ONLY' }).eq('id', ids.readOnlyUserId)).error);
  }
  // Two serialized relative edits must leave a coherent total order.
  const concurrent = await Promise.all([
    post('/api/admin/commercial/pipeline', input),
    post('/api/admin/commercial/pipeline', { ...input, placement: 'after' }),
  ]);
  concurrent.forEach(result => expectStatus(result, 200, 'concurrent reorder'));
  const positions = await supabase.from('commercial_pipeline_order').select('position').eq('stage', 'BUYER_NEW');
  assert.ifError(positions.error);
  assert.equal(new Set(positions.data.map(row => row.position)).size, positions.data.length);
  expectStatus(await post('/api/admin/commercial/pipeline', { action: 'move-stage', id: targetId, stage: 'BUYER_QUALIFIED' }), 200, 'move clears old rank');
  const cleared = await supabase.from('commercial_pipeline_order').select('*').eq('lead_id', targetId);
  assert.ifError(cleared.error);
  assert.deepEqual(cleared.data, []);
  record('Classement Kanban persisté', 'avant/après, relecture API, dates inchangées, concurrence, rollback et suppression du rang au changement d’étape');
  record('Sécurité classement', 'lecture seule, payload invalide, étape périmée, cible absente, RPC anon/auth et acteur interdit refusés');
}

async function createOfferAndDocument() {
  const prefill = await api(
    `/api/admin/commercial/offres?bien_id=${ids.propertyId}&contact_id=${ids.buyerContactId}&visite_id=${ids.visitId}`,
  );
  expectStatus(prefill, 200, "offer prefill");
  const prefillData = objectValue(prefill.body.prefill, "offer prefill");
  assert.equal(prefillData.propertyId, ids.propertyId);
  assert.equal(prefillData.contactId, ids.buyerContactId);
  assert.equal(prefillData.visitId, ids.visitId);
  assert.equal(prefillData.buyerDossierId, ids.buyerCaseId);

  const invalidAmount = await post("/api/admin/commercial/offres", {
    action: "create",
    submission: "draft",
    propertyId: ids.propertyId,
    buyerDossierId: ids.buyerCaseId,
    buyerContactId: ids.buyerContactId,
    visitId: ids.visitId,
    responsibleUserId: ids.adminUserId,
    amount: 0,
    offerDate: today,
    validUntil,
    financingType: "LOAN",
  });
  expectStatus(invalidAmount, 400, "invalid offer amount");

  const draft = await post("/api/admin/commercial/offres", {
    action: "create",
    submission: "draft",
    propertyId: ids.propertyId,
    buyerDossierId: ids.buyerCaseId,
    buyerContactId: ids.buyerContactId,
    visitId: ids.visitId,
    responsibleUserId: ids.adminUserId,
    amount: 405000,
    offerDate: today,
    validUntil,
    financingType: "LOAN",
    downPaymentAmount: 105000,
    loanAmount: 300000,
    suspensiveConditions: "Financement bancaire",
    includedFurniture: "Aucun",
    negotiationComment: runId,
  });
  expectStatus(draft, 201, "create draft offer");
  const draftResult = objectValue(draft.body.result, "draft result");
  ids.draftOfferId = stringValue(draftResult.offer_id, "draft offer id");
  assert.equal(draftResult.status, "DRAFT");

  const invalidTransition = await post("/api/admin/commercial/offres", {
    action: "set-status",
    id: ids.draftOfferId,
    status: "ACCEPTED",
  });
  expectStatus(invalidTransition, 409, "invalid offer transition");

  const finalized = await verifyResourceLiveSync("offres", ids.draftOfferId, "DRAFT", "À signer", {
    action: "set-status",
    id: ids.draftOfferId,
    status: "TO_BE_SIGNED",
  });
  expectStatus(finalized, 200, "finalize draft offer");

  const form = new FormData();
  form.set("offerId", ids.draftOfferId);
  form.set("documentType", "E2E_PROOF");
  form.set("file", new File([`Proof ${runId}`], `${runId}.txt`, { type: "text/plain" }));
  const refusedFile = await api("/api/admin/commercial/offres", { method: "POST", body: form });
  expectStatus(refusedFile, 400, "forbidden document type");

  const pdf = new FormData();
  pdf.set("offerId", ids.draftOfferId);
  pdf.set("documentType", "E2E_PROOF");
  pdf.set("file", new File([`%PDF-1.4\n${runId}\n%%EOF`], `${runId}.pdf`, { type: "application/pdf" }));
  const upload = await api("/api/admin/commercial/offres", { method: "POST", body: pdf });
  expectStatus(upload, 201, "upload offer document");
  ids.documentId = stringValue(upload.body.id, "offer document id");
  const signed = await api(`/api/admin/commercial/offres?documentId=${ids.documentId}`);
  expectStatus(signed, 200, "signed offer document URL");
  const download = await fetch(stringValue(signed.body.url, "signed URL"));
  assert.equal(download.status, 200);
  assert((await download.text()).includes(runId));
  const deleted = await api(`/api/admin/commercial/offres?documentId=${ids.documentId}`, { method: "DELETE" });
  expectStatus(deleted, 200, "delete offer document");
  const deletedMetadata = await supabase.from("offer_documents").select("id").eq("id", ids.documentId).maybeSingle();
  assert.ifError(deletedMetadata.error);
  assert.equal(deletedMetadata.data, null);

  const offer = await supabase
    .from("offers")
    .select("id,status,property_id,buyer_contact_id,buyer_dossier_id,created_from_visit_id,amount")
    .eq("id", ids.draftOfferId)
    .single();
  assert.ifError(offer.error);
  assert.equal(offer.data.status, "TO_BE_SIGNED");
  assert.equal(offer.data.property_id, ids.propertyId);
  assert.equal(offer.data.buyer_contact_id, ids.buyerContactId);
  assert.equal(offer.data.created_from_visit_id, ids.visitId);
  record("Visite → Offre", `préremplissage réel, draft=${ids.draftOfferId}, finalisation persistée`);
  record("Document Offre", "upload PDF, métadonnées, URL signée, téléchargement et suppression");
}

async function createNegotiationAndNewOffer() {
  for (const status of ["SIGNED_BY_BUYER", "SENT_TO_SELLER", "NEGOTIATING"] as const) {
    const transition = await post("/api/admin/commercial/offres", {
      action: "set-status",
      id: ids.draftOfferId,
      status,
    });
    expectStatus(transition, 200, `offer transition ${status}`);
  }
  const negotiationQuery = await supabase
    .from("negotiations")
    .select("id,offer_id,property_id,buyer_contact_id,status,current_amount")
    .eq("offer_id", ids.draftOfferId)
    .single();
  assert.ifError(negotiationQuery.error);
  ids.negotiationId = negotiationQuery.data.id;
  assert.equal(negotiationQuery.data.property_id, ids.propertyId);
  assert.equal(negotiationQuery.data.buyer_contact_id, ids.buyerContactId);

  const counter = await post("/api/admin/commercial/negotiations", {
    action: "counter-offer",
    negotiationId: ids.negotiationId,
    amount: 412000,
    authorRole: "SELLER",
    comment: `${runId} contre-proposition`,
    responseDeadline: validUntil,
  });
  expectStatus(counter, 201, "counter offer");
  ids.negotiationStepId = stringValue(counter.body.stepId, "negotiation step id");
  await verifyNegotiationLiveSync();

  const reminderBefore = await supabase
    .from("negotiation_exchanges")
    .select("id", { count: "exact", head: true })
    .eq("negotiation_id", ids.negotiationId);
  const reminder = await post("/api/admin/commercial/negotiations", {
    action: "client-reminder",
    negotiationId: ids.negotiationId,
    recipientRole: "BUYER",
    channel: "EMAIL",
    subject: `${runId} suivi`,
    message: `${runId} aucun faux envoi`,
  });
  expectStatus(reminder, 503, "provider absent");
  assert.equal(objectValue(reminder.body.error, "reminder error").code, "COMMUNICATION_PROVIDER_NOT_CONFIGURED");
  const reminderAfter = await supabase
    .from("negotiation_exchanges")
    .select("id", { count: "exact", head: true })
    .eq("negotiation_id", ids.negotiationId);
  assert.equal(reminderAfter.count, reminderBefore.count);

  const canonicalPrefill = await api(
    `/api/admin/commercial/offres?bien_id=${ids.propertyId}&contact_id=${ids.buyerContactId}`,
  );
  expectStatus(canonicalPrefill, 200, "negotiation new offer prefill");
  const canonical = objectValue(canonicalPrefill.body.prefill, "canonical prefill");
  assert.equal(canonical.propertyId, ids.propertyId);
  assert.equal(canonical.contactId, ids.buyerContactId);
  assert.equal(canonical.buyerDossierId, ids.buyerCaseId);

  const newOffer = await post("/api/admin/commercial/offres", {
    action: "create",
    submission: "create",
    propertyId: ids.propertyId,
    buyerDossierId: ids.buyerCaseId,
    buyerContactId: ids.buyerContactId,
    visitId: null,
    responsibleUserId: ids.adminUserId,
    amount: 412000,
    offerDate: today,
    validUntil,
    financingType: "LOAN",
    downPaymentAmount: 112000,
    loanAmount: 300000,
    suspensiveConditions: "Financement bancaire",
    includedFurniture: "Aucun",
    negotiationComment: `${runId} nouvelle offre depuis négociation`,
  });
  expectStatus(newOffer, 201, "new offer from negotiation");
  const newOfferResult = objectValue(newOffer.body.result, "new offer result");
  ids.newOfferId = stringValue(newOfferResult.offer_id, "new offer id");
  assert.equal(newOfferResult.status, "TO_BE_SIGNED");

  const acceptedOffersPath = "/api/admin/commercial/offres?status=ACCEPTED";
  const acceptedOffersBefore = await api(acceptedOffersPath);
  expectStatus(acceptedOffersBefore, 200, "accepted offers before decision");
  const acceptedCountBefore = objectValue(
    acceptedOffersBefore.body.stats,
    "offer stats",
  ).acceptedThisMonth;
  assert(typeof acceptedCountBefore === "number", "monthly acceptance KPI must be numeric");

  const decision = await post("/api/admin/commercial/negotiations", {
    action: "decision",
    negotiationId: ids.negotiationId,
    decision: "ACCEPTED",
    comment: `${runId} décision contrôlée`,
  });
  expectStatus(decision, 200, "negotiation decision");
  const [negotiation, originalOffer, createdOffer] = await Promise.all([
    supabase.from("negotiations").select("status,current_amount,property_id,buyer_contact_id").eq("id", ids.negotiationId).single(),
    supabase.from("offers").select("status").eq("id", ids.draftOfferId).single(),
    supabase.from("offers").select("property_id,buyer_contact_id,buyer_dossier_id,status").eq("id", ids.newOfferId).single(),
  ]);
  assert.ifError(negotiation.error);
  assert.ifError(originalOffer.error);
  assert.ifError(createdOffer.error);
  assert.equal(negotiation.data.status, "ACCEPTED");
  assert.equal(originalOffer.data.status, "ACCEPTED");
  assert.equal(createdOffer.data.property_id, ids.propertyId);
  assert.equal(createdOffer.data.buyer_contact_id, ids.buyerContactId);
  assert.equal(createdOffer.data.buyer_dossier_id, ids.buyerCaseId);
  const acceptedOffersAfter = await api(acceptedOffersPath);
  expectStatus(acceptedOffersAfter, 200, "accepted offers after decision");
  assert.equal(
    objectValue(acceptedOffersAfter.body.stats, "offer stats").acceptedThisMonth,
    acceptedCountBefore + 1,
    "accepting a negotiation must increment the current-month offer KPI",
  );
  record("Offre → Négociation", `negotiation=${ids.negotiationId}, contre-proposition et décision acceptée`);
  record("Offres acceptées ce mois", "une décision acceptée incrémente le compteur de la liste Offres");
  record("Négociation → Nouvelle offre", `offer=${ids.newOfferId}, mêmes bien/contact/dossier`);
  record("Communication optionnelle", "provider absent → 503 explicite et 0 faux échange créé");
}

function chromeExecutable() {
  const configured = process.env.CRM_E2E_CHROME_PATH;
  if (configured && existsSync(configured)) return configured;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const executable = candidates.find((candidate) => existsSync(candidate));
  assert(executable, "Chrome or Edge is required for CRM E2E browser verification");
  return executable;
}

async function addAdminCookies(context: BrowserContext, cookie = adminCookie) {
  const cookies = cookie.split("; ").map((entry) => {
    const separator = entry.indexOf("=");
    return {
      name: entry.slice(0, separator),
      value: entry.slice(separator + 1),
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax" as const,
    };
  });
  await context.addCookies(cookies);
}

async function assertPage(page: Page, path: string, text?: string) {
  const errors: string[] = [];
  const startedHere = new Set<BrowserRequest>();
  const cancelledReads = new Set<string>();
  const successfulReads = new Set<string>();
  const onRequest = (request: BrowserRequest) => startedHere.add(request);
  const onPageError = (error: Error) => errors.push(error.message);
  const onRequestFailed = (request: BrowserRequest) => {
    // Navigation intentionally aborts the previous screen's reads/stream.
    // Keep failures of every request initiated by this page check visible.
    if (!startedHere.has(request)) return;
    if (request.failure()?.errorText === "net::ERR_ABORTED" && request.method() === "GET" && request.url().includes("/api/admin/commercial/")) {
      cancelledReads.add(request.url());
      return;
    }
    errors.push(`Request failed ${request.url()}: ${request.failure()?.errorText ?? "unknown"}`);
  };
  const onResponse = (response: { status(): number; url(): string }) => {
    if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${response.url()}`);
    if (response.status() === 200) successfulReads.add(response.url());
  };
  page.on("pageerror", onPageError);
  page.on("request", onRequest);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);
  try {
    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `${path} did not return 200`);
    assert(!page.url().includes("/admin/login"), `${path} redirected to login`);
    if (text) await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15_000 });
    await page.locator("main").first().waitFor({ state: "visible", timeout: 15_000 });
    // React development remounts can cancel an AbortSignal-aware initial read.
    // It is acceptable only if the same URL recovers successfully, never silently.
    await expect.poll(() => [...cancelledReads].filter(url => !successfulReads.has(url)), { timeout: 10_000 }).toEqual([]);
    if (cancelledReads.size) console.log(`PASS Requêtes annulées récupérées — ${path}: ${cancelledReads.size} URL relue avec succès`);
    assert.deepEqual(errors, []);
  } finally {
    page.off("request", onRequest);
    page.off("pageerror", onPageError);
    page.off("requestfailed", onRequestFailed);
    page.off("response", onResponse);
  }
}

async function verifyBrowser() {
  browser = await chromium.launch({ headless: true, executablePath: chromeExecutable() });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await addAdminCookies(context);
  const page = await context.newPage();
  const paths: Array<[string, string?]> = [
    ["/commercial/pipeline", runId],
    ["/commercial/estimations", runId],
    [`/commercial/estimations/${ids.estimationId}`, runId],
    ["/commercial/visites", runId],
    ["/commercial/visites/calendrier"],
    [`/commercial/visites/${ids.visitId}`, runId],
    ["/commercial/offres", runId],
    [`/commercial/offres/${ids.draftOfferId}`, runId],
    ["/commercial/negociations", runId],
    [`/commercial/negociations/${ids.negotiationId}`, runId],
  ];
  // Each route smoke owns its document: an outgoing live screen can start a
  // reconciliation while navigation commits, then correctly abort that read.
  for (const [path, text] of paths) {
    const routePage = await context.newPage();
    try { await assertPage(routePage, path, text); }
    finally { await routePage.close(); }
  }

  await assertPage(
    page,
    `/commercial/offres/nouvelle?bien_id=${ids.propertyId}&contact_id=${ids.buyerContactId}&visite_id=${ids.visitId}`,
  );
  for (const [name, expected] of [
    ["propertyId", ids.propertyId],
    ["buyerContactId", ids.buyerContactId],
    ["visitId", ids.visitId],
  ] as const) {
    assert(expected);
    const field = page.locator(`[name="${name}"]`);
    await field.waitFor({ state: "attached" });
    await page
      .waitForFunction(
        ({ fieldName, fieldValue }) =>
          (document.querySelector(`[name="${fieldName}"]`) as HTMLInputElement | null)?.value ===
          fieldValue,
        { fieldName: name, fieldValue: expected },
        { timeout: 10_000 },
      )
      .catch(() => undefined);
    const actual = await field.inputValue();
    const options = await field
      .locator("option")
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
    assert.equal(
      actual,
      expected,
      `${name} prefill mismatch; available options: ${options.join(",")}`,
    );
  }

  const propertyAdminPath = `/admin?tab=properties&property=${ids.propertyId}`;
  await assertPage(page, propertyAdminPath);
  assert.equal(new URL(page.url()).searchParams.get("property"), ids.propertyId);
  await context.close();
  record("Interface authentifiée", `${paths.length + 2} pages réelles vérifiées dans Chrome`);
  record("Préremplissage UI nouvelle offre", "bien_id, contact_id et visite_id présents dans les champs");
  record("URL du bien transformé", `${propertyAdminPath} retourne 200 et cible le bien brouillon`);
}

async function verifyLiveSync() {
  const liveBrowser = await chromium.launch({ headless: true, executablePath: chromeExecutable() });
  const writer = await liveBrowser.newContext({ viewport: { width: 1440, height: 1100 } });
  const reader = await liveBrowser.newContext({ viewport: { width: 1440, height: 1100 } });
  await addAdminCookies(writer);
  await addAdminCookies(reader, await login(readOnlyEmail));
  const a = await writer.newPage();
  const b = await reader.newPage();
  const errors: string[] = [];
  for (const page of [a, b]) page.on("pageerror", error => errors.push(error.message));
  await b.addInitScript(() => {
    const NativeEventSource = window.EventSource;
    const stats = { changes: 0, ready: 0, opened: 0 };
    Object.assign(window, { crmSyncTest: stats });
    window.EventSource = class extends NativeEventSource {
      constructor(url: string | URL, config?: EventSourceInit) {
        super(url, config);
        stats.opened++;
        this.addEventListener("change", () => { stats.changes++; });
        this.addEventListener("ready", () => { stats.ready++; });
      }
    };
  });
  const cardIn = (page: Page, column: string) => page.getByRole("region", { name: `Étape ${column}`, exact: true }).getByRole("button", { name: `${runId} Acquéreur`, exact: true });
  const move = async (stage: string) => expectStatus(await post("/api/admin/commercial/pipeline", { action: "move-stage", id: ids.buyerCaseId, stage }), 200, `sync move ${stage}`);
  const stats = () => b.evaluate(() => (window as unknown as { crmSyncTest: { changes: number; ready: number; opened: number } }).crmSyncTest);
  try {
    for (const endpoint of ["/api/admin/commercial/realtime", "/api/admin/commercial/negotiations/realtime"]) {
      assert.equal((await fetch(`${baseUrl}${endpoint}`)).status, 401, "stream without session");
    }
    await Promise.all([a.goto(`${baseUrl}/commercial/pipeline`), b.goto(`${baseUrl}/commercial/pipeline`)]);
    for (const page of [a, b]) await expect(page.getByTestId("commercial-sync-status")).toHaveText("Temps réel connecté", { timeout: 30_000 });
    await expect(cardIn(b, "Nouveau")).toBeVisible();
    const before = await stats();
    await move("BUYER_QUALIFIED");
    await expect.poll(async () => (await stats()).changes, { timeout: 10_000 }).toBeGreaterThan(before.changes);
    await expect(cardIn(b, "Qualifié")).toBeVisible({ timeout: 10_000 });
    await expect(cardIn(a, "Qualifié")).toBeVisible({ timeout: 10_000 });
    record("Realtime deux utilisateurs", "écriture API administrateur, événement SSE et déplacement visible sans rechargement dans deux sessions dont READ_ONLY");

    await cardIn(a, "Qualifié").click();
    await a.getByPlaceholder("Nouvelle tâche").fill(`${runId} Brouillon conservé`);
    await expect(a.getByTestId("commercial-sync-status")).toContainText("différée");
    await move("BUYER_NEW");
    await expect(cardIn(b, "Nouveau")).toBeVisible({ timeout: 10_000 });
    await expect(a.getByPlaceholder("Nouvelle tâche")).toHaveValue(`${runId} Brouillon conservé`);
    await a.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(cardIn(a, "Nouveau")).toBeVisible({ timeout: 10_000 });
    record("Protection des saisies", "brouillon intact pendant une modification distante, état rattrapé à la fermeture");

    await reader.setOffline(true);
    await expect(b.getByTestId("commercial-sync-status")).toContainText("Hors ligne");
    await move("BUYER_QUALIFIED");
    await reader.setOffline(false);
    await expect(cardIn(b, "Qualifié")).toBeVisible({ timeout: 15_000 });
    await expect(b.getByTestId("commercial-sync-status")).toHaveText("Temps réel connecté", { timeout: 20_000 });
    record("Reprise réseau", "coupure du lecteur, écriture distante, reconnexion et rattrapage automatiques");

    // Prove the fallback with the stream unavailable but the canonical API reachable.
    await b.route("**/api/admin/commercial/realtime", route => route.abort("connectionfailed"));
    await b.reload();
    await expect(b.getByTestId("commercial-sync-status")).toContainText("secours", { timeout: 10_000 });
    await expect(cardIn(b, "Qualifié")).toBeVisible();
    await move("BUYER_NEW");
    await expect(cardIn(b, "Nouveau")).toBeVisible({ timeout: 22_000 });
    record("Repli périodique", "SSE bloqué intentionnellement, état synchronisé par relecture API sans rechargement");
    await b.unroute("**/api/admin/commercial/realtime");
    await expect(b.getByTestId("commercial-sync-status")).toHaveText("Temps réel connecté", { timeout: 35_000 });
    const beforeRenew = await stats();
    await expect.poll(async () => (await stats()).ready, { timeout: 55_000 }).toBeGreaterThan(beforeRenew.ready);
    await move("BUYER_QUALIFIED");
    await expect(cardIn(b, "Qualifié")).toBeVisible({ timeout: 10_000 });
    await move("BUYER_NEW");
    await expect(cardIn(b, "Nouveau")).toBeVisible({ timeout: 10_000 });
    record("Renouvellement du flux", "réabonnement authentifié après 45 s, événements reçus après renouvellement");
    const pipeline = await api("/api/admin/commercial/pipeline");
    const target = (pipeline.body.cards as JsonObject[]).find(card => card.contactId === ids.rollbackContactId && card.pipelineType === "BUYER");
    assert(target, "ordering target exists");
    expectStatus(await post("/api/admin/commercial/pipeline", { action: "move-stage", id: target.id, stage: "BUYER_NEW" }), 200, "target new stage");
    await expect(b.getByRole("region", { name: "Étape Nouveau", exact: true }).getByRole("button", { name: `${runId} Rollback`, exact: true })).toBeVisible({ timeout: 10_000 });
    for (const placement of ["after", "before"]) {
      expectStatus(await post("/api/admin/commercial/pipeline", { action: "reorder", id: ids.buyerCaseId, targetId: target.id, stage: "BUYER_NEW", placement }), 200, `sync order ${placement}`);
      await expect.poll(async () => {
        const names = await b.getByRole("region", { name: "Étape Nouveau", exact: true }).getByRole("heading", { level: 3 }).allTextContents();
        return names.indexOf(`${runId} Acquéreur`) < names.indexOf(`${runId} Rollback`);
      }, { timeout: 10_000 }).toBe(placement === "before");
    }
    record("Classement partagé en direct", "ordre avant/après reçu dans la session READ_ONLY via les activités transactionnelles");
    assert.deepEqual(errors, [], "browser runtime errors");
  } finally { await liveBrowser.close(); }
}

async function verifyVisitCalendarAndReport(mutation: JsonObject) {
  const liveBrowser = await chromium.launch({ headless: true, executablePath: chromeExecutable() });
  const writer = await liveBrowser.newContext();
  const reader = await liveBrowser.newContext();
  await addAdminCookies(writer);
  await addAdminCookies(reader, await login(readOnlyEmail));
  const report = await writer.newPage();
  const calendar = await reader.newPage();
  const errors: string[] = [];
  for (const page of [report, calendar]) page.on("pageerror", error => errors.push(error.message));
  try {
    await Promise.all([report.goto(`${baseUrl}/commercial/visites/${ids.visitId}/compte-rendu`), calendar.goto(`${baseUrl}/commercial/visites/calendrier`)]);
    for (const page of [report, calendar]) await expect(page.getByTestId("commercial-sync-status")).toHaveText("Temps réel connecté", { timeout: 30_000 });
    await calendar.getByRole("button", { name: "Mois", exact: true }).click();
    const card = calendar.locator(`main a[href="/commercial/visites/${ids.visitId}"]`);
    await expect(card).toBeVisible();
    const previousColumn = await card.locator("..").locator("..").getByRole("heading").innerText();
    await report.locator('textarea[name="comments"]').fill("Compte rendu non envoyé à conserver");
    await expect(report.getByTestId("commercial-sync-status")).toContainText("différée");
    // Lose the stream, mutate remotely, then recover canonical state on reconnect.
    await reader.setOffline(true);
    await expect(calendar.getByTestId("commercial-sync-status")).toContainText("Hors ligne");
    const result = await post("/api/admin/commercial/visites", mutation);
    expectStatus(result, 200, "calendar remote reschedule");
    await reader.setOffline(false);
    await expect.poll(async () => card.locator("..").locator("..").getByRole("heading").innerText(), { timeout: 20_000 }).not.toBe(previousColumn);
    await expect(calendar.getByRole("button", { name: "Mois", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(report.locator('textarea[name="comments"]')).toHaveValue("Compte rendu non envoyé à conserver");
    report.once("dialog", dialog => dialog.accept());
    await report.getByRole("button", { name: "Abandonner le brouillon" }).click();
    await expect(report.getByTestId("commercial-sync-status")).toHaveText("Temps réel connecté", { timeout: 10_000 });
    // Explicit API failure must remain visible, then clear after recovery.
    await calendar.route("**/api/admin/commercial/visites?*", route => route.fulfill({ status: 503, json: { success: false, message: "Incident simulé de recette" } }));
    await expect(calendar.locator("main").getByRole("alert")).toContainText("Incident simulé de recette", { timeout: 20_000 });
    await expect(card).toBeVisible();
    await calendar.unroute("**/api/admin/commercial/visites?*");
    await expect(calendar.locator("main").getByRole("alert")).toHaveCount(0, { timeout: 20_000 });
    record("Calendrier et compte rendu synchronisés", "date déplacée après coupure réseau, mode mois conservé, brouillon CR protégé puis abandonné, erreur API visible puis reprise automatique");
    assert.deepEqual(errors, [], "calendar/report browser errors");
    return result;
  } finally { await liveBrowser.close(); }
}

async function verifyResourceLiveSync(resource: "estimations" | "visites" | "offres", id: string, oldStatus: string, newLabel: string, mutation: JsonObject) {
  const liveBrowser = await chromium.launch({ headless: true, executablePath: chromeExecutable() });
  const writer = await liveBrowser.newContext();
  const reader = await liveBrowser.newContext();
  await addAdminCookies(writer);
  await addAdminCookies(reader, await login(readOnlyEmail));
  const a = await writer.newPage();
  const b = await reader.newPage();
  const list = await reader.newPage();
  const errors: string[] = [];
  for (const page of [a, b, list]) page.on("pageerror", error => errors.push(error.message));
  await list.addInitScript(() => {
    const Native = window.EventSource;
    Object.assign(window, { resourceChanges: 0 });
    window.EventSource = class extends Native {
      constructor(url: string | URL, options?: EventSourceInit) {
        super(url, options);
        this.addEventListener("change", () => { const w = window as unknown as { resourceChanges: number }; w.resourceChanges++; });
      }
    };
  });
  const path = `/commercial/${resource}/${id}`;
  try {
    await Promise.all([a.goto(baseUrl + path), b.goto(baseUrl + path), list.goto(`${baseUrl}/commercial/${resource}?q=${runId}&status=${oldStatus}`)]);
    for (const page of [a, b, list]) await expect(page.getByTestId("commercial-sync-status")).toHaveText("Temps réel connecté", { timeout: 30_000 });
    await expect(list.locator(`main a[href="${path}"]`).first()).toBeVisible();
    if (resource === "estimations") {
      await a.getByRole("button", { name: "Modifier", exact: true }).click();
      await a.getByLabel("Notes internes", { exact: true }).fill("Brouillon estimation conservé");
    } else if (resource === "visites") {
      await a.getByLabel("Nouvelle date de début").fill("2030-01-02T10:00");
    } else await a.getByLabel("Nouveau statut de l’offre").selectOption("TO_BE_SIGNED");
    await expect(a.getByTestId("commercial-sync-status")).toContainText("différée");
    const before = await list.evaluate(() => (window as unknown as { resourceChanges: number }).resourceChanges);
    const result = await post(`/api/admin/commercial/${resource}`, mutation);
    expectStatus(result, 200, `remote ${resource} mutation`);
    await expect.poll(() => list.evaluate(() => (window as unknown as { resourceChanges: number }).resourceChanges), { timeout: 10_000 }).toBeGreaterThan(before);
    await expect(list.locator(`main a[href="${path}"]`)).toHaveCount(0, { timeout: 10_000 });
    assert.equal(new URL(list.url()).searchParams.get("status"), oldStatus, "active status filter retained");
    await expect(b.locator("main")).toContainText(newLabel, { timeout: 10_000 });
    if (resource === "estimations") {
      await expect(a.getByLabel("Notes internes", { exact: true })).toHaveValue("Brouillon estimation conservé");
      await a.getByRole("button", { name: "Modifier", exact: true }).click();
    } else if (resource === "visites") {
      await expect(a.getByLabel("Nouvelle date de début")).toHaveValue("2030-01-02T10:00");
      await a.getByRole("button", { name: "Annuler la saisie" }).click();
    } else {
      await expect(a.getByLabel("Nouveau statut de l’offre")).toHaveValue("TO_BE_SIGNED");
      await a.getByRole("button", { name: "Annuler la saisie" }).click();
    }
    await expect(a.getByTestId("commercial-sync-status")).toHaveText("Temps réel connecté", { timeout: 10_000 });
    await expect(a.locator("main")).toContainText(newLabel, { timeout: 10_000 });
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await b.setViewportSize({ width, height: 1000 });
      assert(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${resource} overflow ${width}`);
    }
    record(`Realtime ${resource}`, "événement SSE réel, fiche READ_ONLY actualisée, retrait de la liste filtrée, brouillon intact puis rattrapage, 7 largeurs sans débordement");
    assert.deepEqual(errors, [], `${resource} browser errors`);
    return result;
  } finally { await liveBrowser.close(); }
}

async function verifyNegotiationLiveSync() {
  const liveBrowser = await chromium.launch({ headless: true, executablePath: chromeExecutable() });
  const writer = await liveBrowser.newContext();
  const reader = await liveBrowser.newContext();
  await addAdminCookies(writer);
  await addAdminCookies(reader, await login(readOnlyEmail));
  const a = await writer.newPage();
  const b = await reader.newPage();
  const note = `${runId} Note synchronisée`;
  try {
    await Promise.all([a.goto(`${baseUrl}/commercial/negociations/${ids.negotiationId}`), b.goto(`${baseUrl}/commercial/negociations/${ids.negotiationId}`)]);
    for (const page of [a, b]) await expect(page.getByTestId("commercial-sync-status")).toHaveText("Temps réel connecté", { timeout: 30_000 });
    await a.getByRole("button", { name: "Contre-proposition", exact: true }).click();
    await a.locator("#counter-message").fill(`${runId} Proposition non envoyée`);
    expectStatus(await post("/api/admin/commercial/negotiations", { action: "remind", negotiationId: ids.negotiationId, comment: note }), 200, "sync internal note");
    await expect(b.getByText(note, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(a.locator("#counter-message")).toHaveValue(`${runId} Proposition non envoyée`);
    await a.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(a.getByText(note, { exact: true })).toBeVisible({ timeout: 10_000 });
    await b.goto(`${baseUrl}/commercial/negociations`);
    await expect(b.getByTestId("commercial-sync-status")).toHaveText("Temps réel connecté", { timeout: 30_000 });
    // The active hub and sidebar must re-fetch on a remote exchange.
    const refreshed = b.waitForResponse(response => new URL(response.url()).pathname === "/api/admin/commercial/negotiations" && response.status() === 200, { timeout: 10_000 });
    expectStatus(await post("/api/admin/commercial/negotiations", { action: "remind", negotiationId: ids.negotiationId, comment: `${note} hub` }), 200, "sync hub note");
    await refreshed;
    record("Realtime négociations", "note distante visible au détail, brouillon de contre-proposition conservé, hub actualisé");
  } finally { await liveBrowser.close(); }
}

async function verifyStats() {
  const pipeline = await api("/api/admin/commercial/pipeline");
  expectStatus(pipeline, 200, "pipeline statistics");
  const pipelineStats = objectValue(pipeline.body.stats, "pipeline stats");
  const totalLeads = Number(pipelineStats.total ?? 0);
  assert(totalLeads >= baselinePipelineTotal + 2);
  const visits = await api("/api/admin/commercial/visites");
  const offers = await api("/api/admin/commercial/offres");
  const negotiations = await api("/api/admin/commercial/negotiations");
  expectStatus(visits, 200, "visit stats");
  expectStatus(offers, 200, "offer stats");
  expectStatus(negotiations, 200, "negotiation stats");
  // The KPI is this week's visits, whereas the fixture may be rescheduled next week.
  const visitStats = await supabase.from("v_commercial_visit_week_stats").select("*").single();
  assert.ifError(visitStats.error);
  assert.equal(Number(objectValue(visits.body.stats, "visit stats").total ?? 0), Number(visitStats.data.total ?? 0));
  assert((visits.body.items as JsonObject[]).some(visit => visit.id === ids.visitId), "the persisted visit remains in the list");
  assert(Number(objectValue(offers.body.stats, "offer stats").total ?? 0) >= 2);
  assert(Number(objectValue(negotiations.body.meta, "negotiation meta").count ?? 0) >= 1);
  record(
    "Statistiques dynamiques",
    `pipeline=${totalLeads}, visite présente et KPI hebdomadaire exact (${visitStats.data.total}), offres≥2, négociations≥1 relus depuis Supabase`,
  );
}

async function cleanup() {
  await dropFailureTrigger();
  const contactIds = [ids.sellerContactId, ids.buyerContactId, ids.rollbackContactId].filter((id): id is string => Boolean(id));
  const userIds = [ids.adminUserId, ids.readOnlyUserId].filter((id): id is string => Boolean(id));
  const estimationIds = new Set(
    [ids.estimationId, ids.rollbackEstimationId].filter((id): id is string => Boolean(id)),
  );
  const propertyIds = new Set(
    [ids.propertyId].filter((id): id is string => Boolean(id)),
  );
  const leadIds = new Set(
    [ids.sellerCaseId, ids.buyerCaseId].filter((id): id is string => Boolean(id)),
  );
  const visitIds = new Set(
    [ids.visitId].filter((id): id is string => Boolean(id)),
  );
  const offerIds = new Set(
    [ids.draftOfferId, ids.newOfferId].filter((id): id is string => Boolean(id)),
  );
  const negotiationIds = new Set(
    [ids.negotiationId].filter((id): id is string => Boolean(id)),
  );
  const mandateIds = new Set(
    [ids.mandateId].filter((id): id is string => Boolean(id)),
  );

  if (contactIds.length) {
    const [estimations, leads, visits, offers, negotiations] = await Promise.all([
      supabase
        .from("estimations")
        .select("id,converted_property_id")
        .in("contact_id", contactIds),
      supabase
        .from("leads")
        .select("id,linked_property_id")
        .in("contact_id", contactIds),
      supabase.from("appointments").select("id").in("contact_id", contactIds),
      supabase.from("offers").select("id").in("buyer_contact_id", contactIds),
      supabase.from("negotiations").select("id").in("buyer_contact_id", contactIds),
    ]);
    for (const query of [estimations, leads, visits, offers, negotiations]) {
      assert.ifError(query.error);
    }
    for (const row of estimations.data ?? []) {
      estimationIds.add(row.id);
      if (row.converted_property_id) propertyIds.add(row.converted_property_id);
    }
    for (const row of leads.data ?? []) {
      leadIds.add(row.id);
      if (row.linked_property_id) propertyIds.add(row.linked_property_id);
    }
    for (const row of visits.data ?? []) visitIds.add(row.id);
    for (const row of offers.data ?? []) offerIds.add(row.id);
    for (const row of negotiations.data ?? []) negotiationIds.add(row.id);
  }

  if (leadIds.size || propertyIds.size) {
    const mandates = leadIds.size
      ? await supabase
          .from("mandates")
          .select("id")
          .in("lead_id", [...leadIds])
      : await supabase
          .from("mandates")
          .select("id")
          .in("property_id", [...propertyIds]);
    assert.ifError(mandates.error);
    for (const row of mandates.data ?? []) mandateIds.add(row.id);
  }

  const negotiationIdList = [...negotiationIds];
  const offerIdList = [...offerIds];
  const visitIdList = [...visitIds];
  const leadIdList = [...leadIds];
  const estimationIdList = [...estimationIds];
  const propertyIdList = [...propertyIds];
  const mandateIdList = [...mandateIds];

  if (offerIdList.length) {
    for (const offerId of offerIdList) {
      const listed = await supabase.storage.from("offer-documents").list(offerId);
      assertOperation(listed, `list offer documents for ${offerId}`);
      if (listed.data?.length) {
        assertOperation(
          await supabase.storage
            .from("offer-documents")
            .remove(listed.data.map((item) => `${offerId}/${item.name}`)),
          `remove offer documents for ${offerId}`,
        );
      }
    }
  }
  if (negotiationIdList.length) {
    const deletions = await Promise.all([
      supabase.from("negotiation_alert_events").delete().in("negotiation_id", negotiationIdList),
      supabase.from("negotiation_documents").delete().in("negotiation_id", negotiationIdList),
      supabase.from("negotiation_exchanges").delete().in("negotiation_id", negotiationIdList),
      supabase.from("negotiation_steps").delete().in("negotiation_id", negotiationIdList),
    ]);
    deletions.forEach((result, index) => assertOperation(result, `delete negotiation child ${index}`));
    assertOperation(
      await supabase.from("negotiations").delete().in("id", negotiationIdList),
      "delete negotiations",
    );
  }
  if (offerIdList.length) {
    const deletions = await Promise.all([
      supabase.from("offer_documents").delete().in("offer_id", offerIdList),
      supabase.from("offer_status_history").delete().in("offer_id", offerIdList),
    ]);
    deletions.forEach((result, index) => assertOperation(result, `delete offer child ${index}`));
    assertOperation(await supabase.from("offers").delete().in("id", offerIdList), "delete offers");
  }
  if (visitIdList.length) assertOperation(await supabase.from("tasks").delete().in("appointment_id", visitIdList), "delete visit tasks");
  if (leadIdList.length) assertOperation(await supabase.from("tasks").delete().in("lead_id", leadIdList), "delete lead tasks");
  if (visitIdList.length) assertOperation(await supabase.from("appointments").delete().in("id", visitIdList), "delete visits");
  if (mandateIdList.length) assertOperation(await supabase.from("mandates").delete().in("id", mandateIdList), "delete mandates");
  if (leadIdList.length) assertOperation(await supabase.from("leads").delete().in("id", leadIdList), "delete leads");
  if (estimationIdList.length) assertOperation(await supabase.from("estimations").delete().in("id", estimationIdList), "delete estimations");
  if (propertyIdList.length) assertOperation(await supabase.from("properties").delete().in("id", propertyIdList), "delete properties");
  if (contactIds.length) assertOperation(await supabase.from("contacts").delete().in("id", contactIds), "delete contacts");
  if (userIds.length) {
    assertOperation(await supabase.from("audit_logs").delete().in("actor_id", userIds), "delete audit logs");
    assertOperation(await supabase.from("activities").delete().in("actor_id", userIds), "delete activities");
    assertOperation(await supabase.from("profiles").delete().in("id", userIds), "delete profiles");
  }
  for (const userId of userIds) {
    assertOperation(await supabase.auth.admin.deleteUser(userId), `delete auth user ${userId}`);
  }

  const remaining = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).ilike("notes", `%${runId}%`),
    supabase.from("estimations").select("id", { count: "exact", head: true }).ilike("notes", `%${runId}%`),
    supabase.from("leads").select("id", { count: "exact", head: true }).ilike("title", `%${runId}%`),
    supabase.from("appointments").select("id", { count: "exact", head: true }).ilike("comment", `%${runId}%`),
    supabase.from("offers").select("id", { count: "exact", head: true }).ilike("notes", `%${runId}%`),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).in("actor_email", [adminEmail, readOnlyEmail]),
  ]);
  for (const query of remaining) {
    assert.ifError(query.error);
    assert.equal(query.count, 0);
  }
  assert.equal(await readPipelineStatsTotal(), baselinePipelineTotal);
  record("Cleanup", `${runId} → 0 enregistrement restant`);
  record(
    "Statistiques après cleanup",
    `vue pipeline revenue au total initial ${baselinePipelineTotal}`,
  );
}

async function main() {
  assertSafeTarget();
  verifyRemoteProjectIdentity();
  console.log(`CRM E2E isolated run ${runId}`);
  let scenarioError: unknown;
  let cleanupError: unknown;
  try {
    baselinePipelineTotal = await readPipelineStatsTotal();
    await seedUsersAndContacts();
    server = startServer();
    await waitForServer();
    adminCookie = await login(adminEmail);
    if (process.argv.includes("--properties")) {
      browser = await chromium.launch({ headless: true, executablePath: chromeExecutable() });
      const writer = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const reader = await browser.newContext();
      await addAdminCookies(writer);
      await addAdminCookies(reader, await login(readOnlyEmail));
      await verifyPropertyWorkspace({
        browserContext: writer, readOnlyContext: reader, supabase,
        anonymous: createClient<Database>(supabaseUrl, anonKey, { auth: { persistSession: false } }),
        baseUrl, runId, adminId: ids.adminUserId, ownerId: ids.sellerContactId,
        buyerId: ids.buyerContactId, runSql, record,
      });
    } else {
      await verifySecurity();
      await verifyRollback();
      await transformEstimation();
      await verifyPipelineAndRealtime();
      await verifyLiveSync();
      await createAndReportVisit();
      await createOfferAndDocument();
      await createNegotiationAndNewOffer();
      await verifyStats();
      await verifyBrowser();
    }
  } catch (error) {
    scenarioError = error;
    results.push({
      check: "Scénario E2E",
      status: "FAIL",
      evidence: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server) {
      server.kill();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    try {
      await cleanup();
    } catch (error) {
      cleanupError = error;
      results.push({
        check: "Cleanup",
        status: "FAIL",
        evidence: error instanceof Error ? error.message : String(error),
      });
    }
    supabase.realtime.disconnect();
    const report = JSON.stringify({ runId, projectRef, createdIds: ids, results }, null, 2);
    const reportDirectory = join(repoRoot, "work", "commercial-e2e");
    mkdirSync(reportDirectory, { recursive: true });
    writeFileSync(join(reportDirectory, `${runId}.json`), report, { flag: "wx" });
    console.log(report);
  }
  if (scenarioError && cleanupError) {
    throw new AggregateError(
      [scenarioError, cleanupError],
      "CRM E2E scenario and cleanup both failed",
    );
  }
  if (scenarioError) throw scenarioError;
  if (cleanupError) throw cleanupError;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

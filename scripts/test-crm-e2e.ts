import assert from "node:assert/strict";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createClient, type RealtimeChannelOptions } from "@supabase/supabase-js";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { Database } from "../src/types/supabase";

type JsonObject = Record<string, unknown>;

type RealtimeReadinessOptions = RealtimeChannelOptions & {
  config: RealtimeChannelOptions["config"] & {
    broadcast: NonNullable<RealtimeChannelOptions["config"]["broadcast"]> & {
      replication_ready: boolean;
    };
  };
};

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
const productionRefPath = `${repoRoot}\\supabase\\.temp\\project-ref`;
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
  assert(supabaseUrl.includes(projectRef), "Supabase URL and E2E project ref mismatch");
  if (existsSync(productionRefPath)) {
    const productionRef = readFileSync(productionRefPath, "utf8").trim();
    assert.notEqual(projectRef, productionRef, "Refusing to mutate the linked production project");
  }
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

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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
  const nextBin = `${repoRoot}\\node_modules\\next\\dist\\bin\\next`;
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
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
  });
  child.stdout.on("data", () => undefined);
  child.stderr.on("data", () => undefined);
  return child;
}

function runSql(sql: string) {
  const sqlPath = join(tmpdir(), `immo-crm-e2e-${crypto.randomUUID()}.sql`);
  writeFileSync(sqlPath, sql, { encoding: "utf8", flag: "wx" });
  try {
    const args = ["supabase", "db", "query", "--linked", "--project-ref", projectRef, "--file", sqlPath];
    const execution = process.platform === "win32"
      ? spawnSync(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", `npx.cmd ${args.join(" ")}`],
          { cwd: repoRoot, encoding: "utf8" },
        )
      : spawnSync("npx", args, { cwd: repoRoot, encoding: "utf8" });
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

async function verifyLeadRealtimeReadiness() {
  const failures: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const realtimeClient = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const marker = `${runId} Realtime tentative ${attempt} ${crypto.randomUUID()}`;
    let channel: ReturnType<typeof realtimeClient.channel> | null = null;

    try {
      const login = await realtimeClient.auth.signInWithPassword({
        email: adminEmail,
        password: userPassword,
      });
      assert.ifError(login.error);
      const accessToken = login.data.session?.access_token;
      assert(accessToken, "Authenticated Realtime session is missing an access token");
      await realtimeClient.realtime.setAuth(accessToken);

      let realtimeResolve: (() => void) | null = null;
      const realtimeEvent = new Promise<void>((resolve) => {
        realtimeResolve = resolve;
      });
      let replicationResolve: (() => void) | null = null;
      const replicationReady = new Promise<void>((resolve) => {
        replicationResolve = resolve;
      });
      const readinessOptions: RealtimeReadinessOptions = {
        config: { broadcast: { replication_ready: true } },
      };

      channel = realtimeClient
        .channel(`${runId}-pipeline-${attempt}-${crypto.randomUUID()}`, readinessOptions)
        .on("system", {}, (payload) => {
          if (
            payload &&
            typeof payload === "object" &&
            payload.extension === "system" &&
            payload.status === "ok"
          ) {
            replicationResolve?.();
          }
        })
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "leads",
            filter: `id=eq.${ids.sellerCaseId}`,
          },
          (payload) => {
            const updated = objectValue(payload.new, "realtime lead payload");
            if (updated.id === ids.sellerCaseId && updated.notes === marker) {
              realtimeResolve?.();
            }
          },
        );

      await withTimeout(
        new Promise<void>((resolve, reject) => {
          channel?.subscribe((status, error) => {
            if (status === "SUBSCRIBED") resolve();
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              reject(error ?? new Error(`Realtime channel status ${status}`));
            }
          });
        }),
        20_000,
        `Realtime subscription timeout (tentative ${attempt})`,
      );

      const replicationConfirmed = await Promise.race([
        replicationReady.then(() => true),
        delay(5_000).then(() => false),
      ]);
      if (!replicationConfirmed) await delay(attempt * 1_500);

      const mutation = await supabase
        .from("leads")
        .update({ notes: marker })
        .eq("id", ids.sellerCaseId)
        .select("id,notes")
        .single();
      assert.ifError(mutation.error);
      assert.equal(mutation.data.id, ids.sellerCaseId);
      assert.equal(mutation.data.notes, marker);

      await withTimeout(
        realtimeEvent,
        20_000,
        `Realtime update timeout (tentative ${attempt})`,
      );
      console.log(`PASS Realtime readiness — événement observable reçu à la tentative ${attempt}/3`);
      return attempt;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`tentative ${attempt}: ${message}`);
      console.warn(`Realtime readiness ${failures.at(-1)}`);
    } finally {
      if (channel) await realtimeClient.removeChannel(channel).catch(() => undefined);
      realtimeClient.realtime.disconnect();
    }

    if (attempt < 3) await delay(attempt * 2_500);
  }

  throw new Error(`Realtime unavailable after 3 observable updates — ${failures.join(" | ")}`);
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

  const realtimeAttempt = await verifyLeadRealtimeReadiness();
  const moved = await post("/api/admin/commercial/pipeline", {
    action: "move-stage",
    id: ids.sellerCaseId,
    stage: "SELLER_MARKETED",
  });
  expectStatus(moved, 200, "move seller pipeline");

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
  record("Realtime PostgreSQL", `événement UPDATE reçu sur public.leads · tentative ${realtimeAttempt}/3`);
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

  const confirmed = await post("/api/admin/commercial/visites", {
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
  const rescheduled = await post("/api/admin/commercial/visites", {
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

  const finalized = await post("/api/admin/commercial/offres", {
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
  record("Offre → Négociation", `negotiation=${ids.negotiationId}, contre-proposition et décision acceptée`);
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

async function addAdminCookies(context: BrowserContext) {
  const cookies = adminCookie.split("; ").map((entry) => {
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
  const onPageError = (error: Error) => errors.push(error.message);
  page.on("pageerror", onPageError);
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200, `${path} did not return 200`);
  assert(!page.url().includes("/admin/login"), `${path} redirected to login`);
  if (text) await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15_000 });
  page.off("pageerror", onPageError);
  assert.deepEqual(errors, []);
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
  for (const [path, text] of paths) await assertPage(page, path, text);

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
  assert(Number(objectValue(visits.body.stats, "visit stats").total ?? 0) >= 1);
  assert(Number(objectValue(offers.body.stats, "offer stats").total ?? 0) >= 2);
  assert(Number(objectValue(negotiations.body.meta, "negotiation meta").count ?? 0) >= 1);
  record(
    "Statistiques dynamiques",
    `pipeline=${totalLeads}, visites≥1, offres≥2, négociations≥1 relus depuis Supabase`,
  );
}

async function cleanup() {
  await dropFailureTrigger().catch(() => undefined);
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
      if (!listed.error && listed.data?.length) {
        await supabase.storage.from("offer-documents").remove(listed.data.map((item) => `${offerId}/${item.name}`));
      }
    }
  }
  if (negotiationIdList.length) {
    await supabase.from("negotiation_alert_events").delete().in("negotiation_id", negotiationIdList);
    await supabase.from("negotiation_documents").delete().in("negotiation_id", negotiationIdList);
    await supabase.from("negotiation_exchanges").delete().in("negotiation_id", negotiationIdList);
    await supabase.from("negotiation_steps").delete().in("negotiation_id", negotiationIdList);
    await supabase.from("negotiations").delete().in("id", negotiationIdList);
  }
  if (offerIdList.length) {
    await supabase.from("offer_documents").delete().in("offer_id", offerIdList);
    await supabase.from("offer_status_history").delete().in("offer_id", offerIdList);
    await supabase.from("offers").delete().in("id", offerIdList);
  }
  if (visitIdList.length) await supabase.from("tasks").delete().in("appointment_id", visitIdList);
  if (leadIdList.length) await supabase.from("tasks").delete().in("lead_id", leadIdList);
  if (visitIdList.length) await supabase.from("appointments").delete().in("id", visitIdList);
  if (mandateIdList.length) await supabase.from("mandates").delete().in("id", mandateIdList);
  if (leadIdList.length) await supabase.from("leads").delete().in("id", leadIdList);
  if (estimationIdList.length) await supabase.from("estimations").delete().in("id", estimationIdList);
  if (propertyIdList.length) await supabase.from("properties").delete().in("id", propertyIdList);
  if (contactIds.length) await supabase.from("contacts").delete().in("id", contactIds);
  if (userIds.length) {
    await supabase.from("audit_logs").delete().in("actor_id", userIds);
    await supabase.from("activities").delete().in("actor_id", userIds);
    await supabase.from("profiles").delete().in("id", userIds);
  }
  for (const userId of userIds) await supabase.auth.admin.deleteUser(userId);

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
  console.log(`CRM E2E isolated run ${runId}`);
  try {
    baselinePipelineTotal = await readPipelineStatsTotal();
    await seedUsersAndContacts();
    server = startServer();
    await waitForServer();
    adminCookie = await login(adminEmail);
    await verifySecurity();
    await verifyRollback();
    await transformEstimation();
    await verifyPipelineAndRealtime();
    await createAndReportVisit();
    await createOfferAndDocument();
    await createNegotiationAndNewOffer();
    await verifyStats();
    await verifyBrowser();
  } catch (error) {
    results.push({
      check: "Scénario E2E",
      status: "FAIL",
      evidence: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server) {
      server.kill();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await cleanup();
    supabase.realtime.disconnect();
    console.log(JSON.stringify({ runId, projectRef, createdIds: ids, results }, null, 2));
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

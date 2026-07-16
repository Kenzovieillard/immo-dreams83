import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

type LegacyContactRow = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  request_type: string | null;
  city: string | null;
  message: string | null;
  status: string | null;
  notes: string | null;
  archived: boolean | null;
};

type LegacyEstimationRow = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_type: string | null;
  city: string | null;
  postal_code: string | null;
  surface: number | string | null;
  rooms: number | string | null;
  message: string | null;
  status: string | null;
  notes: string | null;
  archived: boolean | null;
};

type LegacySource = "contact" | "estimation";
type MatchCategory = "MATCH CERTAIN" | "MATCH PROBABLE" | "AMBIGU" | "AUCUN MATCH";
type PlannedAction = "CREATE_OR_REUSE_CONTACT" | "CREATE_CONTACT_WITH_LEAD" | "MANUAL_REVIEW";

type LegacySubmission = {
  source: LegacySource;
  legacyId: string;
  createdAt: string | null;
  updatedAt: string | null;
  name: string;
  normalizedName: string;
  email: string | null;
  normalizedEmail: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  city: string | null;
  normalizedCity: string | null;
  status: string;
  archived: boolean;
  requestType: string;
  message: string | null;
  notes: string | null;
  estimationDetails?: {
    propertyType: string | null;
    postalCode: string | null;
    surface: number | null;
    rooms: number | null;
  };
};

type SimulatedPayload = {
  legacySource: LegacySource;
  legacyId: string;
  matchCategory: MatchCategory;
  plannedAction: PlannedAction;
  matchedKeys: string[];
  futureContact: {
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    source: "LEGACY_CONTACTS_ESTIMATIONS";
  };
  futureLead: {
    source: "CONTACT_FORM" | "ESTIMATION_FORM";
    requestType: string;
    status: string;
    city: string | null;
    legacyTable: "contacts" | "estimations";
    legacyId: string;
    payloadPreview: Record<string, string | number | null>;
  };
  futureStatusHistory: {
    fromStatus: null;
    toStatus: string;
    reason: "LEGACY_IMPORT_DRY_RUN";
  };
  futureCommunications: Array<{
    type: "NOTE";
    direction: "INBOUND";
    bodyPreview: string;
  }>;
  warnings: string[];
};

const writeReport = process.argv.includes("--write-report");
const reportDir = join(process.cwd(), "reports");

function loadLocalEnv() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function normalizeText(value: string | null | undefined) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase() || "";
}

function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email || !email.includes("@") || !email.includes(".")) return null;
  return email;
}

function normalizeFrenchPhone(value: string | null | undefined) {
  if (!value) return null;

  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0033")) digits = `0${digits.slice(4)}`;
  if (digits.startsWith("33") && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (digits.length !== 10 || !digits.startsWith("0")) return null;

  return digits;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toLegacyStatus(status: string | null | undefined) {
  const normalizedStatus = normalizeText(status);
  if (["contacted", "contacte"].includes(normalizedStatus)) return "CONTACTED";
  if (["appointment", "rendez-vous", "rendez vous"].includes(normalizedStatus)) return "APPOINTMENT";
  if (["mandate_signed", "mandat signe", "mandat signe"].includes(normalizedStatus)) return "MANDATE_SIGNED";
  if (["lost", "perdu"].includes(normalizedStatus)) return "LOST";
  return "NEW";
}

function contactToSubmission(row: LegacyContactRow): LegacySubmission {
  const name = row.name?.trim() || "Contact sans nom";
  const requestType = row.request_type?.trim() || "Autre";

  return {
    source: "contact",
    legacyId: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name,
    normalizedName: normalizeText(name),
    email: row.email?.trim() || null,
    normalizedEmail: normalizeEmail(row.email),
    phone: row.phone?.trim() || null,
    normalizedPhone: normalizeFrenchPhone(row.phone),
    city: row.city?.trim() || null,
    normalizedCity: normalizeText(row.city) || null,
    status: toLegacyStatus(row.status),
    archived: Boolean(row.archived),
    requestType,
    message: row.message?.trim() || null,
    notes: row.notes?.trim() || null,
  };
}

function estimationToSubmission(row: LegacyEstimationRow): LegacySubmission {
  const name = row.name?.trim() || "Estimation sans nom";
  const propertyType = row.property_type?.trim() || "Bien";

  return {
    source: "estimation",
    legacyId: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name,
    normalizedName: normalizeText(name),
    email: row.email?.trim() || null,
    normalizedEmail: normalizeEmail(row.email),
    phone: row.phone?.trim() || null,
    normalizedPhone: normalizeFrenchPhone(row.phone),
    city: row.city?.trim() || null,
    normalizedCity: normalizeText(row.city) || null,
    status: toLegacyStatus(row.status),
    archived: Boolean(row.archived),
    requestType: `Estimation ${propertyType}`,
    message: row.message?.trim() || null,
    notes: row.notes?.trim() || null,
    estimationDetails: {
      propertyType,
      postalCode: row.postal_code?.trim() || null,
      surface: toNumber(row.surface),
      rooms: toNumber(row.rooms),
    },
  };
}

function addToGroup(groups: Map<string, LegacySubmission[]>, key: string | null, submission: LegacySubmission) {
  if (!key) return;
  const current = groups.get(key) ?? [];
  current.push(submission);
  groups.set(key, current);
}

function getMatchedKeys(
  submission: LegacySubmission,
  identityGroups: Map<string, LegacySubmission[]>,
  nameCityGroups: Map<string, LegacySubmission[]>
) {
  const keys: string[] = [];

  if (submission.normalizedEmail) keys.push(`email:${submission.normalizedEmail}`);
  if (submission.normalizedPhone) keys.push(`phone:${submission.normalizedPhone}`);
  if (submission.normalizedName && submission.normalizedCity) {
    keys.push(`name_city:${submission.normalizedName}|${submission.normalizedCity}`);
  }

  return keys.filter((key) => {
    const group = key.startsWith("name_city:") ? nameCityGroups.get(key) : identityGroups.get(key);
    return Boolean(group && group.length > 1);
  });
}

function getMatchCategory(
  submission: LegacySubmission,
  identityGroups: Map<string, LegacySubmission[]>,
  nameCityGroups: Map<string, LegacySubmission[]>
): MatchCategory {
  const identityKeys = [
    submission.normalizedEmail ? `email:${submission.normalizedEmail}` : null,
    submission.normalizedPhone ? `phone:${submission.normalizedPhone}` : null,
  ].filter(Boolean) as string[];

  for (const key of identityKeys) {
    const group = identityGroups.get(key);
    if (!group || group.length <= 1) continue;

    const names = new Set(group.map((item) => item.normalizedName).filter(Boolean));
    const cities = new Set(group.map((item) => item.normalizedCity).filter(Boolean));
    if (names.size > 2 || cities.size > 2) return "AMBIGU";
    return "MATCH CERTAIN";
  }

  if (submission.normalizedName && submission.normalizedCity) {
    const group = nameCityGroups.get(`name_city:${submission.normalizedName}|${submission.normalizedCity}`);
    if (group && group.length > 1) return "MATCH PROBABLE";
  }

  return "AUCUN MATCH";
}

function getWarnings(submission: LegacySubmission, matchCategory: MatchCategory) {
  const warnings: string[] = [];

  if (!submission.normalizedEmail) warnings.push("Email absent ou invalide.");
  if (!submission.normalizedPhone) warnings.push("Telephone absent ou invalide.");
  if (submission.archived) warnings.push("Demande legacy archivee.");
  if (matchCategory === "AMBIGU") warnings.push("Rapprochement a verifier manuellement avant migration.");

  return warnings;
}

function buildPayloads(submissions: LegacySubmission[]) {
  const identityGroups = new Map<string, LegacySubmission[]>();
  const nameCityGroups = new Map<string, LegacySubmission[]>();

  for (const submission of submissions) {
    addToGroup(identityGroups, submission.normalizedEmail ? `email:${submission.normalizedEmail}` : null, submission);
    addToGroup(identityGroups, submission.normalizedPhone ? `phone:${submission.normalizedPhone}` : null, submission);

    if (submission.normalizedName && submission.normalizedCity) {
      addToGroup(nameCityGroups, `name_city:${submission.normalizedName}|${submission.normalizedCity}`, submission);
    }
  }

  return submissions.map<SimulatedPayload>((submission) => {
    const matchCategory = getMatchCategory(submission, identityGroups, nameCityGroups);
    const matchedKeys = getMatchedKeys(submission, identityGroups, nameCityGroups);
    const plannedAction: PlannedAction =
      matchCategory === "AMBIGU"
        ? "MANUAL_REVIEW"
        : matchCategory === "AUCUN MATCH"
          ? "CREATE_CONTACT_WITH_LEAD"
          : "CREATE_OR_REUSE_CONTACT";

    const payloadPreview: Record<string, string | number | null> = {
      message: submission.message,
    };

    if (submission.estimationDetails) {
      payloadPreview.propertyType = submission.estimationDetails.propertyType;
      payloadPreview.postalCode = submission.estimationDetails.postalCode;
      payloadPreview.surface = submission.estimationDetails.surface;
      payloadPreview.rooms = submission.estimationDetails.rooms;
    }

    const communications = [submission.message, submission.notes]
      .filter((value): value is string => Boolean(value))
      .map((value) => ({
        type: "NOTE" as const,
        direction: "INBOUND" as const,
        bodyPreview: value.length > 180 ? `${value.slice(0, 177)}...` : value,
      }));

    return {
      legacySource: submission.source,
      legacyId: submission.legacyId,
      matchCategory,
      plannedAction,
      matchedKeys,
      futureContact: {
        name: submission.name,
        email: submission.normalizedEmail,
        phone: submission.normalizedPhone,
        city: submission.city,
        source: "LEGACY_CONTACTS_ESTIMATIONS",
      },
      futureLead: {
        source: submission.source === "contact" ? "CONTACT_FORM" : "ESTIMATION_FORM",
        requestType: submission.requestType,
        status: submission.status,
        city: submission.city,
        legacyTable: submission.source === "contact" ? "contacts" : "estimations",
        legacyId: submission.legacyId,
        payloadPreview,
      },
      futureStatusHistory: {
        fromStatus: null,
        toStatus: submission.status,
        reason: "LEGACY_IMPORT_DRY_RUN",
      },
      futureCommunications: communications,
      warnings: getWarnings(submission, matchCategory),
    };
  });
}

function buildSummary(payloads: SimulatedPayload[], contactCount: number, estimationCount: number) {
  const byCategory = payloads.reduce<Record<MatchCategory, number>>(
    (accumulator, payload) => {
      accumulator[payload.matchCategory] += 1;
      return accumulator;
    },
    {
      "MATCH CERTAIN": 0,
      "MATCH PROBABLE": 0,
      AMBIGU: 0,
      "AUCUN MATCH": 0,
    }
  );

  const manualReview = payloads.filter((payload) => payload.plannedAction === "MANUAL_REVIEW");
  const missingContactMethod = payloads.filter(
    (payload) => !payload.futureContact.email && !payload.futureContact.phone
  );

  return {
    contactsRead: contactCount,
    estimationsRead: estimationCount,
    submissionsAnalyzed: payloads.length,
    byCategory,
    manualReview: manualReview.length,
    missingContactMethod: missingContactMethod.length,
    simulatedContacts: payloads.filter((payload) => payload.plannedAction !== "MANUAL_REVIEW").length,
    simulatedLeads: payloads.filter((payload) => payload.plannedAction !== "MANUAL_REVIEW").length,
    simulatedCommunications: payloads.reduce(
      (total, payload) => total + payload.futureCommunications.length,
      0
    ),
  };
}

function saveReport(report: unknown) {
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `legacy-crm-dry-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

async function main() {
  loadLocalEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const report = {
      success: false,
      mode: "dry-run",
      generatedAt: new Date().toISOString(),
      blockedReason: "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans l'environnement local.",
      writesPerformed: false,
      actionsRequired: [
        "Renseigner .env.local avec les variables Supabase de test.",
        "Relancer npm run crm:legacy-dry-run.",
        "Ajouter --write-report pour conserver un JSON local non suivi par Git.",
      ],
    };

    if (writeReport) {
      const reportPath = saveReport(report);
      console.log(`Legacy CRM dry-run report written: ${reportPath}`);
    }

    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [contactsResult, estimationsResult] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,created_at,updated_at,name,email,phone,request_type,city,message,status,notes,archived")
      .order("created_at", { ascending: true }),
    supabase
      .from("estimations")
      .select("id,created_at,updated_at,name,email,phone,property_type,city,postal_code,surface,rooms,message,status,notes,archived")
      .order("created_at", { ascending: true }),
  ]);

  if (contactsResult.error) throw new Error(`Contacts read failed: ${contactsResult.error.message}`);
  if (estimationsResult.error) throw new Error(`Estimations read failed: ${estimationsResult.error.message}`);

  const contacts = (contactsResult.data ?? []) as LegacyContactRow[];
  const estimations = (estimationsResult.data ?? []) as LegacyEstimationRow[];
  const submissions = [
    ...contacts.map(contactToSubmission),
    ...estimations.map(estimationToSubmission),
  ];
  const payloads = buildPayloads(submissions);
  const report = {
    success: true,
    mode: "dry-run",
    generatedAt: new Date().toISOString(),
    writesPerformed: false,
    summary: buildSummary(payloads, contacts.length, estimations.length),
    ambiguousCases: payloads.filter((payload) => payload.matchCategory === "AMBIGU"),
    probableMatches: payloads.filter((payload) => payload.matchCategory === "MATCH PROBABLE"),
    unmatched: payloads.filter((payload) => payload.matchCategory === "AUCUN MATCH"),
    simulatedPayloads: payloads,
  };

  if (writeReport) {
    const reportPath = saveReport(report);
    console.log(`Legacy CRM dry-run report written: ${reportPath}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  if (writeReport) {
    const reportPath = saveReport({
      success: false,
      mode: "dry-run",
      generatedAt: new Date().toISOString(),
      writesPerformed: false,
      error: message,
      actionsRequired: [
        "Verifier que .env.local cible bien l'environnement Supabase de test.",
        "Verifier l'acces reseau au projet Supabase depuis ce poste.",
        "Relancer npm run crm:legacy-dry-run -- --write-report avant toute migration Partie 3.",
      ],
    });
    console.error(`Legacy CRM dry-run failed. Failure report written: ${reportPath}`);
  }

  console.error(message);
  process.exit(1);
});

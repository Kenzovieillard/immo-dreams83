import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildLegacyCrmReviewReport,
  normalizeLegacyEmail,
  normalizeLegacyFrenchPhone,
  normalizeLegacyText,
  type LegacyContactRow,
  type LegacyEstimationRow,
  type MatchCategory,
  type SimulatedPayload,
} from "../src/lib/legacy-crm-review";

type ExtendedLegacyContactRow = LegacyContactRow & {
  normalized_email: string | null;
  normalized_phone: string | null;
  canonical_contact_id: string | null;
  dedupe_status: "UNREVIEWED" | "MATCH_CERTAIN" | "MATCH_PROBABLE" | "AMBIGUOUS" | "MERGED" | "IGNORED";
  contact_source: string | null;
};

type ExistingLeadRow = {
  id: string;
  source_table: string | null;
  source_id: string | null;
};

type CanonicalPlan =
  | { action: "reuse"; contactId: string; reason: string }
  | { action: "create"; reason: string };

type MigrationPlanItem = {
  key: string;
  candidate: SimulatedPayload;
  canonical: CanonicalPlan;
  archived: boolean;
  skipped: boolean;
  skipReason: string | null;
  existingLeadId: string | null;
};

const applyMode = process.argv.includes("--apply");
const dryRunMode = !applyMode || process.argv.includes("--dry-run");
const reportDir = join(process.cwd(), "reports");
const migrationVersion = "v3-legacy-contacts-leads-20260716";

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

function saveReport(report: unknown, applied: boolean) {
  mkdirSync(reportDir, { recursive: true });
  const mode = applied ? "apply" : "dry-run";
  const reportPath = join(reportDir, `legacy-crm-migration-${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

function candidateKey(candidate: Pick<SimulatedPayload, "legacySource" | "legacyId">) {
  return `${candidate.legacySource}:${candidate.legacyId}`;
}

function getSourceTable(candidate: SimulatedPayload) {
  return candidate.futureLead.legacyTable;
}

function getSourceId(candidate: SimulatedPayload) {
  return candidate.futureLead.legacyId;
}

function getMatchDedupeStatus(matchCategory: MatchCategory) {
  if (matchCategory === "MATCH CERTAIN") return "MATCH_CERTAIN";
  if (matchCategory === "MATCH PROBABLE") return "MATCH_PROBABLE";
  if (matchCategory === "AMBIGU") return "AMBIGUOUS";
  return "UNREVIEWED";
}

function sortContactsByCreatedAt(contacts: ExtendedLegacyContactRow[]) {
  return [...contacts].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });
}

function getContactEmail(contact: ExtendedLegacyContactRow) {
  return contact.normalized_email || normalizeLegacyEmail(contact.email);
}

function getContactPhone(contact: ExtendedLegacyContactRow) {
  return contact.normalized_phone || normalizeLegacyFrenchPhone(contact.phone);
}

function resolveCanonicalContact(
  candidate: SimulatedPayload,
  nonIgnoredContacts: ExtendedLegacyContactRow[]
): { plan: CanonicalPlan | null; blocker: string | null } {
  if (candidate.legacySource === "contact") {
    return {
      plan: {
        action: "reuse",
        contactId: candidate.legacyId,
        reason: "legacy_contact_self",
      },
      blocker: null,
    };
  }

  const email = candidate.futureContact.email;
  const phone = candidate.futureContact.phone;
  const name = normalizeLegacyText(candidate.futureContact.name);
  const city = normalizeLegacyText(candidate.futureContact.city);

  if (email) {
    const matches = sortContactsByCreatedAt(nonIgnoredContacts.filter((contact) => getContactEmail(contact) === email));
    if (matches.length > 0) {
      return {
        plan: { action: "reuse", contactId: matches[0].id, reason: "email_match" },
        blocker: null,
      };
    }
  }

  if (phone) {
    const matches = sortContactsByCreatedAt(nonIgnoredContacts.filter((contact) => getContactPhone(contact) === phone));
    if (matches.length === 1) {
      return {
        plan: { action: "reuse", contactId: matches[0].id, reason: "phone_match" },
        blocker: null,
      };
    }

    if (matches.length > 1) {
      return {
        plan: null,
        blocker: `Telephone ${phone} associe a ${matches.length} contacts non ignores.`,
      };
    }
  }

  if (name && city) {
    const matches = sortContactsByCreatedAt(
      nonIgnoredContacts.filter((contact) => normalizeLegacyText(contact.name) === name && normalizeLegacyText(contact.city) === city)
    );

    if (matches.length === 1) {
      return {
        plan: { action: "reuse", contactId: matches[0].id, reason: "name_city_match" },
        blocker: null,
      };
    }

    if (matches.length > 1) {
      return {
        plan: null,
        blocker: `Nom + ville associes a ${matches.length} contacts non ignores.`,
      };
    }
  }

  return {
    plan: { action: "create", reason: "no_existing_contact_match" },
    blocker: null,
  };
}

function getArchivedStatus(candidate: SimulatedPayload, contactsById: Map<string, ExtendedLegacyContactRow>, estimationsById: Map<string, LegacyEstimationRow>) {
  if (candidate.legacySource === "contact") {
    return Boolean(contactsById.get(candidate.legacyId)?.archived);
  }

  return Boolean(estimationsById.get(candidate.legacyId)?.archived);
}

function getFullLegacyBody(candidate: SimulatedPayload, contactsById: Map<string, ExtendedLegacyContactRow>, estimationsById: Map<string, LegacyEstimationRow>) {
  if (candidate.legacySource === "contact") {
    const source = contactsById.get(candidate.legacyId);
    return {
      message: source?.message?.trim() || null,
      notes: source?.notes?.trim() || null,
    };
  }

  const source = estimationsById.get(candidate.legacyId);
  return {
    message: source?.message?.trim() || null,
    notes: source?.notes?.trim() || null,
  };
}

function getEstimationDetails(candidate: SimulatedPayload) {
  const preview = candidate.futureLead.payloadPreview;
  return {
    propertyType: typeof preview.propertyType === "string" ? preview.propertyType : null,
    postalCode: typeof preview.postalCode === "string" ? preview.postalCode : null,
    surface: typeof preview.surface === "number" ? preview.surface : null,
    rooms: typeof preview.rooms === "number" ? preview.rooms : null,
  };
}

function buildContactInsert(candidate: SimulatedPayload) {
  const message =
    typeof candidate.futureLead.payloadPreview.message === "string" && candidate.futureLead.payloadPreview.message.trim()
      ? candidate.futureLead.payloadPreview.message
      : "Contact cree depuis une ancienne demande legacy.";

  return {
    name: candidate.futureContact.name,
    email: candidate.futureContact.email ?? `${candidate.legacyId}@legacy.immo-dreams83.local`,
    phone: candidate.futureContact.phone,
    request_type: candidate.futureLead.requestType,
    city: candidate.futureContact.city,
    message,
    status: candidate.futureLead.status,
    archived: false,
    normalized_email: candidate.futureContact.email,
    normalized_phone: candidate.futureContact.phone,
    contact_source: "LEGACY_IMPORT",
    dedupe_status: "UNREVIEWED",
  };
}

function buildLeadInsert(candidate: SimulatedPayload, contactId: string, archived: boolean) {
  const estimationDetails = getEstimationDetails(candidate);

  return {
    contact_id: contactId,
    estimation_id: candidate.legacySource === "estimation" ? candidate.legacyId : null,
    source_table: getSourceTable(candidate),
    source_id: getSourceId(candidate),
    lead_type: candidate.legacySource === "estimation" ? "estimation" : "contact",
    source: "legacy_import",
    status: candidate.futureLead.status,
    archived,
    title: candidate.futureLead.requestType,
    request_type: candidate.futureLead.requestType,
    project_type: candidate.legacySource === "estimation" ? "seller_estimation" : "general_request",
    property_type: estimationDetails.propertyType,
    city: candidate.futureLead.city,
    postal_code: estimationDetails.postalCode,
    desired_surface: estimationDetails.surface,
    desired_rooms: estimationDetails.rooms,
    source_code: candidate.futureLead.source,
    source_payload: {
      migrationVersion,
      legacySource: candidate.legacySource,
      legacyId: candidate.legacyId,
      matchCategory: candidate.matchCategory,
      matchedKeys: candidate.matchedKeys,
      warnings: candidate.warnings,
      payloadPreview: candidate.futureLead.payloadPreview,
    },
    dedupe_status: "MIGRATED",
  };
}

function buildReportBase(params: {
  reviewReport: ReturnType<typeof buildLegacyCrmReviewReport>;
  plan: MigrationPlanItem[];
  blockers: string[];
  existingLeads: ExistingLeadRow[];
}) {
  const { reviewReport, plan, blockers, existingLeads } = params;
  const executable = plan.filter((item) => !item.skipped && !item.existingLeadId);
  const skippedIgnored = plan.filter((item) => item.skipReason === "IGNORED");
  const skippedExisting = plan.filter((item) => item.existingLeadId);

  return {
    success: blockers.length === 0,
    mode: applyMode ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    migrationVersion,
    writesPerformed: false,
    readyForApply: blockers.length === 0,
    summary: {
      contactsRead: reviewReport.summary.contactsRead,
      estimationsRead: reviewReport.summary.estimationsRead,
      submissionsAnalyzed: reviewReport.summary.submissionsAnalyzed,
      matchCategory: reviewReport.summary.byCategory,
      legacyLeadsAlreadyPresent: existingLeads.length,
      plannedLeads: executable.length,
      skippedIgnored: skippedIgnored.length,
      skippedExisting: skippedExisting.length,
      blockers: blockers.length,
    },
    blockers,
    skippedIgnored: skippedIgnored.map((item) => ({
      key: item.key,
      name: item.candidate.futureContact.name,
      reason: item.skipReason,
    })),
    plannedItems: plan.map((item) => ({
      key: item.key,
      name: item.candidate.futureContact.name,
      legacySource: item.candidate.legacySource,
      matchCategory: item.candidate.matchCategory,
      canonical: item.canonical,
      archived: item.archived,
      skipped: item.skipped,
      skipReason: item.skipReason,
      existingLeadId: item.existingLeadId,
      sourceTable: getSourceTable(item.candidate),
      sourceId: getSourceId(item.candidate),
    })),
  };
}

async function readLegacyData(supabase: SupabaseClient) {
  const [contactsResult, estimationsResult, leadsResult] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,created_at,updated_at,name,email,phone,request_type,city,message,status,notes,archived,normalized_email,normalized_phone,canonical_contact_id,dedupe_status,contact_source")
      .order("created_at", { ascending: true }),
    supabase
      .from("estimations")
      .select("id,created_at,updated_at,name,email,phone,property_type,city,postal_code,surface,rooms,message,status,notes,archived")
      .order("created_at", { ascending: true }),
    supabase
      .from("leads")
      .select("id,source_table,source_id")
      .not("source_table", "is", null)
      .not("source_id", "is", null),
  ]);

  if (contactsResult.error) throw new Error(`Contacts read failed: ${contactsResult.error.message}`);
  if (estimationsResult.error) throw new Error(`Estimations read failed: ${estimationsResult.error.message}`);
  if (leadsResult.error) throw new Error(`Existing leads read failed: ${leadsResult.error.message}`);

  return {
    contacts: (contactsResult.data ?? []) as ExtendedLegacyContactRow[],
    estimations: (estimationsResult.data ?? []) as LegacyEstimationRow[],
    existingLeads: (leadsResult.data ?? []) as ExistingLeadRow[],
  };
}

async function applyPlan(
  supabase: SupabaseClient,
  plan: MigrationPlanItem[],
  contactsById: Map<string, ExtendedLegacyContactRow>,
  estimationsById: Map<string, LegacyEstimationRow>,
  report: ReturnType<typeof buildReportBase>
) {
  const applied: Array<{ key: string; leadId: string; contactId: string; createdContact: boolean }> = [];

  for (const item of plan) {
    if (item.skipped || item.existingLeadId) continue;

    let contactId: string;
    let createdContact = false;

    if (item.canonical.action === "reuse") {
      contactId = item.canonical.contactId;
    } else {
      const { data: createdContactRow, error: contactError } = await supabase
        .from("contacts")
        .insert(buildContactInsert(item.candidate))
        .select("id")
        .single();

      if (contactError) throw new Error(`Contact creation failed for ${item.key}: ${contactError.message}`);
      contactId = createdContactRow.id as string;
      createdContact = true;
    }

    const { data: createdLead, error: leadError } = await supabase
      .from("leads")
      .insert(buildLeadInsert(item.candidate, contactId, item.archived))
      .select("id")
      .single();

    if (leadError) throw new Error(`Lead creation failed for ${item.key}: ${leadError.message}`);
    const leadId = createdLead.id as string;

    await supabase.from("lead_status_history").insert({
      lead_id: leadId,
      previous_status: null,
      next_status: item.candidate.futureLead.status,
    });

    const body = getFullLegacyBody(item.candidate, contactsById, estimationsById);
    const communications = [body.message, body.notes].filter((value): value is string => Boolean(value));
    if (communications.length > 0) {
      await supabase.from("communications").insert(
        communications.map((value, index) => ({
          lead_id: leadId,
          contact_id: contactId,
          channel: "NOTE",
          direction: "inbound",
          subject: index === 0 ? "Message legacy" : "Note interne legacy",
          body: value,
        }))
      );
    }

    if (item.candidate.legacySource === "contact") {
      await supabase
        .from("contacts")
        .update({
          canonical_contact_id: contactId,
          dedupe_status: getMatchDedupeStatus(item.candidate.matchCategory),
        })
        .eq("id", item.candidate.legacyId);
    }

    applied.push({ key: item.key, leadId, contactId, createdContact });
  }

  const importRunPayload = {
    mode: "apply",
    source: "legacy_contacts_estimations",
    contacts_read: report.summary.contactsRead,
    estimations_read: report.summary.estimationsRead,
    match_certain: report.summary.matchCategory["MATCH CERTAIN"],
    match_probable: report.summary.matchCategory["MATCH PROBABLE"],
    ambiguous: report.summary.matchCategory.AMBIGU,
    no_match: report.summary.matchCategory["AUCUN MATCH"],
    writes_performed: true,
    report: {
      ...report,
      writesPerformed: true,
      applied,
    },
  };

  const { error: runError } = await supabase.from("lead_import_runs").insert(importRunPayload);
  if (runError) throw new Error(`Lead import run log failed: ${runError.message}`);

  return applied;
}

async function main() {
  loadLocalEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const report = {
      success: false,
      mode: applyMode ? "apply" : "dry-run",
      generatedAt: new Date().toISOString(),
      writesPerformed: false,
      blockedReason: "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans l'environnement local.",
    };
    const reportPath = saveReport(report, false);
    console.log(`Legacy CRM migration report written: ${reportPath}`);
    console.log(JSON.stringify(report, null, 2));
    if (applyMode) process.exit(1);
    return;
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { contacts, estimations, existingLeads } = await readLegacyData(supabase);
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const estimationsById = new Map(estimations.map((estimation) => [estimation.id, estimation]));
  const existingLeadBySource = new Map(
    existingLeads.map((lead) => [`${lead.source_table}:${lead.source_id}`, lead.id])
  );
  const reviewReport = buildLegacyCrmReviewReport(contacts, estimations);
  const ignoredContactIds = new Set(
    contacts.filter((contact) => contact.dedupe_status === "IGNORED").map((contact) => contact.id)
  );
  const nonIgnoredContacts = contacts.filter((contact) => !ignoredContactIds.has(contact.id));
  const blockers: string[] = [];

  const plan = reviewReport.simulatedPayloads.map<MigrationPlanItem>((candidate) => {
    const key = candidateKey(candidate);
    const sourceKey = `${getSourceTable(candidate)}:${getSourceId(candidate)}`;
    const existingLeadId = existingLeadBySource.get(sourceKey) ?? null;
    const ignored = candidate.legacySource === "contact" && ignoredContactIds.has(candidate.legacyId);

    if (ignored) {
      return {
        key,
        candidate,
        canonical: { action: "reuse", contactId: candidate.legacyId, reason: "ignored_contact" },
        archived: getArchivedStatus(candidate, contactsById, estimationsById),
        skipped: true,
        skipReason: "IGNORED",
        existingLeadId,
      };
    }

    if (candidate.matchCategory === "AMBIGU") {
      blockers.push(`${key} reste AMBIGU et n'est pas marque IGNORED.`);
    }

    const resolution = resolveCanonicalContact(candidate, nonIgnoredContacts);
    if (resolution.blocker) blockers.push(`${key}: ${resolution.blocker}`);

    return {
      key,
      candidate,
      canonical: resolution.plan ?? { action: "create", reason: "blocked_resolution" },
      archived: getArchivedStatus(candidate, contactsById, estimationsById),
      skipped: false,
      skipReason: null,
      existingLeadId,
    };
  });

  const report = buildReportBase({ reviewReport, plan, blockers, existingLeads });

  if (blockers.length > 0) {
    const reportPath = saveReport(report, false);
    console.log(`Legacy CRM migration report written: ${reportPath}`);
    console.log(JSON.stringify(report, null, 2));
    process.exit(applyMode ? 1 : 0);
  }

  if (!applyMode || dryRunMode) {
    const reportPath = saveReport(report, false);
    console.log(`Legacy CRM migration dry-run report written: ${reportPath}`);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const applied = await applyPlan(supabase, plan, contactsById, estimationsById, report);
  const appliedReport = {
    ...report,
    success: true,
    mode: "apply",
    writesPerformed: true,
    applied,
    summary: {
      ...report.summary,
      createdLeads: applied.length,
      createdContacts: applied.filter((item) => item.createdContact).length,
    },
  };
  const reportPath = saveReport(appliedReport, true);
  console.log(`Legacy CRM migration apply report written: ${reportPath}`);
  console.log(JSON.stringify(appliedReport, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const report = {
    success: false,
    mode: applyMode ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    writesPerformed: false,
    error: message,
  };
  const reportPath = saveReport(report, applyMode);
  console.error(`Legacy CRM migration failed. Failure report written: ${reportPath}`);
  console.error(message);
  process.exit(1);
});

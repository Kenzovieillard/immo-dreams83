import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createClient, type SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";

type CsvRow = Record<string, string>;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type ContactRecord = {
  created_at?: string;
  updated_at?: string;
  name: string;
  email: string;
  phone: string | null;
  request_type: string;
  city: string | null;
  message: string;
  status: string;
  notes: string | null;
  archived: boolean;
  normalized_email?: string | null;
  normalized_phone?: string | null;
  contact_source?: string;
  dedupe_status?: "UNREVIEWED" | "MATCH_CERTAIN" | "MATCH_PROBABLE" | "AMBIGUOUS" | "MERGED" | "IGNORED";
};

type ExistingContactRow = {
  id: string;
  notes: string | null;
  contact_source: string | null;
};

type LestyContactsDatabase = {
  public: {
    Tables: {
      contacts: {
        Row: ExistingContactRow & Record<string, JsonValue>;
        Insert: ContactRecord;
        Update: Partial<ContactRecord>;
        Relationships: [];
      };
      activities: {
        Row: Record<string, JsonValue>;
        Insert: {
          entity_type: string;
          entity_id: string;
          action: string;
          user_name: string;
        };
        Update: Record<string, JsonValue>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type SupabaseClient = SupabaseJsClient<LestyContactsDatabase>;

type ImportCandidate = {
  ref: string;
  action: "create" | "update";
  flags: string[];
  record: ContactRecord;
};

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const writeReport = args.includes("--write-report");
const reportDir = join(process.cwd(), "reports");
const importSource = "LESTY_GED_CONTACT";

function getArgValue(name: string) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function latestDownloadMatching(prefix: string) {
  const downloadsDir = join(homedir(), "Downloads");
  const candidates = readdirSync(downloadsDir)
    .filter((name) => name.toLowerCase().startsWith(prefix.toLowerCase()) && name.toLowerCase().endsWith(".csv"))
    .map((name) => {
      const path = join(downloadsDir, name);
      return { path, mtimeMs: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return candidates[0]?.path ?? null;
}

function resolveContactsPath() {
  const explicit = getArgValue("--contacts");
  const path = explicit ?? latestDownloadMatching("ged_contact");

  if (!path || !existsSync(path)) {
    throw new Error('Fichier contacts introuvable. Fournir --contacts "C:\\\\chemin\\\\ged_contact.csv".');
  }

  return path;
}

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

function getSupabaseClient(): SupabaseClient {
  loadLocalEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Variables Supabase manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.");
  }

  return createClient<LestyContactsDatabase>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readWindowsCsv(path: string) {
  const bytes = readFileSync(path);
  return new TextDecoder("windows-1252").decode(bytes);
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(content: string) {
  const normalized = content.replace(/^\uFEFF/, "");
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];

    if (character === '"') {
      if (inQuotes && normalized[index + 1] === '"') {
        current += '""';
        index += 1;
      } else {
        current += character;
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = "";
      if (character === "\r" && normalized[index + 1] === "\n") index += 1;
      continue;
    }

    current += character;
  }

  if (current.trim()) lines.push(current);

  const headerLine = lines[0] ?? "";
  const delimiter = (headerLine.match(/;/g)?.length ?? 0) >= (headerLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = parseCsvLine(headerLine, delimiter);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });

  return { headers, rows, delimiter };
}

function normalizeText(value: string | null | undefined) {
  return (
    value
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase() || ""
  );
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

function getFirstValue(row: CsvRow, columns: string[]) {
  for (const column of columns) {
    const value = row[column]?.trim();
    if (value) return value;
  }
  return "";
}

function toIsoDate(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return undefined;
  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function getMarker(ref: string) {
  return `${importSource}:${ref}`;
}

function getRefFromNotes(notes: string | null | undefined) {
  const match = notes?.match(/LESTY_GED_CONTACT:([^\s]+)/);
  return match?.[1] ?? null;
}

function getDisplayName(row: CsvRow, ref: string) {
  const company = getFirstValue(row, ["gc_raisonsoc", "gc_enseigne"]);
  const firstName = row.gc_prenom?.trim() ?? "";
  const lastName = row.gc_nom?.trim() ?? "";
  const civilite = row.gc_civilite?.trim() ?? "";
  const fullName = [civilite, firstName, lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  return company || fullName || `Contact Lesty ${ref}`;
}

function getCity(row: CsvRow) {
  const city = getFirstValue(row, ["gc_ville", "gc_villesoc"]);
  if (city) return city;

  const cpCity = getFirstValue(row, ["gc_cpville", "gc2_cpville"]);
  const withoutPostalCode = cpCity.replace(/^\d{5}\s*/, "").trim();
  return withoutPostalCode || null;
}

function getPostalCode(row: CsvRow) {
  const direct = getFirstValue(row, ["gc_cpsoc"]);
  if (/^\d{5}$/.test(direct)) return direct;

  const cpCity = getFirstValue(row, ["gc_cpville", "gc2_cpville"]);
  const match = cpCity.match(/\b\d{5}\b/);
  return match?.[0] ?? null;
}

function getRequestType(row: CsvRow) {
  const rawType = row.gc_typecontact?.trim();
  if (rawType) return rawType;
  if (row.gc_listbiens?.trim()) return "Vendeur";
  if (row.gc_listdemandes?.trim()) return "Acquereur";
  return "Contact Lesty";
}

function isArchived(row: CsvRow) {
  const archive = normalizeText(row.gc_archive);
  const actif = normalizeText(row.gc_actif);
  return Boolean(archive && archive !== "0" && archive !== "non") || actif === "0";
}

function buildContactNotes(row: CsvRow, ref: string) {
  const lines = [
    getMarker(ref),
    `Source : export GED contact Lesty`,
    `Reference Lesty : ${ref}`,
    row.gc_nego?.trim() ? `Negociateur : ${row.gc_nego.trim()}` : null,
    row.gc_typecontact?.trim() ? `Type Lesty : ${row.gc_typecontact.trim()}` : null,
    row.refExterne?.trim() ? `Reference externe : ${row.refExterne.trim()}` : null,
    row.gc_dateCreat?.trim() ? `Date creation Lesty : ${row.gc_dateCreat.trim()}` : null,
    row.gc_dateModif?.trim() ? `Date modification Lesty : ${row.gc_dateModif.trim()}` : null,
    row.dateRGPD?.trim() ? `Date RGPD : ${row.dateRGPD.trim()}` : null,
    row.gc_autormail?.trim() ? `Autorisation email : ${row.gc_autormail.trim()}` : null,
    row.gc_autorsms?.trim() ? `Autorisation SMS : ${row.gc_autorsms.trim()}` : null,
    row.gc_listbiens?.trim() ? `Biens lies : ${row.gc_listbiens.trim()}` : null,
    row.gc_listdemandes?.trim() ? `Demandes liees : ${row.gc_listdemandes.trim()}` : null,
    row.gc_commentaires?.trim() ? `Commentaire Lesty : ${row.gc_commentaires.trim()}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

function buildContactRecord(row: CsvRow): ImportCandidate | null {
  const ref = row.ref?.trim();
  if (!ref) return null;

  const flags: string[] = [];
  const name = getDisplayName(row, ref);
  const realEmail = normalizeEmail(getFirstValue(row, ["gc_mail1", "gc_mail2"]));
  const email = realEmail ?? `lesty-${ref}@legacy.immo-dreams83.local`;
  if (!realEmail) flags.push("technical_email");

  const phone = getFirstValue(row, ["gc_mobile", "gc_teldom", "gc_telpro", "gc2_mobile", "gc2_teldom", "gc2_telpro"]);
  const normalizedPhone = normalizeFrenchPhone(phone);
  if (!realEmail && !normalizedPhone) flags.push("missing_real_contact_method");

  const city = getCity(row);
  const postalCode = getPostalCode(row);
  const requestType = getRequestType(row);
  const createdAt = toIsoDate(row.gc_dateCreat);
  const updatedAt = toIsoDate(row.gc_dateModif) ?? createdAt ?? new Date().toISOString();
  const archived = isArchived(row);
  const messageParts = [
    `Contact importe depuis Lesty (${requestType}).`,
    postalCode || city ? `Secteur : ${[postalCode, city].filter(Boolean).join(" ")}.` : null,
    row.gc_nego?.trim() ? `Suivi Lesty : ${row.gc_nego.trim()}.` : null,
  ].filter(Boolean);

  return {
    ref,
    action: "create",
    flags,
    record: {
      ...(createdAt ? { created_at: createdAt } : {}),
      updated_at: updatedAt,
      name,
      email,
      phone: phone || null,
      request_type: requestType,
      city,
      message: messageParts.join(" "),
      status: "NEW",
      notes: buildContactNotes(row, ref),
      archived,
      normalized_email: realEmail,
      normalized_phone: normalizedPhone,
      contact_source: importSource,
      dedupe_status: "UNREVIEWED",
    },
  };
}

function duplicateCount(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

async function readExistingContacts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("contacts")
    .select("id,notes,contact_source")
    .eq("contact_source", importSource);

  if (error) throw new Error(`Lecture contacts Lesty impossible : ${error.message}`);

  const byRef = new Map<string, ExistingContactRow>();
  for (const contact of data ?? []) {
    const ref = getRefFromNotes(contact.notes);
    if (ref) byRef.set(ref, contact as ExistingContactRow);
  }

  return byRef;
}

function saveReport(report: unknown, mode: "dry-run" | "import") {
  if (!writeReport) return null;

  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `lesty-contacts-${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

async function main() {
  const contactsPath = resolveContactsPath();
  const csv = parseCsv(readWindowsCsv(contactsPath));
  const supabase = getSupabaseClient();
  const existingByRef = await readExistingContacts(supabase);
  const candidates = csv.rows.map(buildContactRecord).filter((candidate): candidate is ImportCandidate => Boolean(candidate));

  for (const candidate of candidates) {
    if (existingByRef.has(candidate.ref)) candidate.action = "update";
  }

  const refs = candidates.map((candidate) => candidate.ref);
  const realEmails = candidates
    .map((candidate) => candidate.record.normalized_email ?? "")
    .filter(Boolean);
  const normalizedPhones = candidates
    .map((candidate) => candidate.record.normalized_phone ?? "")
    .filter(Boolean);
  const technicalEmails = candidates.filter((candidate) => candidate.flags.includes("technical_email")).length;
  const missingRealContactMethod = candidates.filter((candidate) => candidate.flags.includes("missing_real_contact_method")).length;
  const mode = apply ? "import" : "dry-run";
  const report = {
    success: true,
    mode,
    generatedAt: new Date().toISOString(),
    sourceFile: basename(contactsPath),
    writesPerformed: false,
    totals: {
      inputRows: csv.rows.length,
      validContacts: candidates.length,
      create: candidates.filter((candidate) => candidate.action === "create").length,
      update: candidates.filter((candidate) => candidate.action === "update").length,
      duplicateRefs: duplicateCount(refs),
      duplicateRealEmails: duplicateCount(realEmails),
      duplicatePhones: duplicateCount(normalizedPhones),
      technicalEmails,
      missingRealContactMethod,
      archived: candidates.filter((candidate) => candidate.record.archived).length,
    },
    blockers: [] as string[],
    samples: candidates.slice(0, 10).map((candidate) => ({
      ref: candidate.ref,
      action: candidate.action,
      requestType: candidate.record.request_type,
      hasRealEmail: !candidate.flags.includes("technical_email"),
      hasPhone: Boolean(candidate.record.normalized_phone),
      hasCity: Boolean(candidate.record.city),
      flags: candidate.flags,
    })),
  };

  if (report.totals.duplicateRefs > 0) {
    report.blockers.push("References Lesty dupliquees dans le CSV.");
  }

  if (report.blockers.length > 0) {
    const reportPath = saveReport(report, mode);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (apply) {
    for (const candidate of candidates) {
      const existing = existingByRef.get(candidate.ref);
      if (existing) {
        const updateRecord = { ...candidate.record };
        delete updateRecord.created_at;
        const { error } = await supabase
          .from("contacts")
          .update(updateRecord)
          .eq("id", existing.id);

        if (error) throw new Error(`Mise a jour contact Lesty ${candidate.ref} impossible : ${error.message}`);
      } else {
        const { data, error } = await supabase
          .from("contacts")
          .insert(candidate.record)
          .select("id,notes,contact_source")
          .single();

        if (error) throw new Error(`Creation contact Lesty ${candidate.ref} impossible : ${error.message}`);
        existingByRef.set(candidate.ref, data as ExistingContactRow);
      }
    }

    await supabase.from("activities").insert({
      entity_type: "lesty_contact_import",
      entity_id: "ged_contact",
      action: `Import Lesty contacts : ${candidates.length} contacts synchronises`,
      user_name: "Import Lesty",
    });

    report.writesPerformed = true;
  }

  const reportPath = saveReport(report, mode);
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

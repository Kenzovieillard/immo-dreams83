import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createClient, type SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";

type CsvRow = Record<string, string>;

type PropertyType = "apartment" | "house" | "land" | "commercial" | "parking" | "other";
type PropertyStatus = "available" | "under_offer" | "sold";
type PropertyCommercialStatus = "AVAILABLE" | "UNDER_OFFER" | "SOLD";
type PropertyPublicationStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
type ImportAction = "create" | "update" | "review" | "blocked";

type SupabasePropertyRow = {
  id: string;
  reference: string;
  mandate_number: string | null;
  slug: string;
  title: string;
  source_url: string | null;
  photos?: string[] | null;
};

type ProposedPropertyRecord = {
  reference: string;
  mandate_number: string;
  slug: string;
  title: string;
  type: PropertyType;
  transaction_type: "sale";
  status: PropertyStatus;
  commercial_status: PropertyCommercialStatus;
  publication_status: PropertyPublicationStatus;
  city: string;
  postal_code: string;
  price: number;
  fees_included: boolean;
  surface: number;
  land_surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  energy_class: string;
  climate_class: string;
  description_short: string;
  description_long: string;
  features: string[];
  photos: string[];
  featured: boolean;
  source_url: string;
  published_at: string | null;
  archived_at: string | null;
};

type ProposedPhotoRow = {
  storage_bucket: "external" | "property-photos";
  storage_path: string;
  public_url: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
  status: "ACTIVE";
};

type ExistingPropertyPhotoRow = {
  id: string;
  public_url: string;
  status: "ACTIVE" | "TRASHED" | "PURGED" | string | null;
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type LestyMigrationDatabase = {
  public: {
    Tables: {
      properties: {
        Row: SupabasePropertyRow & Record<string, JsonValue>;
        Insert: ProposedPropertyRecord;
        Update: Partial<ProposedPropertyRecord> & Record<string, JsonValue | undefined>;
        Relationships: [];
      };
      property_photos: {
        Row: ExistingPropertyPhotoRow & Record<string, JsonValue>;
        Insert: {
          property_id: string;
          storage_bucket: string;
          storage_path: string;
          public_url: string;
          alt_text: string;
          sort_order: number;
          is_primary: boolean;
          status: "ACTIVE" | "TRASHED" | "PURGED";
          restored_at?: string | null;
          purged_at?: string | null;
        };
        Update: {
          status?: "ACTIVE" | "TRASHED" | "PURGED";
          trashed_at?: string | null;
          restore_until?: string | null;
          restored_at?: string | null;
          purged_at?: string | null;
          is_primary?: boolean;
        };
        Relationships: [];
      };
      property_history: {
        Row: Record<string, JsonValue>;
        Insert: {
          property_id: string;
          reference?: string | null;
          action: string;
          changed_fields?: string[];
          previous_value?: JsonValue;
          next_value?: JsonValue;
          actor_email?: string | null;
          previous_values?: JsonValue;
          new_values?: JsonValue;
          user_name?: string;
        };
        Update: Record<string, JsonValue>;
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

type SupabaseClient = SupabaseJsClient<LestyMigrationDatabase>;

type ImportCandidate = {
  lestyRef: string;
  mandateNumber: string;
  rawStatus: string;
  action: ImportAction;
  matchReason: string | null;
  existingPropertyId: string | null;
  flags: string[];
  record: ProposedPropertyRecord | null;
  photoRows: ProposedPhotoRow[];
};

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const writeReport = args.includes("--write-report");
const probePhotos = args.includes("--probe-photos");
const copyPhotos = args.includes("--copy-photos");
const reportDir = join(process.cwd(), "reports");
const photoWarnings: string[] = [];
const sourcePages = {
  stats: "https://immodreams.lesty.immo/modspec/statsActivite.php",
  properties: "https://immodreams.lesty.immo/annu/annu.php?modRef=35",
  bridges: "https://immodreams.lesty.immo/modspec/passerelles.php",
  bridgesAdmin: "https://immodreams.lesty.immo/modspec/passerellesAdmin.php",
};

function getArgValue(name: string) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function getNumberArg(name: string, fallback: number) {
  const value = getArgValue(name);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function resolveBiensPath() {
  const explicit = getArgValue("--biens");
  const path = explicit ?? latestDownloadMatching("biens");

  if (!path || !existsSync(path)) {
    throw new Error('Fichier biens CSV introuvable. Fournir --biens "C:\\\\chemin\\\\biens.csv".');
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

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeText(value: string) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getFirstNumber(row: CsvRow, columns: string[]) {
  for (const column of columns) {
    const parsed = toNumber(row[column] ?? "");
    if (parsed !== null) return parsed;
  }

  return null;
}

function extractSurfaceFromText(...values: string[]) {
  const text = values.map(cleanText).filter(Boolean).join(" ");
  const matches = [...text.matchAll(/(\d+(?:[,.]\d+)?)\s*m(?:2|²)\b/gi)]
    .map((match) => toNumber(match[1] ?? ""))
    .filter((value): value is number => value !== null && value > 0);

  if (matches.length === 0) return null;
  return Math.max(...matches);
}

function isTruthy(value: string) {
  return ["1", "oui", "true", "x", "yes"].includes(normalizeText(value));
}

function getFirst(row: CsvRow, columns: string[]) {
  for (const column of columns) {
    const value = cleanText(row[column] ?? "");
    if (value) return value;
  }

  return "";
}

function mapType(row: CsvRow): { type: PropertyType | null; flag: string | null } {
  const category = normalizeText(row.typebienCat ?? "");
  const specificType = normalizeText(row.typebienSpec ?? "");
  const legacyType = normalizeText(row.typebien ?? "");
  const combined = `${category} ${specificType} ${legacyType}`;

  if (category === "appartement") return { type: "apartment", flag: null };
  if (category === "maison") return { type: "house", flag: null };
  if (category === "terrain") return { type: "land", flag: null };
  if (category === "immobilier d'entreprise") return { type: "commercial", flag: null };
  if (category === "stationnement / local") {
    if (combined.includes("garage") || combined.includes("parking") || combined.includes("stationnement")) {
      return { type: "parking", flag: null };
    }

    return { type: "commercial", flag: "local_mapped_to_commercial" };
  }

  if (combined.includes("appartement") || combined.includes("studio") || combined.includes("duplex")) {
    return { type: "apartment", flag: "type_mapped_from_specific" };
  }
  if (combined.includes("maison") || combined.includes("villa") || combined.includes("demeure")) {
    return { type: "house", flag: "type_mapped_from_specific" };
  }
  if (combined.includes("terrain")) return { type: "land", flag: "type_mapped_from_specific" };
  if (combined.includes("local") || combined.includes("commerce") || combined.includes("fonds")) {
    return { type: "commercial", flag: "type_mapped_from_specific" };
  }
  if (combined.includes("garage") || combined.includes("parking") || combined.includes("stationnement")) {
    return { type: "parking", flag: "type_mapped_from_specific" };
  }
  if (!category && !specificType && !legacyType) {
    return { type: "other", flag: "type_missing_mapped_to_other" };
  }

  return { type: "other", flag: `unsupported_type_mapped_to_other:${row.typebienCat || row.typebienSpec || row.typebien || "[vide]"}` };
}

function mapStatus(rawStatus: string): {
  legacyStatus: PropertyStatus;
  commercialStatus: PropertyCommercialStatus;
  publicationStatus: PropertyPublicationStatus;
  flags: string[];
} {
  const parts = rawStatus
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);
  const flags: string[] = [];

  if (parts.length === 0) {
    return {
      legacyStatus: "available",
      commercialStatus: "AVAILABLE",
      publicationStatus: "UNPUBLISHED",
      flags: ["missing_status"],
    };
  }

  if (parts.length > 1) flags.push("multiple_statuses");

  const hasSold = parts.some((part) => part === "vendu" || part === "vendu par un tiers");
  const hasUnderOffer = parts.some((part) =>
    ["offre recue", "offre acceptee", "compromis en cours", "optionne"].includes(part)
  );
  const hasAvailable = parts.includes("disponible");
  const hasNonPublic = parts.some((part) => ["suspendu", "estimation", "loue"].includes(part));

  if (hasSold) {
    if (hasAvailable || hasUnderOffer) flags.push("conflicting_sold_status");
    return {
      legacyStatus: "sold",
      commercialStatus: "SOLD",
      publicationStatus: "UNPUBLISHED",
      flags,
    };
  }

  if (hasUnderOffer) {
    return {
      legacyStatus: "under_offer",
      commercialStatus: "UNDER_OFFER",
      publicationStatus: "PUBLISHED",
      flags,
    };
  }

  if (hasAvailable) {
    return {
      legacyStatus: "available",
      commercialStatus: "AVAILABLE",
      publicationStatus: "PUBLISHED",
      flags,
    };
  }

  if (hasNonPublic) {
    return {
      legacyStatus: "available",
      commercialStatus: "AVAILABLE",
      publicationStatus: "UNPUBLISHED",
      flags,
    };
  }

  return {
    legacyStatus: "available",
    commercialStatus: "AVAILABLE",
    publicationStatus: "UNPUBLISHED",
    flags: ["unknown_status"],
  };
}

function buildDiagnostic(value: string, unit: "energy" | "climate", isDiagnosticExempt: boolean) {
  const parsed = toNumber(value);
  if (isDiagnosticExempt) return "Non soumis";
  if (parsed === null) return "Non renseigne";
  return unit === "energy" ? `${parsed} kWhEP/m2.an` : `${parsed} kg eqCO2/m2.an`;
}

function buildFeatures(row: CsvRow) {
  const featureColumns: Array<[string, string]> = [
    ["ascenseur", "Ascenseur"],
    ["piscine", "Piscine"],
    ["piscineChauffee", "Piscine chauffee"],
    ["sauna", "Sauna"],
    ["spa", "Spa"],
    ["hammam", "Hammam"],
    ["poolHouse", "Pool house"],
    ["acceshandicape", "Acces PMR"],
    ["pleinPied", "Plain-pied"],
    ["pleinPiedDeVie", "Vie de plain-pied"],
    ["rezdejardin", "Rez-de-jardin"],
    ["jardin", "Jardin"],
    ["interphone", "Interphone"],
    ["videophone", "Videophone"],
    ["digicode", "Digicode"],
    ["gardien", "Gardien"],
    ["alarmes", "Alarme"],
    ["doubleVitrage", "Double vitrage"],
    ["climatisation", "Climatisation"],
    ["cheminee", "Cheminee"],
    ["parquet", "Parquet"],
    ["voletsElectriques", "Volets electriques"],
    ["portailElectrique", "Portail electrique"],
    ["caveAvin", "Cave a vin"],
    ["garage", "Garage"],
  ];
  const features = new Set<string>();

  for (const [column, label] of featureColumns) {
    if (isTruthy(row[column] ?? "")) features.add(label);
  }

  const numericFeatures: Array<[string, string]> = [
    ["nbgarage", "Garage"],
    ["nbparkint", "Parking interieur"],
    ["nbparkext", "Parking exterieur"],
    ["nbdecaves", "Cave"],
    ["nbdebalcons", "Balcon"],
    ["nbterrasses", "Terrasse"],
  ];

  for (const [column, label] of numericFeatures) {
    const count = toNumber(row[column] ?? "");
    if (count && count > 0) features.add(label);
  }

  for (const textValue of [row.proximite, row.transport, row.orientation, row.vue, row.etatgenint, row.etatgenext]) {
    cleanText(textValue ?? "")
      .split(",")
      .map(cleanText)
      .filter(Boolean)
      .slice(0, 4)
      .forEach((item) => features.add(item));
  }

  return [...features].slice(0, 18);
}

function truncateText(value: string, maxLength: number) {
  const cleaned = cleanText(value);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}...`;
}

function getPhotoUrl(ref: string, index: number) {
  return `https://immodreams.lesty.immo/photo/immodreams/biens/${encodeURIComponent(ref)}-${index}.jpg`;
}

async function probePhotoUrl(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok && (response.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

async function discoverPhotos(ref: string, maxPhotoIndex: number) {
  if (!probePhotos) return [];

  const found: string[] = [];
  let missesAfterFirstPhoto = 0;

  for (let index = 1; index <= maxPhotoIndex; index += 1) {
    const url = getPhotoUrl(ref, index);
    const exists = await probePhotoUrl(url);

    if (exists) {
      found.push(url);
      missesAfterFirstPhoto = 0;
      continue;
    }

    if (found.length > 0) {
      missesAfterFirstPhoto += 1;
      if (missesAfterFirstPhoto >= 2) break;
    }
  }

  return found;
}

function buildSourceUrl(lestyRef: string) {
  return `https://immodreams.lesty.immo/load.php?template=modspec/bexterimmo/zoomresponsive.htm&tableannu=biens&ref=${encodeURIComponent(lestyRef)}`;
}

function buildPublicSourceUrl(lestyRef: string) {
  return `http://immo.bexter.fr/fr/acheter-biens-immobiliers-details.htm?_ref=${encodeURIComponent(lestyRef)}`;
}

function sourceUrlMatchesLestyRef(sourceUrl: string | null | undefined, lestyRef: string) {
  if (!sourceUrl) return false;

  try {
    const url = new URL(sourceUrl);
    if (url.searchParams.get("ref") === lestyRef || url.searchParams.get("_ref") === lestyRef) {
      return true;
    }

    return url.pathname.endsWith(`/${lestyRef}.htm`);
  } catch {
    return sourceUrl.includes(`ref=${lestyRef}&`) || sourceUrl.endsWith(`ref=${lestyRef}`);
  }
}

async function loadExistingProperties() {
  loadLocalEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return { available: false, rows: [] as SupabasePropertyRow[] };

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("properties")
    .select("id,reference,mandate_number,slug,title,source_url,photos")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Lecture Supabase properties impossible: ${error.message}`);

  return { available: true, rows: (data ?? []) as SupabasePropertyRow[] };
}

function findExistingMatch(row: CsvRow, existingProperties: SupabasePropertyRow[]) {
  const lestyRef = cleanText(row.ref ?? "");
  const mandateNumber = cleanText(row.nummandat ?? "");
  const exactReferenceMatches = existingProperties.filter((property) => property.reference === lestyRef);
  if (exactReferenceMatches.length === 1) {
    return { row: exactReferenceMatches[0], reason: "reference_lesty_ref", ambiguous: false };
  }
  if (exactReferenceMatches.length > 1) {
    return { row: null, reason: "multiple_reference_matches", ambiguous: true };
  }

  const sourceMatches = existingProperties.filter((property) => {
    return sourceUrlMatchesLestyRef(property.source_url, lestyRef);
  });

  if (sourceMatches.length === 1) {
    return { row: sourceMatches[0], reason: "source_url_lesty_ref", ambiguous: false };
  }
  if (sourceMatches.length > 1) {
    return { row: null, reason: "multiple_source_url_matches", ambiguous: true };
  }

  const mandateMatches = existingProperties.filter((property) => {
    return property.reference === mandateNumber || property.mandate_number === mandateNumber;
  });
  if (mandateMatches.length === 1) {
    return { row: mandateMatches[0], reason: "mandate_number", ambiguous: false };
  }
  if (mandateMatches.length > 1) {
    return { row: null, reason: "multiple_mandate_matches", ambiguous: true };
  }

  return { row: null, reason: null, ambiguous: false };
}

async function buildCandidate(row: CsvRow, existingProperties: SupabasePropertyRow[], maxPhotoIndex: number) {
  const lestyRef = cleanText(row.ref ?? "");
  const mandateNumber = cleanText(row.nummandat ?? "") || lestyRef;
  const rawStatus = cleanText(row.etat ?? "");
  const flags: string[] = [];

  if (!lestyRef) flags.push("missing_lesty_ref");
  if (!mandateNumber) flags.push("missing_mandate");

  const typeMapping = mapType(row);
  if (typeMapping.flag) flags.push(typeMapping.flag);

  const statusMapping = mapStatus(rawStatus);
  flags.push(...statusMapping.flags);

  const city = getFirst(row, ["ville_internet", "ville_bien"]) || "Non renseignee";
  const postalCode = getFirst(row, ["cp_internet", "cp_bien"]) || "00000";
  const title = getFirst(row, ["titre_fr", "resume_fr"]) || `${row.typebienCat || row.typebien || "Bien Lesty a completer"} ${city} ref ${lestyRef}`;
  const price = getFirstNumber(row, [
    "prixdevente",
    "prixnetvendeur",
    "prixcession",
    "prixFond",
    "prixStationnement",
    "prixPasDePorte",
    "prixvendu",
    "prixestime",
  ]) ?? 0;
  const surfaceFromText = extractSurfaceFromText(row.resume_fr ?? "", row.textePub ?? "", row.desc_fr ?? "");
  const landSurface = getFirstNumber(row, [
    "surfaceterrain",
    "surfaceconstructible",
    "surfacenonconstructible",
    "surfacetotale",
    "surfacehabitable",
  ]) ?? (typeMapping.type === "land" ? surfaceFromText : null);
  const livingSurface = getFirstNumber(row, [
    "surfacehabitable",
    "surfacecarrez",
    "surfacetotale",
    "surfacevente",
    "surfacegarage",
    "SurfaceAnnexes",
  ]) ?? (typeMapping.type !== "land" ? surfaceFromText : null);
  const surface = typeMapping.type === "land" ? landSurface ?? livingSurface ?? 0 : livingSurface ?? landSurface ?? 0;
  const rooms = toNumber(row.nbdepces ?? "");
  const bedrooms = toNumber(row.nbdechambres ?? "");
  const bathrooms = (toNumber(row.nbdesallebains ?? "") ?? 0) + (toNumber(row.nbdesalledeau ?? "") ?? 0);
  const sourceUrl = buildSourceUrl(lestyRef);
  const sourcePublicUrl = buildPublicSourceUrl(lestyRef);
  const photos = await discoverPhotos(lestyRef, maxPhotoIndex);

  if (city === "Non renseignee") flags.push("missing_city_fallback");
  if (postalCode === "00000") flags.push("missing_postal_code_fallback");
  if (!price || price <= 0) flags.push("missing_or_invalid_price");
  if (!surface || surface <= 0) flags.push("missing_or_invalid_surface");
  if (!title) flags.push("missing_title");
  if (probePhotos && photos.length === 0 && statusMapping.publicationStatus === "PUBLISHED") flags.push("published_without_detected_photos");

  const shouldForceUnpublished = [
    "missing_city_fallback",
    "missing_postal_code_fallback",
    "missing_or_invalid_price",
    "missing_or_invalid_surface",
  ].some((flag) => flags.includes(flag));
  const publicationStatus: PropertyPublicationStatus = shouldForceUnpublished ? "UNPUBLISHED" : statusMapping.publicationStatus;
  const isDiagnosticExempt = typeMapping.type === "land" || typeMapping.type === "parking";

  const match = findExistingMatch(row, existingProperties);
  if (match.ambiguous) flags.push(match.reason ?? "ambiguous_match");

  const record = typeMapping.type
    ? {
        reference: lestyRef,
        mandate_number: mandateNumber,
        slug: slugify(`${row.typebienCat || "bien"} ${city} ${postalCode} ref ${lestyRef}`),
        title,
        type: typeMapping.type,
        transaction_type: "sale" as const,
        status: statusMapping.legacyStatus,
        commercial_status: statusMapping.commercialStatus,
        publication_status: publicationStatus,
        city,
        postal_code: postalCode,
        price,
        fees_included: true,
        surface,
        land_surface: landSurface,
        rooms,
        bedrooms,
        bathrooms: bathrooms > 0 ? bathrooms : null,
        energy_class: buildDiagnostic(row.dpe_conso ?? "", "energy", isDiagnosticExempt),
        climate_class: buildDiagnostic(row.ges_emission ?? "", "climate", isDiagnosticExempt),
        description_short: truncateText(getFirst(row, ["resume_fr", "textePub", "desc_fr"]), 220),
        description_long: getFirst(row, ["textePub", "desc_fr", "resume_fr"]),
        features: buildFeatures(row),
        photos,
        featured: isTruthy(row.coupdecoeur ?? "") && publicationStatus === "PUBLISHED",
        source_url: sourceUrl,
        published_at: publicationStatus === "PUBLISHED" ? new Date().toISOString() : null,
        archived_at: null,
      }
    : null;

  const photoRows: ProposedPhotoRow[] = photos.map((photoUrl, index) => ({
    storage_bucket: "external",
    storage_path: `lesty/${lestyRef}/${basename(new URL(photoUrl).pathname)}`,
    public_url: photoUrl,
    alt_text: `${title} - photo ${index + 1}`,
    sort_order: index,
    is_primary: index === 0,
    status: "ACTIVE",
  }));

  const hardBlockFlags = flags.filter((flag) =>
    [
      "missing_lesty_ref",
    ].includes(flag)
  );
  const reviewFlags = flags.filter((flag) =>
    [
      "published_without_detected_photos",
    ].includes(flag) || (flag.startsWith("multiple_") && flag !== "multiple_statuses")
  );
  const action: ImportAction = hardBlockFlags.length > 0
    ? "blocked"
    : match.ambiguous || reviewFlags.length > 0
      ? "review"
      : match.row
        ? "update"
        : "create";

  return {
    lestyRef,
    mandateNumber,
    rawStatus,
    action,
    matchReason: match.reason,
    existingPropertyId: match.row?.id ?? null,
    flags,
    record,
    photoRows,
    sourcePublicUrl,
  };
}

function countBy<T extends Record<string, unknown>>(items: T[], field: keyof T) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const value = String(item[field] ?? "[vide]");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function duplicateCount(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.values()].filter((count) => count > 1).length;
}

function saveReport(report: unknown) {
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `lesty-properties-${apply ? "import" : "dry-run"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

function getSupabaseWriteClient() {
  loadLocalEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Variables Supabase manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises pour --apply.");
  }

  return createClient<LestyMigrationDatabase>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function copyPhotoToStorage(
  supabase: SupabaseClient,
  candidate: ImportCandidate,
  photo: ProposedPhotoRow
): Promise<ProposedPhotoRow> {
  if (!copyPhotos) return photo;

  const response = await fetch(photo.public_url);
  if (!response.ok) {
    photoWarnings.push(`Photo Lesty inaccessible conservee en URL externe pour ${candidate.lestyRef}: ${photo.public_url}`);
    return photo;
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    photoWarnings.push(`Photo Lesty non image conservee en URL externe pour ${candidate.lestyRef}: ${photo.public_url}`);
    return photo;
  }

  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const storagePath = photo.storage_path.replace(/^lesty\//, "properties/lesty/").replace(/\.[a-z0-9]+$/i, `.${extension}`);
  const bytes = await response.arrayBuffer();
  const { error } = await supabase.storage.from("property-photos").upload(storagePath, bytes, {
    contentType,
    upsert: true,
  });

  if (error) {
    photoWarnings.push(`Photo conservee en URL externe pour ${candidate.lestyRef}: ${error.message}`);
    return photo;
  }

  const { data } = supabase.storage.from("property-photos").getPublicUrl(storagePath);

  return {
    ...photo,
    storage_bucket: "property-photos",
    storage_path: storagePath,
    public_url: data.publicUrl,
  };
}

async function syncPropertyPhotos(
  supabase: SupabaseClient,
  propertyId: string,
  candidate: ImportCandidate
) {
  const preparedPhotos: ProposedPhotoRow[] = [];

  for (const photo of candidate.photoRows) {
    preparedPhotos.push(await copyPhotoToStorage(supabase, candidate, photo));
  }

  const wantedUrls = new Set(preparedPhotos.map((photo) => photo.public_url));
  const { data: existingPhotos, error: readError } = await supabase
    .from("property_photos")
    .select("id,public_url,status")
    .eq("property_id", propertyId);

  if (readError) {
    throw new Error(`Lecture photos impossible pour ${candidate.lestyRef}: ${readError.message}`);
  }

  const now = new Date().toISOString();
  const restoreUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const existingPhotoRows = (existingPhotos ?? []) as ExistingPropertyPhotoRow[];

  for (const existingPhoto of existingPhotoRows) {
    if (existingPhoto.status === "ACTIVE" && !wantedUrls.has(existingPhoto.public_url)) {
      const { error } = await supabase
        .from("property_photos")
        .update({
          status: "TRASHED",
          trashed_at: now,
          restore_until: restoreUntil,
        })
        .eq("id", existingPhoto.id);

      if (error) {
        throw new Error(`Mise en corbeille photo impossible pour ${candidate.lestyRef}: ${error.message}`);
      }
    }
  }

  const { error: primaryResetError } = await supabase
    .from("property_photos")
    .update({ is_primary: false })
    .eq("property_id", propertyId)
    .eq("status", "ACTIVE");

  if (primaryResetError) {
    throw new Error(`Reset photo principale impossible pour ${candidate.lestyRef}: ${primaryResetError.message}`);
  }

  for (const photo of preparedPhotos) {
    const { error } = await supabase.from("property_photos").upsert(
      {
        property_id: propertyId,
        storage_bucket: photo.storage_bucket,
        storage_path: photo.storage_path,
        public_url: photo.public_url,
        alt_text: photo.alt_text,
        sort_order: photo.sort_order,
        is_primary: photo.is_primary,
        status: "ACTIVE",
        restored_at: null,
        purged_at: null,
      },
      { onConflict: "property_id,public_url" }
    );

    if (error) {
      throw new Error(`Import photo impossible pour ${candidate.lestyRef}: ${error.message}`);
    }
  }

  return preparedPhotos;
}

async function applyCandidates(candidates: ImportCandidate[]) {
  const supabase = getSupabaseWriteClient();
  const imported: Array<{
    reference: string;
    action: ImportAction;
    publicationStatus: string;
    photoCount: number;
    copiedPhotos: boolean;
  }> = [];

  for (const candidate of candidates) {
    if (!candidate.record) continue;
    if (candidate.action === "blocked" || candidate.action === "review") {
      throw new Error(`Import bloque par ${candidate.action} sur la reference ${candidate.lestyRef}. Relancer le dry-run et corriger les flags avant --apply.`);
    }

    const { data: previousById } = candidate.existingPropertyId
      ? await supabase
          .from("properties")
          .select("*")
          .eq("id", candidate.existingPropertyId)
          .maybeSingle()
      : { data: null };

    const { data: previousByReference } = await supabase
      .from("properties")
      .select("*")
      .eq("reference", candidate.record.reference)
      .maybeSingle();

    const previous = previousByReference ?? previousById;
    const previousId = previous?.id as string | undefined;
    const shouldUpdateById = previousId && !previousByReference;

    const saveQuery = shouldUpdateById
      ? supabase
          .from("properties")
          .update(candidate.record)
          .eq("id", previousId)
          .select("id,reference,publication_status")
          .single()
      : supabase
          .from("properties")
          .upsert(candidate.record, { onConflict: "reference" })
          .select("id,reference,publication_status")
          .single();

    const { data: saved, error } = await saveQuery;

    if (error) {
      throw new Error(`Upsert bien impossible pour ${candidate.lestyRef}: ${error.message}`);
    }

    const savedProperty = saved as { id: string; reference: string; publication_status: string };
    const { data: possibleDuplicates, error: duplicateError } = await supabase
      .from("properties")
      .select("id,reference,source_url")
      .neq("id", savedProperty.id);

    if (duplicateError) {
      throw new Error(`Recherche doublons impossible pour ${candidate.lestyRef}: ${duplicateError.message}`);
    }

    const sourceDuplicates = (possibleDuplicates ?? []).filter((property) =>
      sourceUrlMatchesLestyRef(property.source_url, candidate.lestyRef)
    );

    for (const duplicate of sourceDuplicates ?? []) {
      await supabase
        .from("properties")
        .update({
          publication_status: "ARCHIVED",
          archived_at: new Date().toISOString(),
          featured: false,
        })
        .eq("id", duplicate.id);

      await supabase.from("property_history").insert({
        property_id: duplicate.id,
        reference: duplicate.reference,
        action: "lesty.import.archive_duplicate",
        changed_fields: ["publication_status", "archived_at", "featured"],
        previous_value: duplicate,
        next_value: { archivedBecause: savedProperty.reference },
        actor_email: "script:lesty-properties-import",
      });
    }

    const photos = await syncPropertyPhotos(supabase, savedProperty.id, candidate);

    await supabase.from("property_history").insert({
      property_id: savedProperty.id,
      reference: savedProperty.reference,
      action: previous ? "lesty.import.update" : "lesty.import.create",
      changed_fields: previous ? ["lesty_import"] : Object.keys(candidate.record),
      previous_value: previous ?? null,
      next_value: candidate.record,
      actor_email: "script:lesty-properties-import",
    });

    await supabase.from("activities").insert({
      entity_type: "property",
      entity_id: savedProperty.id,
      action: `Import Lesty : reference ${savedProperty.reference}`,
      user_name: "Import Lesty",
    });

    imported.push({
      reference: savedProperty.reference,
      action: candidate.action,
      publicationStatus: savedProperty.publication_status,
      photoCount: photos.length,
      copiedPhotos: copyPhotos,
    });
  }

  return imported;
}

async function main() {
  const biensPath = resolveBiensPath();
  const maxPhotoIndex = getNumberArg("--max-photo-index", probePhotos ? 40 : 20);
  const csv = parseCsv(readWindowsCsv(biensPath));
  const { available: supabaseComparisonAvailable, rows: existingProperties } = await loadExistingProperties();
  const candidates: ImportCandidate[] = [];

  for (const row of csv.rows) {
    candidates.push(await buildCandidate(row, existingProperties, maxPhotoIndex));
  }

  const slugs = candidates.map((candidate) => candidate.record?.slug ?? "").filter(Boolean);
  const references = candidates.map((candidate) => candidate.record?.reference ?? "").filter(Boolean);
  const blockersBeforeApply = [
    ...(duplicateCount(references) > 0 ? ["References proposees en doublon"] : []),
    ...(duplicateCount(slugs) > 0 ? ["Slugs proposes en doublon"] : []),
    ...(candidates.some((candidate) => candidate.action === "blocked") ? ["Payloads bloques a corriger"] : []),
    ...(candidates.some((candidate) => candidate.action === "review") ? ["Payloads en revue manuelle"] : []),
    ...(!probePhotos ? ["Photos non sondees : relancer avec --probe-photos avant import reel"] : []),
  ];
  const importResults = apply && blockersBeforeApply.length === 0 ? await applyCandidates(candidates) : [];
  const report = {
    success: true,
    mode: apply ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    writesPerformed: apply && importResults.length > 0,
    sourceFiles: {
      biens: basename(biensPath),
    },
    sourcePages,
    options: {
      probePhotos,
      copyPhotos,
      maxPhotoIndex,
      supabaseComparisonAvailable,
      referenceStrategy: "properties.reference = Lesty ref ; properties.mandate_number = numero mandat Lesty",
    },
    totals: {
      inputRows: csv.rows.length,
      validPayloads: candidates.filter((candidate) => candidate.record).length,
      create: candidates.filter((candidate) => candidate.action === "create").length,
      update: candidates.filter((candidate) => candidate.action === "update").length,
      review: candidates.filter((candidate) => candidate.action === "review").length,
      blocked: candidates.filter((candidate) => candidate.action === "blocked").length,
      detectedPhotos: candidates.reduce((total, candidate) => total + candidate.photoRows.length, 0),
      duplicateProposedReferences: duplicateCount(references),
      duplicateProposedSlugs: duplicateCount(slugs),
    },
    breakdowns: {
      actions: countBy(candidates, "action"),
      rawStatuses: countBy(candidates, "rawStatus"),
      commercialStatuses: countBy(
        candidates
          .map((candidate) => candidate.record)
          .filter((record): record is ProposedPropertyRecord => Boolean(record)),
        "commercial_status"
      ),
      publicationStatuses: countBy(
        candidates
          .map((candidate) => candidate.record)
          .filter((record): record is ProposedPropertyRecord => Boolean(record)),
        "publication_status"
      ),
    },
    blockersBeforeApply,
    importResults,
    photoWarnings,
    samples: candidates.slice(0, 10).map((candidate) => ({
      lestyRef: candidate.lestyRef,
      mandateNumber: candidate.mandateNumber,
      action: candidate.action,
      matchReason: candidate.matchReason,
      flags: candidate.flags,
      photoCount: candidate.photoRows.length,
      record: candidate.record
        ? {
            reference: candidate.record.reference,
            mandate_number: candidate.record.mandate_number,
            slug: candidate.record.slug,
            title: candidate.record.title,
            type: candidate.record.type,
            status: candidate.record.status,
            commercial_status: candidate.record.commercial_status,
            publication_status: candidate.record.publication_status,
            city: candidate.record.city,
            postal_code: candidate.record.postal_code,
            price: candidate.record.price,
            surface: candidate.record.surface,
            featured: candidate.record.featured,
          }
        : null,
    })),
    candidates,
  };

  if (writeReport) {
    const reportPath = saveReport(report);
    console.log(`Lesty properties ${apply ? "import" : "dry-run"} report written: ${reportPath}`);
  }

  console.log(
    JSON.stringify(
      {
        success: report.success,
        mode: report.mode,
        generatedAt: report.generatedAt,
        writesPerformed: report.writesPerformed,
        totals: report.totals,
        blockersBeforeApply: report.blockersBeforeApply,
        photoWarnings: report.photoWarnings.length,
        importResults: report.importResults.slice(0, 10),
        samples: report.samples,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const failureReport = {
    success: false,
    mode: apply ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    writesPerformed: false,
    error: message,
    actionsRequired: [
      "Verifier que les migrations Supabase sont appliquees.",
      "Relancer le dry-run avant tout nouvel import reel.",
      "Ne pas corriger manuellement en base sans rapport d'import.",
    ],
  };

  if (writeReport) {
    const reportPath = saveReport(failureReport);
    console.error(`Lesty properties failure report written: ${reportPath}`);
  }

  console.error(message);
  process.exit(1);
});

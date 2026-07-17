import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

type CsvRow = Record<string, string>;

type CountItem = {
  value: string;
  count: number;
};

type StatusMapping = {
  raw: string;
  commercialStatus: "AVAILABLE" | "UNDER_OFFER" | "SOLD";
  publicationStatus: "PUBLISHED" | "UNPUBLISHED";
  flags: string[];
};

const args = process.argv.slice(2);
const writeReport = args.includes("--write-report");
const reportDir = join(process.cwd(), "reports");

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

function resolveInputPath(argName: string, fallbackPrefix: string) {
  const explicit = getArgValue(argName);
  const path = explicit ?? latestDownloadMatching(fallbackPrefix);

  if (!path || !existsSync(path)) {
    throw new Error(`Fichier CSV introuvable pour ${argName}. Fournir ${argName} "C:\\\\chemin\\\\fichier.csv".`);
  }

  return path;
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

function countNonEmpty(rows: CsvRow[], column: string) {
  return rows.filter((row) => (row[column] ?? "").trim().length > 0).length;
}

function countDistinct(rows: CsvRow[], column: string) {
  return new Set(rows.map((row) => (row[column] ?? "").trim()).filter(Boolean)).size;
}

function countBy(rows: CsvRow[], column: string, limit = 20): CountItem[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = (row[column] ?? "").trim() || "[vide]";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

function duplicateGroupCount(rows: CsvRow[], column: string, normalizer = (value: string) => value.trim()) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = normalizer(row[column] ?? "");
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.values()].filter((count) => count > 1).length;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function mapLestyStatus(rawStatus: string): StatusMapping {
  const raw = rawStatus.trim();
  const parts = raw
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);
  const flags: string[] = [];

  if (parts.length === 0) {
    return {
      raw: "[vide]",
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
      raw,
      commercialStatus: "SOLD",
      publicationStatus: "UNPUBLISHED",
      flags,
    };
  }

  if (hasUnderOffer) {
    return {
      raw,
      commercialStatus: "UNDER_OFFER",
      publicationStatus: "PUBLISHED",
      flags,
    };
  }

  if (hasAvailable) {
    return {
      raw,
      commercialStatus: "AVAILABLE",
      publicationStatus: "PUBLISHED",
      flags,
    };
  }

  if (hasNonPublic) {
    return {
      raw,
      commercialStatus: "AVAILABLE",
      publicationStatus: "UNPUBLISHED",
      flags,
    };
  }

  return {
    raw,
    commercialStatus: "AVAILABLE",
    publicationStatus: "UNPUBLISHED",
    flags: ["unknown_status"],
  };
}

function summarizeStatusMappings(rows: CsvRow[]) {
  const mappings = rows.map((row) => mapLestyStatus(row.etat ?? ""));
  const byCommercial = countBy(
    mappings.map((mapping) => ({ value: mapping.commercialStatus })),
    "value",
    10
  );
  const byPublication = countBy(
    mappings.map((mapping) => ({ value: mapping.publicationStatus })),
    "value",
    10
  );
  const flags = new Map<string, number>();

  for (const mapping of mappings) {
    for (const flag of mapping.flags) {
      flags.set(flag, (flags.get(flag) ?? 0) + 1);
    }
  }

  return {
    byCommercial,
    byPublication,
    flags: [...flags.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
  };
}

function createReport(biensPath: string, contactsPath: string) {
  const biensCsv = parseCsv(readWindowsCsv(biensPath));
  const contactsCsv = parseCsv(readWindowsCsv(contactsPath));
  const biensRows = biensCsv.rows;
  const contactRows = contactsCsv.rows;

  const report = {
    success: true,
    mode: "dry-run",
    generatedAt: new Date().toISOString(),
    writesPerformed: false,
    sourceFiles: {
      biens: basename(biensPath),
      contacts: basename(contactsPath),
    },
    biens: {
      rows: biensRows.length,
      columns: biensCsv.headers.length,
      delimiter: biensCsv.delimiter,
      distinctRefs: countDistinct(biensRows, "ref"),
      duplicateRefGroups: duplicateGroupCount(biensRows, "ref"),
      duplicateMandateGroups: duplicateGroupCount(biensRows, "nummandat"),
      coverage: {
        publicTitle: countNonEmpty(biensRows, "titre_fr"),
        publicText: countNonEmpty(biensRows, "textePub"),
        descriptionFr: countNonEmpty(biensRows, "desc_fr"),
        price: countNonEmpty(biensRows, "prixdevente"),
        surface: countNonEmpty(biensRows, "surfacehabitable"),
        landSurface: countNonEmpty(biensRows, "surfaceterrain"),
        dpeValue: countNonEmpty(biensRows, "dpe_conso"),
        dpeClass: countNonEmpty(biensRows, "dpe_class"),
        gesValue: countNonEmpty(biensRows, "ges_emission"),
        gesClass: countNonEmpty(biensRows, "ges_class"),
        latitude: countNonEmpty(biensRows, "latitude"),
        longitude: countNonEmpty(biensRows, "longitude"),
        exports: countNonEmpty(biensRows, "exports"),
      },
      byEtat: countBy(biensRows, "etat", 20),
      byTypeCategory: countBy(biensRows, "typebienCat", 20),
      byTypeBase: countBy(biensRows, "typebase", 10),
      statusMapping: summarizeStatusMappings(biensRows),
      photos: {
        presentInCsv: biensCsv.headers.some((header) => /photo|image|visuel/i.test(header)),
        recommendation:
          "Les photos ne sont pas dans l'export CSV principal. Utiliser la galerie Lesty ou la convention /photo/immodreams/biens/{ref}-{index}.jpg en dry-run.",
      },
      adminOnlyFieldsToProtect: [
        "vendeur",
        "vendeurdetail",
        "vendeurjson",
        "adresse1",
        "adresse2",
        "bienNote",
        "commentaireAgence",
        "moyenVisite",
        "listeTiers",
      ],
    },
    contacts: {
      rows: contactRows.length,
      columns: contactsCsv.headers.length,
      delimiter: contactsCsv.delimiter,
      distinctRefs: countDistinct(contactRows, "ref"),
      coverage: {
        email: countNonEmpty(contactRows, "gc_mail1"),
        mobile: countNonEmpty(contactRows, "gc_mobile"),
        homePhone: countNonEmpty(contactRows, "gc_teldom"),
        linkedBiens: countNonEmpty(contactRows, "gc_listbiens"),
        linkedDemandes: countNonEmpty(contactRows, "gc_listdemandes"),
      },
      duplicateEmailGroups: duplicateGroupCount(contactRows, "gc_mail1", (value) => normalizeText(value)),
      duplicateMobileGroups: duplicateGroupCount(contactRows, "gc_mobile", (value) => value.replace(/[^0-9+]/g, "")),
      byTypeContact: countBy(contactRows, "gc_typecontact", 20),
      byActive: countBy(contactRows, "gc_actif", 10),
      byArchive: countBy(contactRows, "gc_archive", 10),
    },
    blockersBeforeImport: [
      ...(duplicateGroupCount(biensRows, "ref") > 0 ? ["References biens en doublon"] : []),
      ...(duplicateGroupCount(biensRows, "nummandat") > 0 ? ["Numeros de mandat en doublon a arbitrer"] : []),
      ...(summarizeStatusMappings(biensRows).flags.length > 0 ? ["Statuts Lesty mixtes ou manquants a normaliser"] : []),
      "Photos absentes du CSV principal : recuperation separee obligatoire",
      "Contacts et donnees proprietaires a garder hors lecture publique",
    ],
  };

  return report;
}

function saveReport(report: unknown) {
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `lesty-export-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

function main() {
  const biensPath = resolveInputPath("--biens", "biens");
  const contactsPath = resolveInputPath("--contacts", "ged_contact");
  const report = createReport(biensPath, contactsPath);

  if (writeReport) {
    const reportPath = saveReport(report);
    console.log(`Lesty export audit report written: ${reportPath}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

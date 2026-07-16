import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { properties } from "../src/data/properties";

type ImportAction = "create" | "update" | "unchanged";

type ImportReportItem = {
  reference: string;
  slug: string;
  title: string;
  action: ImportAction;
  photoCount: number;
};

type PropertyRow = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  updated_at: string;
};

const dryRun = !process.argv.includes("--apply");
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

function toCommercialStatus(status: string) {
  if (status === "under_offer") return "UNDER_OFFER";
  if (status === "sold") return "SOLD";
  return "AVAILABLE";
}

function toPublicationStatus(status: string) {
  return status === "sold" ? "UNPUBLISHED" : "PUBLISHED";
}

function getStoragePath(publicUrl: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return `external/${encodeURIComponent(publicUrl).slice(0, 220)}`;

  try {
    const expectedUrl = new URL(supabaseUrl);
    const photoUrl = new URL(publicUrl);
    const prefix = "/storage/v1/object/public/property-photos/";

    if (photoUrl.hostname === expectedUrl.hostname && photoUrl.pathname.startsWith(prefix)) {
      return decodeURIComponent(photoUrl.pathname.slice(prefix.length));
    }
  } catch {
    // External legacy URLs are valid import sources.
  }

  return `external/${encodeURIComponent(publicUrl).slice(0, 220)}`;
}

function toRecord(property: (typeof properties)[number]) {
  const publicationStatus = toPublicationStatus(property.status);

  return {
    reference: property.reference,
    mandate_number: property.mandateNumber,
    slug: property.slug,
    title: property.title,
    type: property.type,
    transaction_type: property.transactionType,
    status: property.status,
    commercial_status: toCommercialStatus(property.status),
    publication_status: publicationStatus,
    city: property.city,
    postal_code: property.postalCode,
    price: property.price,
    fees_included: property.feesIncluded,
    surface: property.surface,
    land_surface: property.landSurface,
    rooms: property.rooms,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    energy_class: property.energyClass,
    climate_class: property.climateClass,
    description_short: property.descriptionShort,
    description_long: property.descriptionLong,
    features: property.features,
    photos: property.photos,
    featured: property.featured && publicationStatus === "PUBLISHED",
    source_url: property.sourceUrl || null,
    published_at: publicationStatus === "PUBLISHED" ? property.updatedAt : null,
    archived_at: null,
  };
}

function writeReport(items: ImportReportItem[]) {
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `property-import-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "apply",
        generatedAt: new Date().toISOString(),
        total: items.length,
        created: items.filter((item) => item.action === "create").length,
        updated: items.filter((item) => item.action === "update").length,
        unchanged: items.filter((item) => item.action === "unchanged").length,
        items,
      },
      null,
      2
    )
  );
  return reportPath;
}

function writeFailureReport(message: string) {
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `property-import-failed-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        success: false,
        mode: dryRun ? "dry-run" : "apply",
        generatedAt: new Date().toISOString(),
        writesPerformed: false,
        error: message,
        actionsRequired: [
          "Verifier que .env.local cible bien l'environnement Supabase de test.",
          "Verifier l'acces reseau au projet Supabase depuis ce poste.",
          "Relancer npm run properties:import:dry-run avant tout import reel.",
        ],
      },
      null,
      2
    )
  );
  return reportPath;
}

async function main() {
  loadLocalEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const localReport = properties.map((property) => ({
      reference: property.reference,
      slug: property.slug,
      title: property.title,
      action: "create" as const,
      photoCount: property.photos.length,
    }));
    const reportPath = writeReport(localReport);
    console.log(`Supabase env missing. Local dry-run report written: ${reportPath}`);
    process.exit(dryRun ? 0 : 1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const report: ImportReportItem[] = [];

  for (const property of properties) {
    const record = toRecord(property);
    const { data: existing, error: readError } = await supabase
      .from("properties")
      .select("id,reference,slug,title,updated_at")
      .eq("reference", property.reference)
      .maybeSingle();

    if (readError) throw new Error(`Read failed for ${property.reference}: ${readError.message}`);

    const action: ImportAction = existing ? "update" : "create";
    report.push({
      reference: property.reference,
      slug: property.slug,
      title: property.title,
      action,
      photoCount: property.photos.length,
    });

    if (dryRun) continue;

    const { data: saved, error: upsertError } = await supabase
      .from("properties")
      .upsert(record, { onConflict: "reference" })
      .select("id,reference,slug,title,updated_at")
      .single();

    if (upsertError) throw new Error(`Upsert failed for ${property.reference}: ${upsertError.message}`);

    const savedProperty = saved as PropertyRow;
    for (const [index, photoUrl] of property.photos.entries()) {
      const storagePath = getStoragePath(photoUrl);
      const { error: photoError } = await supabase.from("property_photos").upsert(
        {
          property_id: savedProperty.id,
          storage_bucket: storagePath.startsWith("external/") ? "external" : "property-photos",
          storage_path: storagePath,
          public_url: photoUrl,
          alt_text: `${property.title} - photo ${index + 1}`,
          sort_order: index,
          is_primary: index === 0,
          status: "ACTIVE",
        },
        { onConflict: "property_id,public_url" }
      );

      if (photoError) throw new Error(`Photo import failed for ${property.reference}: ${photoError.message}`);
    }
  }

  const reportPath = writeReport(report);
  console.table(report);
  console.log(`Import report written: ${reportPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const reportPath = writeFailureReport(message);
  console.error(`Import failed. Failure report written: ${reportPath}`);
  console.error(message);
  process.exit(1);
});

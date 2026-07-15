import {
  properties as staticProperties,
  type Property,
  type PropertyStatus,
  type PropertyType,
} from "@/data/properties";
import { getSupabaseAdminClient } from "@/lib/supabase";

type PropertyRow = {
  id: string;
  reference: string;
  mandate_number: string | null;
  slug: string;
  title: string;
  type: PropertyType;
  transaction_type: "sale";
  status: PropertyStatus;
  city: string;
  postal_code: string;
  price: number | string;
  fees_included: boolean;
  surface: number | string;
  land_surface: number | string | null;
  rooms: number | string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  energy_class: string | null;
  climate_class: string | null;
  description_short: string | null;
  description_long: string | null;
  features: unknown;
  photos: unknown;
  featured: boolean;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

function fromDatabaseNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapPropertyRow(row: PropertyRow): Property {
  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug,
    title: row.title,
    type: row.type,
    transactionType: row.transaction_type,
    status: row.status,
    city: row.city,
    postalCode: row.postal_code,
    price: fromDatabaseNumber(row.price) ?? 0,
    feesIncluded: row.fees_included,
    surface: fromDatabaseNumber(row.surface) ?? 0,
    landSurface: fromDatabaseNumber(row.land_surface),
    rooms: fromDatabaseNumber(row.rooms),
    bedrooms: fromDatabaseNumber(row.bedrooms),
    bathrooms: fromDatabaseNumber(row.bathrooms),
    energyClass: row.energy_class ?? "Non renseigné",
    climateClass: row.climate_class ?? "Non renseigné",
    descriptionShort: row.description_short ?? "",
    descriptionLong: row.description_long ?? row.description_short ?? "",
    features: toStringArray(row.features),
    photos: toStringArray(row.photos),
    featured: row.featured,
    sourceUrl: row.source_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mandateNumber: row.mandate_number ?? row.reference,
  };
}

function mergePropertyCatalog(remoteProperties: Property[]) {
  const seen = new Set<string>();

  return [...remoteProperties, ...staticProperties].filter((property) => {
    const key = property.reference || property.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const legacyPropertySlugs: Record<string, string> = {
  "appartement-t2-lumineux-toulon": "appartement-toulon-83000-ref-72",
};

export async function getPublicProperties() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return staticProperties;

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[IMMO-DREAMS83] Public properties load failed", error.message);
    return staticProperties;
  }

  return mergePropertyCatalog(((data ?? []) as PropertyRow[]).map(mapPropertyRow));
}

export async function getAvailablePublicProperties() {
  return (await getPublicProperties()).filter((property) => property.status !== "sold");
}

export async function getFeaturedPublicProperties() {
  return (await getAvailablePublicProperties()).filter((property) => property.featured);
}

export async function getPublicPropertyBySlug(slug: string) {
  const canonicalSlug = legacyPropertySlugs[slug] ?? slug;
  return (await getPublicProperties()).find((property) => property.slug === canonicalSlug);
}

export async function getSimilarPublicProperties(property: Property, limit = 3) {
  return (await getAvailablePublicProperties())
    .filter((candidate) => {
      if (candidate.id === property.id) return false;
      return candidate.type === property.type || candidate.city === property.city;
    })
    .slice(0, limit);
}

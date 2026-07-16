import {
  type Property,
  type PropertyCommercialStatus,
  type PropertyPublicationStatus,
  type PropertyStatus,
  type PropertyType,
} from "@/data/properties";
import { getSupabaseClient } from "@/lib/supabase";

type PublicPropertyRow = {
  id: string;
  reference: string;
  mandate_number: string | null;
  slug: string;
  title: string;
  type: PropertyType;
  transaction_type: "sale";
  status: PropertyStatus | null;
  commercial_status: PropertyCommercialStatus | null;
  publication_status: PropertyPublicationStatus | null;
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
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
};

type SlugRedirectRow = {
  old_slug: string;
  new_slug: string;
};

function fromDatabaseNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapCommercialToLegacyStatus(status?: PropertyCommercialStatus | null): PropertyStatus {
  if (status === "UNDER_OFFER") return "under_offer";
  if (status === "SOLD") return "sold";
  return "available";
}

function normalizePublicationStatus(
  status?: PropertyPublicationStatus | null
): PropertyPublicationStatus {
  return status ?? "PUBLISHED";
}

function mapPublicPropertyRow(row: PublicPropertyRow): Property {
  const commercialStatus = row.commercial_status ?? (
    row.status === "under_offer" ? "UNDER_OFFER" : row.status === "sold" ? "SOLD" : "AVAILABLE"
  );
  const publicationStatus = normalizePublicationStatus(row.publication_status);

  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug,
    title: row.title,
    type: row.type,
    transactionType: row.transaction_type,
    status: mapCommercialToLegacyStatus(commercialStatus),
    commercialStatus,
    publicationStatus,
    city: row.city,
    postalCode: row.postal_code,
    price: fromDatabaseNumber(row.price) ?? 0,
    feesIncluded: row.fees_included,
    surface: fromDatabaseNumber(row.surface) ?? 0,
    landSurface: fromDatabaseNumber(row.land_surface),
    rooms: fromDatabaseNumber(row.rooms),
    bedrooms: fromDatabaseNumber(row.bedrooms),
    bathrooms: fromDatabaseNumber(row.bathrooms),
    energyClass: row.energy_class ?? "Non renseigne",
    climateClass: row.climate_class ?? "Non renseigne",
    descriptionShort: row.description_short ?? "",
    descriptionLong: row.description_long ?? row.description_short ?? "",
    features: toStringArray(row.features),
    photos: toStringArray(row.photos),
    featured: row.featured,
    sourceUrl: "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    mandateNumber: row.mandate_number ?? row.reference,
  };
}

async function getCanonicalSlug(slug: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return slug;

  const { data, error } = await supabase
    .from("public_property_slug_redirects")
    .select("old_slug,new_slug")
    .eq("old_slug", slug)
    .maybeSingle();

  if (error || !data) return slug;
  return (data as SlugRedirectRow).new_slug || slug;
}

export async function getPublicProperties() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("public_properties")
    .select(
      "id,reference,mandate_number,slug,title,type,transaction_type,status,commercial_status,publication_status,city,postal_code,price,fees_included,surface,land_surface,rooms,bedrooms,bathrooms,energy_class,climate_class,description_short,description_long,features,photos,featured,created_at,updated_at,published_at,archived_at"
    )
    .order("featured", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[IMMO-DREAMS83] Public properties load failed", error.message);
    return [];
  }

  return ((data ?? []) as PublicPropertyRow[]).map(mapPublicPropertyRow);
}

export async function getAvailablePublicProperties() {
  return (await getPublicProperties()).filter(
    (property) => property.publicationStatus === "PUBLISHED" && property.status !== "sold"
  );
}

export async function getFeaturedPublicProperties() {
  return (await getAvailablePublicProperties()).filter((property) => property.featured);
}

export async function getPublicPropertyBySlug(slug: string) {
  const properties = await getAvailablePublicProperties();
  const directMatch = properties.find((property) => property.slug === slug);
  if (directMatch) return directMatch;

  const canonicalSlug = await getCanonicalSlug(slug);
  if (canonicalSlug === slug) return undefined;

  return properties.find((property) => property.slug === canonicalSlug);
}

export async function getSimilarPublicProperties(property: Property, limit = 3) {
  return (await getAvailablePublicProperties())
    .filter((candidate) => {
      if (candidate.id === property.id) return false;
      return candidate.type === property.type || candidate.city === property.city;
    })
    .slice(0, limit);
}

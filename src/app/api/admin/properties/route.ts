import { NextRequest, NextResponse } from "next/server";
import {
  properties as staticProperties,
  type Property,
  type PropertyStatus,
  type PropertyType,
} from "@/data/properties";
import {
  FieldErrors,
  getStringField,
  hasRequiredValue,
  isPositiveNumberLike,
} from "@/lib/lead-validation";
import { getSupabaseAdminClient } from "@/lib/supabase";

const propertyTypes = ["apartment", "house", "land"] as const satisfies PropertyType[];
const propertyStatuses = [
  "available",
  "under_offer",
  "sold",
] as const satisfies PropertyStatus[];

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

function isAuthorized(request: NextRequest) {
  const expectedCode = process.env.NEXT_PUBLIC_ADMIN_LOCAL_CODE;
  return Boolean(expectedCode && request.headers.get("x-admin-code") === expectedCode);
}

function toNullableNumber(value: string) {
  if (!value) return null;
  const parsed = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toRequiredNumber(value: string) {
  return Number(value.replace(",", ".").replace(/\s/g, ""));
}

function fromDatabaseNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getStringArrayField(payload: unknown, field: string) {
  if (!payload || typeof payload !== "object") return [];

  return toStringArray((payload as Record<string, unknown>)[field]).map((item) => item.trim()).filter(Boolean);
}

function splitMultilineList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getNextReference(references: string[]) {
  const maxReference = references.reduce((max, reference) => {
    if (!/^\d+$/.test(reference)) return max;
    return Math.max(max, Number(reference));
  }, 0);

  return String(maxReference + 1).padStart(3, "0");
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

function validatePropertyPayload(payload: unknown) {
  const title = getStringField(payload, "title");
  const type = getStringField(payload, "type");
  const status = getStringField(payload, "status");
  const city = getStringField(payload, "city");
  const postalCode = getStringField(payload, "postalCode");
  const price = getStringField(payload, "price");
  const surface = getStringField(payload, "surface");
  const landSurface = getStringField(payload, "landSurface");
  const rooms = getStringField(payload, "rooms");
  const bedrooms = getStringField(payload, "bedrooms");
  const bathrooms = getStringField(payload, "bathrooms");
  const energyClass = getStringField(payload, "energyClass");
  const climateClass = getStringField(payload, "climateClass");
  const descriptionShort = getStringField(payload, "descriptionShort");
  const descriptionLong = getStringField(payload, "descriptionLong");
  const featuresText = getStringField(payload, "featuresText");
  const photoUrls = getStringArrayField(payload, "photoUrls");
  const featured = Boolean(
    payload && typeof payload === "object" && (payload as Record<string, unknown>).featured
  );
  const fieldErrors: FieldErrors = {};

  if (!hasRequiredValue(title)) fieldErrors.title = "Le titre est obligatoire.";
  if (!propertyTypes.includes(type as PropertyType)) fieldErrors.type = "Le type de bien est obligatoire.";
  if (!propertyStatuses.includes(status as PropertyStatus)) fieldErrors.status = "Le statut est obligatoire.";
  if (!hasRequiredValue(city)) fieldErrors.city = "La ville est obligatoire.";
  if (!hasRequiredValue(postalCode)) fieldErrors.postalCode = "Le code postal est obligatoire.";
  if (!isPositiveNumberLike(price)) fieldErrors.price = "Le prix doit être supérieur à 0.";
  if (!isPositiveNumberLike(surface)) fieldErrors.surface = "La surface doit être supérieure à 0.";
  if (!hasRequiredValue(descriptionShort)) {
    fieldErrors.descriptionShort = "La description courte est obligatoire.";
  }

  if (photoUrls.some((photo) => !isHttpUrl(photo))) {
    fieldErrors.photoUrls = "Les photos doivent provenir du module d'upload.";
  }

  return {
    data: {
      title,
      type: type as PropertyType,
      status: status as PropertyStatus,
      city,
      postalCode,
      price,
      surface,
      landSurface,
      rooms,
      bedrooms,
      bathrooms,
      energyClass,
      climateClass,
      descriptionShort,
      descriptionLong,
      features: splitMultilineList(featuresText),
      photos: photoUrls,
      featured,
    },
    fieldErrors,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[IMMO-DREAMS83] Admin properties load failed", error.message);
    return NextResponse.json({ success: false, message: "Les biens n'ont pas pu être chargés." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    properties: ((data ?? []) as PropertyRow[]).map(mapPropertyRow),
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const { data, fieldErrors } = validatePropertyPayload(payload);

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { success: false, message: "Certains champs doivent être corrigés.", fieldErrors },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configuré." }, { status: 503 });
  }

  const { data: existingProperties, error: referenceError } = await supabase
    .from("properties")
    .select("reference");

  if (referenceError) {
    console.error("[IMMO-DREAMS83] Property reference generation failed", referenceError.message);
    return NextResponse.json({ success: false, message: "La référence automatique n'a pas pu être générée." }, { status: 500 });
  }

  const reference = getNextReference([
    ...staticProperties.map((property) => property.reference),
    ...((existingProperties ?? []) as Array<{ reference: string }>).map((property) => property.reference),
  ]);
  const slug = `${slugify(data.title)}-${slugify(data.city)}-${data.postalCode}-ref-${reference}`;

  const { data: property, error } = await supabase
    .from("properties")
    .insert({
      reference,
      mandate_number: reference,
      slug,
      title: data.title,
      type: data.type,
      transaction_type: "sale",
      status: data.status,
      city: data.city,
      postal_code: data.postalCode,
      price: toRequiredNumber(data.price),
      fees_included: true,
      surface: toRequiredNumber(data.surface),
      land_surface: toNullableNumber(data.landSurface),
      rooms: toNullableNumber(data.rooms),
      bedrooms: toNullableNumber(data.bedrooms),
      bathrooms: toNullableNumber(data.bathrooms),
      energy_class: data.energyClass || "Non renseigné",
      climate_class: data.climateClass || "Non renseigné",
      description_short: data.descriptionShort,
      description_long: data.descriptionLong || data.descriptionShort,
      features: data.features,
      photos: data.photos,
      featured: data.featured,
      source_url: null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[IMMO-DREAMS83] Admin property creation failed", error.message);
    return NextResponse.json({ success: false, message: "Le bien n'a pas pu être créé." }, { status: 500 });
  }

  await supabase.from("activities").insert({
    entity_type: "property",
    entity_id: property.id,
    action: `Bien créé : référence ${reference}`,
    user_name: "Administration locale",
  });

  return NextResponse.json({
    success: true,
    message: `Bien créé avec la référence ${reference}.`,
    property: mapPropertyRow(property as PropertyRow),
  });
}

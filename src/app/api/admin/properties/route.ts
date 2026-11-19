import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, writeAdminAuditLog } from "@/lib/admin-auth";
import {
  type Property,
  type PropertyCommercialStatus,
  type PropertyHistoryItem,
  type PropertyPublicationStatus,
  type PropertyStatus,
  type PropertyType,
} from "@/data/properties";
import {
  FieldErrors,
  getStringField,
  hasRequiredValue,
  isPositiveNumberLike,
} from "@/lib/lead-validation";
import { formatClimateDiagnostic, formatEnergyDiagnostic, parseDiagnosticValue } from "@/lib/dpe";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { parsePropertyNumber, propertyDetailSchema, propertyWorkspaceFields } from "@/lib/property-workspace";
import type { AdminSession } from "@/types/admin";
import type { Json } from "@/types/supabase";
import { z } from "zod";

const propertyTypes = ["apartment", "house", "land", "commercial", "parking", "other"] as const satisfies PropertyType[];
const propertyStatuses = ["available", "under_offer", "sold"] as const satisfies PropertyStatus[];
const publicationStatuses = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const satisfies PropertyPublicationStatus[];
const bucketName = "property-photos";

type PropertyRow = {
  id: string;
  reference: string;
  mandate_number: string | null;
  slug: string;
  title: string;
  type: PropertyType;
  transaction_type: "sale";
  status: PropertyStatus;
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
  source_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  street_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  owner_contact_id?: string | null;
  advisor_id?: string | null;
  workspace_details?: Json;
  scheduled_publication_at?: string | null;
  publication_schedule_error?: string | null;
};

type PropertyHistoryRow = {
  id: string;
  property_id: string;
  action: string;
  changed_fields: unknown;
  previous_value: Record<string, unknown> | null;
  next_value: Record<string, unknown> | null;
  actor_email: string | null;
  created_at: string;
};

type PropertyPhotoRow = {
  id: string;
  public_url: string;
  status: "ACTIVE" | "TRASHED" | "PURGED";
};

type PublicationPatch = {
  publication_status: PropertyPublicationStatus;
  published_at: string | null;
  unpublished_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
};

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

function mapLegacyToCommercialStatus(status: PropertyStatus): PropertyCommercialStatus {
  if (status === "under_offer") return "UNDER_OFFER";
  if (status === "sold") return "SOLD";
  return "AVAILABLE";
}

function mapCommercialToLegacyStatus(status: PropertyCommercialStatus | null, fallback: PropertyStatus): PropertyStatus {
  if (status === "UNDER_OFFER") return "under_offer";
  if (status === "SOLD") return "sold";
  if (status === "AVAILABLE") return "available";
  return fallback;
}

function normalizePublicationStatus(value: string): PropertyPublicationStatus {
  return publicationStatuses.includes(value as PropertyPublicationStatus)
    ? (value as PropertyPublicationStatus)
    : "DRAFT";
}

function normalizeHistory(row: PropertyHistoryRow): PropertyHistoryItem {
  return {
    id: row.id,
    action: row.action,
    changedFields: toStringArray(row.changed_fields),
    previousValue: row.previous_value,
    nextValue: row.next_value,
    actorEmail: row.actor_email,
    createdAt: row.created_at,
  };
}

function mapPropertyRow(row: PropertyRow, history: PropertyHistoryItem[] = []): Property {
  const details = propertyDetailSchema.safeParse(row.workspace_details);
  const commercialStatus = row.commercial_status ?? mapLegacyToCommercialStatus(row.status);
  const publicationStatus = row.publication_status ?? (
    row.status === "sold" ? "UNPUBLISHED" : "PUBLISHED"
  );

  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug,
    title: row.title,
    type: row.type,
    transactionType: row.transaction_type,
    status: mapCommercialToLegacyStatus(commercialStatus, row.status),
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
    sourceUrl: row.source_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    streetAddress: row.street_address ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    ownerContactId: row.owner_contact_id ?? null,
    advisorId: row.advisor_id ?? null,
    workspaceDetails: details.data,
    scheduledPublicationAt: row.scheduled_publication_at ?? null,
    publicationScheduleError: row.publication_schedule_error ?? null,
    mandateNumber: row.mandate_number ?? row.reference,
    history,
  };
}

function validatePropertyPayload(payload: unknown) {
  const reference = getStringField(payload, "reference");
  const mandateNumber = getStringField(payload, "mandateNumber");
  const slug = getStringField(payload, "slug");
  const sourceUrl = getStringField(payload, "sourceUrl");
  const title = getStringField(payload, "title");
  const type = getStringField(payload, "type");
  const status = getStringField(payload, "status");
  const publicationStatus = normalizePublicationStatus(getStringField(payload, "publicationStatus"));
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
  const landOptions = getStringArrayField(payload, "landOptions");
  const photoUrls = getStringArrayField(payload, "photoUrls");
  const featured = Boolean(
    payload && typeof payload === "object" && (payload as Record<string, unknown>).featured
  );
  const fieldErrors: FieldErrors = {};
  let workspace: z.infer<typeof propertyWorkspaceFields> | undefined;
  if (payload && typeof payload === "object" && "workspaceDetails" in payload) {
    const parsed = propertyWorkspaceFields.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      fieldErrors[String(issue?.path.at(-1) ?? "workspaceDetails")] = "Vérifiez cette information du dossier.";
    } else {
      workspace = parsed.data;
      const latitude = parsePropertyNumber(workspace.latitude);
      const longitude = parsePropertyNumber(workspace.longitude);
      if ((workspace.latitude || workspace.longitude) && !(Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180)) {
        fieldErrors.latitude = "Indiquez une latitude et une longitude valides, ou laissez les deux champs vides.";
      }
    }
  }

  if (!hasRequiredValue(title)) fieldErrors.title = "Le titre est obligatoire.";
  if (!propertyTypes.includes(type as PropertyType)) fieldErrors.type = "Le type de bien est obligatoire.";
  if (!propertyStatuses.includes(status as PropertyStatus)) fieldErrors.status = "Le statut commercial est obligatoire.";
  if (!hasRequiredValue(city)) fieldErrors.city = "La ville est obligatoire.";
  if (!hasRequiredValue(postalCode)) fieldErrors.postalCode = "Le code postal est obligatoire.";
  if (!isPositiveNumberLike(price)) fieldErrors.price = "Le prix doit etre superieur a 0.";
  if (!isPositiveNumberLike(surface)) fieldErrors.surface = "La surface doit etre superieure a 0.";
  const skipsDiagnostics = type === "land" || type === "parking";
  if (!skipsDiagnostics && energyClass && parseDiagnosticValue(energyClass) === null) {
    fieldErrors.energyClass = "La consommation energie doit etre un nombre.";
  }
  if (!skipsDiagnostics && climateClass && parseDiagnosticValue(climateClass) === null) {
    fieldErrors.climateClass = "La classe climat doit etre un nombre.";
  }
  if (!hasRequiredValue(descriptionShort)) {
    fieldErrors.descriptionShort = "La description courte est obligatoire.";
  }

  if (photoUrls.some((photo) => !isHttpUrl(photo))) {
    fieldErrors.photoUrls = "Les photos doivent provenir du module d'upload.";
  }

  return {
    data: {
      title,
      reference,
      mandateNumber,
      slug,
      sourceUrl,
      type: type as PropertyType,
      status: status as PropertyStatus,
      commercialStatus: mapLegacyToCommercialStatus(status as PropertyStatus),
      publicationStatus,
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
      features: Array.from(new Set([...splitMultilineList(featuresText), ...landOptions])),
      photos: photoUrls,
      featured,
      workspace,
    },
    fieldErrors,
  };
}

async function verifyPropertyContacts(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  session: AdminSession,
  workspace: ReturnType<typeof validatePropertyPayload>["data"]["workspace"],
  existing?: PropertyRow,
) {
  const ownerId = workspace?.ownerContactId;
  const advisorId = workspace?.advisorId;
  if (ownerId && ownerId !== existing?.owner_contact_id) {
    let contacts = supabase.from("contacts").select("id").eq("id", ownerId).eq("archived", false);
    if (session.profile.role === "AGENT") contacts = contacts.eq("assigned_to", session.user.id);
    const owner = await contacts.maybeSingle();
    if (owner.error) return NextResponse.json({ success: false, message: "Le propriétaire ne peut pas être vérifié." }, { status: 503 });
    if (!owner.data) return NextResponse.json({ success: false, message: "Le propriétaire sélectionné n’est pas accessible." }, { status: 400 });
  }
  if (advisorId && advisorId !== existing?.advisor_id) {
    const advisor = await supabase.from("profiles").select("id").eq("id", advisorId).eq("is_active", true)
      .in("role", ["ADMIN", "DIRECTOR", "AGENT", "ASSISTANT"]).maybeSingle();
    if (advisor.error) return NextResponse.json({ success: false, message: "Le conseiller ne peut pas être vérifié." }, { status: 503 });
    if (!advisor.data) return NextResponse.json({ success: false, message: "Le conseiller sélectionné n’est pas actif." }, { status: 400 });
  }
  return null;
}

function getPublicationPatch(
  publicationStatus: PropertyPublicationStatus,
  existing?: PropertyRow | null
): PublicationPatch {
  const now = new Date().toISOString();

  if (publicationStatus === "PUBLISHED") {
    return {
      publication_status: publicationStatus,
      published_at: existing?.published_at ?? now,
      unpublished_at: null,
      archived_at: null,
      archived_by: null,
    };
  }

  if (publicationStatus === "ARCHIVED") {
    return {
      publication_status: publicationStatus,
      published_at: existing?.published_at ?? null,
      unpublished_at: existing?.unpublished_at ?? now,
      archived_at: existing?.archived_at ?? now,
      archived_by: existing?.archived_by ?? null,
    };
  }

  if (publicationStatus === "UNPUBLISHED") {
    return {
      publication_status: publicationStatus,
      published_at: existing?.published_at ?? null,
      unpublished_at: now,
      archived_at: null,
      archived_by: null,
    };
  }

  return {
    publication_status: publicationStatus,
    published_at: existing?.published_at ?? null,
    unpublished_at: existing?.unpublished_at ?? null,
    archived_at: null,
    archived_by: null,
  };
}

function buildPropertyRecord(
  data: ReturnType<typeof validatePropertyPayload>["data"],
  reference: string,
  slug: string,
  actorId: string,
  existing?: PropertyRow | null
) {
  const isLand = data.type === "land";
  const skipsDiagnostics = data.type === "land" || data.type === "parking";
  const publicationPatch = getPublicationPatch(data.publicationStatus, existing);
  const workspace = data.workspace;

  return {
    reference,
    mandate_number: data.mandateNumber || reference,
    slug,
    title: data.title,
    type: data.type,
    transaction_type: "sale",
    status: data.status,
    commercial_status: data.commercialStatus,
    city: data.city,
    postal_code: data.postalCode,
    price: toRequiredNumber(data.price),
    fees_included: true,
    surface: toRequiredNumber(data.surface),
    land_surface: isLand ? toRequiredNumber(data.surface) : toNullableNumber(data.landSurface),
    rooms: isLand ? null : toNullableNumber(data.rooms),
    bedrooms: isLand ? null : toNullableNumber(data.bedrooms),
    bathrooms: isLand ? null : toNullableNumber(data.bathrooms),
    energy_class: skipsDiagnostics ? "Non soumis" : formatEnergyDiagnostic(data.energyClass),
    climate_class: skipsDiagnostics ? "Non soumis" : formatClimateDiagnostic(data.climateClass),
    description_short: data.descriptionShort,
    description_long: data.descriptionLong || data.descriptionShort,
    features: data.features,
    photos: data.photos,
    featured: data.featured && data.publicationStatus === "PUBLISHED",
    source_url: data.sourceUrl || null,
    updated_by: actorId,
    ...publicationPatch,
    archived_by: data.publicationStatus === "ARCHIVED" ? actorId : publicationPatch.archived_by,
    ...(existing?.scheduled_publication_at && data.publicationStatus === "PUBLISHED" ? {
      scheduled_publication_at: null, publication_scheduled_by: null, publication_schedule_error: null,
    } : {}),
    ...(workspace ? {
      street_address: workspace.streetAddress || null,
      latitude: workspace.latitude ? parsePropertyNumber(workspace.latitude) : null,
      longitude: workspace.longitude ? parsePropertyNumber(workspace.longitude) : null,
      owner_contact_id: workspace.ownerContactId || null,
      advisor_id: workspace.advisorId || null,
      workspace_details: workspace.workspaceDetails,
    } : {}),
  };
}

function getStoragePathFromPublicUrl(photoUrl: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const expectedUrl = new URL(supabaseUrl);
    const publicUrl = new URL(photoUrl);
    const publicPathPrefix = `/storage/v1/object/public/${bucketName}/`;

    if (publicUrl.hostname !== expectedUrl.hostname) return null;
    if (!publicUrl.pathname.startsWith(publicPathPrefix)) return null;

    const storagePath = decodeURIComponent(publicUrl.pathname.slice(publicPathPrefix.length));
    if (!storagePath || storagePath.startsWith("/") || storagePath.includes("..")) return null;
    if (!storagePath.startsWith("properties/")) return null;

    return storagePath;
  } catch {
    return null;
  }
}

function getChangedFields(previousValue: Record<string, unknown> | null, nextValue: Record<string, unknown>) {
  if (!previousValue) return Object.keys(nextValue);

  return Object.keys(nextValue).filter((key) => {
    return JSON.stringify(previousValue[key]) !== JSON.stringify(nextValue[key]);
  });
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

async function writePropertyHistory(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  session: AdminSession,
  action: string,
  propertyId: string,
  reference: string,
  previousValue: Record<string, unknown> | null,
  nextValue: Record<string, unknown>
) {
  const changedFields = getChangedFields(previousValue, nextValue);
  if (action === "property.update" && changedFields.length === 0) return;

  const { error } = await supabase.from("property_history").insert({
    property_id: propertyId,
    reference,
    action,
    changed_fields: changedFields,
    previous_value: previousValue ? toJson(previousValue) : null,
    next_value: toJson(nextValue),
    actor_id: session.user.id,
    actor_email: session.user.email,
  });

  if (error) {
    console.error("[IMMO-DREAMS83] Property history write failed", error.message);
  }
}

async function syncPropertyPhotos(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  property: PropertyRow,
  photoUrls: string[],
  actorId: string
) {
  const { data: existingRows, error: readError } = await supabase
    .from("property_photos")
    .select("id,public_url,status")
    .eq("property_id", property.id);

  if (readError) {
    console.error("[IMMO-DREAMS83] Property photo sync read failed", readError.message);
    return;
  }

  const wantedUrls = new Set(photoUrls);
  const existing = ((existingRows ?? []) as PropertyPhotoRow[]);

  await Promise.all(
    existing
      .filter((photo) => photo.status === "ACTIVE" && !wantedUrls.has(photo.public_url))
      .map((photo) =>
        supabase
          .from("property_photos")
          .update({
            status: "TRASHED",
            trashed_at: new Date().toISOString(),
            trashed_by: actorId,
            restore_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", photo.id)
      )
  );

  await Promise.all(
    photoUrls.map((url, index) => {
      const storagePath = getStoragePathFromPublicUrl(url) ?? `external/${encodeURIComponent(url).slice(0, 220)}`;

      return supabase.from("property_photos").upsert(
        {
          property_id: property.id,
          storage_bucket: storagePath.startsWith("external/") ? "external" : bucketName,
          storage_path: storagePath,
          public_url: url,
          alt_text: `${property.title} - photo ${index + 1}`,
          sort_order: index,
          is_primary: index === 0,
          status: "ACTIVE",
          restored_at: null,
          purged_at: null,
        },
        { onConflict: "property_id,public_url" }
      );
    })
  );
}

async function getPropertyHistoryMap(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  propertyIds: string[]
) {
  if (propertyIds.length === 0) return new Map<string, PropertyHistoryItem[]>();

  const { data, error } = await supabase
    .from("property_history")
    .select("id,property_id,action,changed_fields,previous_value,next_value,actor_email,created_at")
    .in("property_id", propertyIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[IMMO-DREAMS83] Property history load failed", error.message);
    return new Map<string, PropertyHistoryItem[]>();
  }

  return ((data ?? []) as PropertyHistoryRow[]).reduce((map, row) => {
    const items = map.get(row.property_id) ?? [];
    items.push(normalizeHistory(row));
    map.set(row.property_id, items.slice(0, 8));
    return map;
  }, new Map<string, PropertyHistoryItem[]>());
}

export async function GET() {
  const auth = await requireAdminSession("crm.read");
  if (auth.response) return auth.response;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[IMMO-DREAMS83] Admin properties load failed", error.message);
    return NextResponse.json({ success: false, message: "Les biens n'ont pas pu etre charges." }, { status: 500 });
  }

  const rows = (data ?? []) as PropertyRow[];
  const historyMap = await getPropertyHistoryMap(supabase, rows.map((property) => property.id));

  return NextResponse.json({
    success: true,
    properties: rows.map((row) => mapPropertyRow(row, historyMap.get(row.id) ?? [])),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession("property.write");
  if (auth.response) return auth.response;

  const payload = await request.json().catch(() => null);
  const { data, fieldErrors } = validatePropertyPayload(payload);

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { success: false, message: "Certains champs doivent etre corriges.", fieldErrors },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const draftId = getStringField(payload, "draftId");
  if (draftId) {
    if (!z.uuid().safeParse(draftId).success) {
      return NextResponse.json({ success: false, message: "Identifiant de brouillon invalide." }, { status: 400 });
    }
    const { data: draft, error: draftError } = await supabase
      .from("property_drafts").select("id").eq("id", draftId).eq("author_id", auth.session.user.id).maybeSingle();
    if (draftError) return NextResponse.json({ success: false, message: "Le brouillon n’a pas pu être vérifié." }, { status: 503 });
    if (!draft) return NextResponse.json({ success: false, message: "Brouillon introuvable." }, { status: 404 });
    const { data: saved, error: savedError } = await supabase
      .from("properties").select("*").eq("id", draftId).eq("created_by", auth.session.user.id).maybeSingle();
    if (savedError) return NextResponse.json({ success: false, message: "Le bien n’a pas pu être retrouvé." }, { status: 503 });
    if (saved) return NextResponse.json({ success: true, reused: true, property: mapPropertyRow(saved as PropertyRow) });
  }

  const contactError = await verifyPropertyContacts(supabase, auth.session, data.workspace);
  if (contactError) return contactError;

  const { data: existingProperties, error: referenceError } = await supabase
    .from("properties")
    .select("reference");

  if (referenceError) {
    console.error("[IMMO-DREAMS83] Property reference generation failed", referenceError.message);
    return NextResponse.json({ success: false, message: "La reference automatique n'a pas pu etre generee." }, { status: 500 });
  }

  const reference = getNextReference(
    ((existingProperties ?? []) as Array<{ reference: string }>).map((property) => property.reference)
  );
  const slug = `${slugify(data.title)}-${slugify(data.city)}-${data.postalCode}-ref-${reference}`;
  const record = {
    ...buildPropertyRecord(data, reference, slug, auth.session.user.id),
    created_by: auth.session.user.id,
    ...(draftId ? { id: draftId } : {}),
  };

  const { data: property, error } = await supabase
    .from("properties")
    .insert(record)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23514" && data.publicationStatus === "PUBLISHED")
      return NextResponse.json({ success: false, message: error.message }, { status: 422 });
    if (draftId && error.code === "23505") {
      const { data: saved } = await supabase.from("properties").select("*")
        .eq("id", draftId).eq("created_by", auth.session.user.id).maybeSingle();
      if (saved) return NextResponse.json({ success: true, reused: true, property: mapPropertyRow(saved as PropertyRow) });
      return NextResponse.json({ success: false, message: "Création concurrente. Réessayez pour obtenir une nouvelle référence." }, { status: 409 });
    }
    console.error("[IMMO-DREAMS83] Admin property creation failed", error.message);
    return NextResponse.json({ success: false, message: "Le bien n'a pas pu etre cree." }, { status: 500 });
  }

  const propertyRow = property as PropertyRow;
  await syncPropertyPhotos(supabase, propertyRow, data.photos, auth.session.user.id);
  await writePropertyHistory(supabase, auth.session, "property.create", propertyRow.id, reference, null, record);

  const actorName = auth.session.profile.full_name ?? auth.session.user.email;
  await supabase.from("activities").insert({
    entity_type: "property",
    entity_id: propertyRow.id,
    action: `Bien cree : reference ${reference}`,
    user_name: actorName,
  });
  await writeAdminAuditLog(auth.session, "property.create", "property", propertyRow.id, {
    reference,
    publicationStatus: data.publicationStatus,
  });

  return NextResponse.json({
    success: true,
    message: `Bien cree avec la reference ${reference}.`,
    property: mapPropertyRow(propertyRow),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession("property.write");
  if (auth.response) return auth.response;

  const payload = await request.json().catch(() => null);
  const { data, fieldErrors } = validatePropertyPayload(payload);

  if (!hasRequiredValue(data.reference)) {
    fieldErrors.reference = "La reference du bien est obligatoire pour modifier un bien.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { success: false, message: "Certains champs doivent etre corriges.", fieldErrors },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase serveur n'est pas configure." }, { status: 503 });
  }

  const reference = data.reference;
  const { data: existingProperty, error: lookupError } = await supabase
    .from("properties")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  const existing = existingProperty as PropertyRow | null;
  if (lookupError) return NextResponse.json({ success: false, message: "La lecture du bien a échoué." }, { status: 503 });
  if (!existing) return NextResponse.json({ success: false, message: "Bien introuvable." }, { status: 404 });
  const contactError = await verifyPropertyContacts(supabase, auth.session, data.workspace, existing);
  if (contactError) return contactError;
  const expectedUpdatedAt = getStringField(payload, "expectedUpdatedAt") || existing.updated_at;
  if (!Number.isFinite(Date.parse(expectedUpdatedAt))) {
    return NextResponse.json({ success: false, message: "Version du bien invalide." }, { status: 400 });
  }
  const record = buildPropertyRecord(data, reference, existing.slug, auth.session.user.id, existing);

  const { data: property, error } = await supabase
    .from("properties")
    .update(record)
    .eq("id", existing.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23514" && data.publicationStatus === "PUBLISHED")
      return NextResponse.json({ success: false, message: error.message }, { status: 422 });
    console.error("[IMMO-DREAMS83] Admin property update failed", error.message);
    return NextResponse.json({ success: false, message: "Le bien n'a pas pu etre mis a jour." }, { status: 500 });
  }
  if (!property) {
    return NextResponse.json(
      { success: false, message: "Ce bien a été modifié ailleurs. Rechargez sa dernière version avant de réessayer." },
      { status: 409 },
    );
  }

  await supabase.from("property_versions").insert({
    property_id: existing.id,
    reference,
    snapshot: toJson(existing),
    changed_by: auth.session.user.id,
    change_reason: "admin.patch",
  });

  const propertyRow = property as PropertyRow;
  await syncPropertyPhotos(supabase, propertyRow, data.photos, auth.session.user.id);
  await writePropertyHistory(
    supabase,
    auth.session,
    "property.update",
    propertyRow.id,
    reference,
    existing ?? null,
    record
  );

  const actorName = auth.session.profile.full_name ?? auth.session.user.email;
  await supabase.from("activities").insert({
    entity_type: "property",
    entity_id: propertyRow.id,
    action: `Bien mis a jour : reference ${reference}`,
    user_name: actorName,
  });
  await writeAdminAuditLog(auth.session, "property.update", "property", propertyRow.id, {
    reference,
    publicationStatus: data.publicationStatus,
  });

  const historyMap = await getPropertyHistoryMap(supabase, [propertyRow.id]);

  return NextResponse.json({
    success: true,
    message: `Bien ${reference} mis a jour.`,
    property: mapPropertyRow(propertyRow, historyMap.get(propertyRow.id) ?? []),
  });
}

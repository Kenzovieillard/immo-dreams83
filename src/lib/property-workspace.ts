import { z } from "zod";
import {
  propertyTypeLabels,
  type Property,
  type PropertyHistoryItem,
} from "@/data/properties";
import { getPropertyDpePosition, parseDiagnosticValue } from "@/lib/dpe";

export const propertyKinds = [
  "apartment",
  "house",
  "land",
  "commercial",
  "parking",
  "other",
] as const;
export const documentKinds = [
  "mandate",
  "diagnostic",
  "plan",
  "cadastral_plan",
  "ownership",
  "other",
] as const;
export const documentKindLabels = {
  mandate: "Mandat",
  diagnostic: "Diagnostic",
  plan: "Plan",
  cadastral_plan: "Plan cadastral",
  ownership: "Titre de propriété",
  other: "Autre",
} satisfies Record<(typeof documentKinds)[number], string>;

const shortText = z.string().trim().max(240);
const optionalId = z.union([z.literal(""), z.uuid()]);
const optionalHttpsUrl = z.union([
  z.literal(""),
  z.url({ protocol: /^https$/ }).max(1500),
]);
const optionalAmount = z
  .string()
  .trim()
  .max(24)
  .refine(
    (value) => !value || /^\d+(?:[,.]\d{1,2})?$/.test(value.replace(/\s/g, "")),
  );
const yesNo = z.enum(["", "yes", "no"]);

export const propertyDetailSchema = z.object({
  constructionYear: shortText,
  condition: shortText,
  plannedMandateType: z.enum(["", "simple", "exclusive", "semi_exclusive"]),
  agencyFee: optionalAmount,
  videoUrl: optionalHttpsUrl,
  tourUrl: optionalHttpsUrl,
  district: shortText.default(""),
  floor: shortText.default(""),
  heating: shortText.default(""),
  exposure: shortText.default(""),
  condo: yesNo.default(""),
  propertyTax: optionalAmount.default(""),
  condoFees: optionalAmount.default(""),
  pendingProceeding: yesNo.default(""),
  diagnosticsDate: z.union([z.literal(""), z.iso.date()]).default(""),
  diagnostician: shortText.default(""),
  roomDetails: z
    .array(z.object({ label: shortText, surface: optionalAmount }))
    .max(50)
    .default([]),
});

export const emptyPropertyDetails: PropertyWorkspaceDetails = {
  constructionYear: "",
  condition: "",
  plannedMandateType: "",
  agencyFee: "",
  videoUrl: "",
  tourUrl: "",
  district: "",
  floor: "",
  heating: "",
  exposure: "",
  condo: "",
  propertyTax: "",
  condoFees: "",
  pendingProceeding: "",
  diagnosticsDate: "",
  diagnostician: "",
  roomDetails: [],
};

export const propertyWorkspaceFields = z.object({
  streetAddress: shortText,
  latitude: shortText,
  longitude: shortText,
  ownerContactId: optionalId,
  advisorId: optionalId,
  workspaceDetails: propertyDetailSchema,
});

export const propertyDraftFormSchema = propertyWorkspaceFields.extend({
  title: shortText,
  type: z.enum(propertyKinds),
  city: shortText,
  postalCode: shortText,
  price: shortText,
  surface: shortText,
  landSurface: shortText,
  rooms: shortText,
  bedrooms: shortText,
  bathrooms: shortText,
  energyClass: shortText,
  climateClass: shortText,
  mandateNumber: shortText,
  descriptionShort: z.string().trim().max(500),
  descriptionLong: z.string().trim().max(10000),
  featuresText: z.string().trim().max(3000),
});

export type PropertyWorkspaceDetails = z.infer<typeof propertyDetailSchema>;
export type PropertyDraftForm = z.infer<typeof propertyDraftFormSchema>;
export const draftAssetSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(240),
    mimeType: z.enum([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ]),
    kind: z.enum(["photo", ...documentKinds]),
  })
  .refine(({ kind, mimeType }) =>
    kind === "photo"
      ? mimeType.startsWith("image/")
      : ["application/pdf", "image/jpeg", "image/png"].includes(mimeType),
  );
export const draftAssetsSchema = z
  .array(draftAssetSchema)
  .max(36)
  .refine(
    (assets) =>
      new Set(assets.map(({ id }) => id)).size === assets.length &&
      assets.filter(({ kind }) => kind === "photo").length <= 12,
  );
export type PropertyDraftAsset = z.infer<typeof draftAssetSchema>;
export type PropertyDraft = {
  id: string;
  step: number;
  form: PropertyDraftForm;
  attachments?: PropertyDraftAsset[];
  updatedAt: string;
};

export const emptyPropertyDraft: PropertyDraftForm = {
  title: "",
  type: "house",
  city: "",
  postalCode: "",
  price: "",
  surface: "",
  landSurface: "",
  rooms: "",
  bedrooms: "",
  bathrooms: "",
  energyClass: "",
  climateClass: "",
  mandateNumber: "",
  descriptionShort: "",
  descriptionLong: "",
  featuresText: "",
  streetAddress: "",
  latitude: "",
  longitude: "",
  ownerContactId: "",
  advisorId: "",
  workspaceDetails: emptyPropertyDetails,
};

export type PropertyPerson = { id: string; name: string };
export type PropertyDocument = {
  id: string;
  fileName: string;
  kind: (typeof documentKinds)[number];
  createdAt: string;
  folderId?: string | null;
  sizeBytes?: number | null;
};
export type PropertyDocumentFolder = { id: string; name: string };

export type PropertyRelations = {
  owner: PropertyPerson | null;
  advisor: PropertyPerson | null;
  mandates: {
    id: string;
    reference: string;
    type: string;
    status: string;
    signedAt: string | null;
    expiresAt: string | null;
  }[];
  buyers: {
    id: string;
    name: string;
    budget: number | null;
    criteria: string[];
    status: string;
  }[];
  visits: {
    id: string;
    title: string;
    startsAt: string;
    status: string;
    interest: number | null;
    reportSubmittedAt: string | null;
  }[];
  offers: {
    id: string;
    amount: number | null;
    status: string;
    createdAt: string;
  }[];
  activities: {
    id: string;
    action: string;
    author: string | null;
    createdAt: string;
  }[];
};

export function propertySearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

export function propertySearchMatches(property: Property, value: string) {
  const text = [
    property.id,
    property.reference,
    property.mandateNumber,
    property.title,
    property.city,
    property.postalCode,
    property.streetAddress,
    propertyTypeLabels[property.type],
  ]
    .filter(Boolean)
    .join(" ");
  return propertySearchText(value)
    .split(/\s+/)
    .every((word) => propertySearchText(text).includes(word));
}

export function parsePropertyNumber(value: string) {
  return value.trim()
    ? Number(value.replace(/\s/g, "").replace(",", "."))
    : NaN;
}

export function propertyMissingFields(property: Property) {
  const missing = [];
  if (!property.photos.length) missing.push("Photo principale");
  if (!(property.price > 0)) missing.push("Prix");
  if (!(property.surface > 0)) missing.push("Surface");
  if (!property.descriptionShort?.trim()) missing.push("Description");
  if (
    !["land", "parking"].includes(property.type) &&
    !getPropertyDpePosition(property.energyClass, property.climateClass)
  ) {
    missing.push("DPE / GES");
  }
  return missing;
}

export function propertyDraftErrors(form: PropertyDraftForm) {
  const fields: Partial<Record<keyof PropertyDraftForm, string>> = {};
  if (!form.title.trim()) fields.title = "Renseignez le titre du bien.";
  if (!form.city.trim()) fields.city = "Renseignez la commune.";
  if (
    !/^\d{5}$/.test(form.postalCode.trim()) ||
    form.postalCode.trim() === "00000"
  )
    fields.postalCode = "Saisissez un code postal à cinq chiffres.";
  if (!(parsePropertyNumber(form.price) > 0))
    fields.price = "Saisissez un prix supérieur à zéro.";
  if (!(parsePropertyNumber(form.surface) > 0))
    fields.surface = "Saisissez une surface supérieure à zéro.";
  if (!form.descriptionShort.trim())
    fields.descriptionShort = "Ajoutez une description courte.";
  const latitude = parsePropertyNumber(form.latitude);
  const longitude = parsePropertyNumber(form.longitude);
  if (
    (form.latitude || form.longitude) &&
    !(Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180)
  ) {
    fields.latitude =
      "Indiquez une latitude et une longitude valides, ou laissez les deux champs vides.";
  }
  for (const field of ["rooms", "bedrooms", "bathrooms"] as const) {
    if (
      form[field] &&
      !(
        Number.isInteger(parsePropertyNumber(form[field])) &&
        parsePropertyNumber(form[field]) >= 0
      )
    ) {
      fields[field] = "Saisissez un nombre entier positif ou nul.";
    }
  }
  if (form.landSurface && !(parsePropertyNumber(form.landSurface) >= 0))
    fields.landSurface = "Saisissez une surface positive ou nulle.";
  return fields;
}

export const propertyDocumentLimit = 4 * 1024 * 1024;

export const propertyAvailability = {
  available: "Disponible",
  under_offer: "Réservé",
  sold: "Vendu",
} as const;

export const propertyPublicationLabels = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  UNPUBLISHED: "Dépublié",
  ARCHIVED: "Archivé",
} as const;

export const requiredPropertyPhotos = 5;
export const requiredPropertyDocuments = {
  ownership: "Titre de propriété",
  cadastral_plan: "Plan cadastral",
} as const;

export function propertyPublicationCompleteness(
  photoCount: number,
  documentKinds: Iterable<string>,
) {
  const present = new Set(documentKinds);
  return {
    missingPhotos: Math.max(0, requiredPropertyPhotos - photoCount),
    missingDocuments: Object.entries(requiredPropertyDocuments)
      .filter(([kind]) => !present.has(kind))
      .map(([, name]) => name),
  };
}

export const propertyActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("availability"),
    value: z.enum(["available", "under_offer", "sold"]),
  }),
  z.object({ action: z.literal("feature"), value: z.boolean() }),
  z.object({ action: z.enum(["archive", "restore", "publish", "unpublish"]) }),
]);
export type PropertyAction = z.infer<typeof propertyActionSchema>;
export type PropertyActionUpdate = Pick<
  Property,
  | "status"
  | "commercialStatus"
  | "publicationStatus"
  | "featured"
  | "publishedAt"
  | "archivedAt"
  | "scheduledPublicationAt"
  | "publicationScheduleError"
  | "updatedAt"
> & { historyEvent?: PropertyHistoryItem | null };

export function propertyCanAppearOnHome(property: Property) {
  return (
    property.publicationStatus === "PUBLISHED" &&
    property.status !== "sold" &&
    !property.archivedAt
  );
}

export function propertyDocumentUrl(propertyId: string, documentId?: string) {
  const base = `/api/admin/properties/${encodeURIComponent(propertyId)}/documents`;
  return documentId
    ? `${base}?document=${encodeURIComponent(documentId)}`
    : base;
}

export function propertyToDraft(property: Property): PropertyDraftForm {
  return {
    title: property.title,
    type: property.type,
    city: property.city,
    postalCode: property.postalCode,
    price: String(property.price),
    surface: String(property.surface),
    landSurface: String(property.landSurface ?? ""),
    rooms: String(property.rooms ?? ""),
    bedrooms: String(property.bedrooms ?? ""),
    bathrooms: String(property.bathrooms ?? ""),
    energyClass: String(parseDiagnosticValue(property.energyClass) ?? ""),
    climateClass: String(parseDiagnosticValue(property.climateClass) ?? ""),
    mandateNumber: property.mandateNumber ?? "",
    descriptionShort: property.descriptionShort ?? "",
    descriptionLong: property.descriptionLong ?? "",
    featuresText: property.features.join("\n"),
    streetAddress: property.streetAddress ?? "",
    latitude: String(property.latitude ?? ""),
    longitude: String(property.longitude ?? ""),
    ownerContactId: property.ownerContactId ?? "",
    advisorId: property.advisorId ?? "",
    workspaceDetails: property.workspaceDetails ?? emptyPropertyDetails,
  };
}

export function propertyMutationPayload(property: Property) {
  return {
    ...propertyToDraft(property),
    reference: property.reference,
    status: property.status,
    publicationStatus: property.publicationStatus ?? "DRAFT",
    sourceUrl: property.sourceUrl,
    photoUrls: property.photos,
    featured: property.featured,
    expectedUpdatedAt: property.updatedAt,
  };
}

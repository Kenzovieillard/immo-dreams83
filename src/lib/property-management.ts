import {
  formatPrice,
  type Property,
  type PropertyPublicationStatus,
  type PropertyStatus,
  type PropertyType,
  propertyPublicationStatusLabels,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/data/properties";

export type PropertyInventoryMetric = {
  label: string;
  value: string;
  description: string;
};

export type PropertyBreakdownItem = {
  key: string;
  label: string;
  count: number;
};

export const propertyImportSource = {
  name: "Annonces officielles IMMO-DREAMS83",
  currentSource: "Supabase public_properties",
  futureSource: "Supabase source unique",
  importedAt: "2026-07-15",
  note: "Le catalogue public est lu depuis Supabase. Le fichier statique sert seulement de seed d'import.",
};

export function isPubliclyVisibleProperty(property: Property) {
  return property.publicationStatus === "PUBLISHED" && property.status !== "sold";
}

export function getPropertyInventoryMetrics(properties: Property[]): PropertyInventoryMetric[] {
  const onlineProperties = properties.filter(isPubliclyVisibleProperty);
  const featuredProperties = onlineProperties.filter((property) => property.featured);
  const totalValue = onlineProperties.reduce((sum, property) => sum + property.price, 0);
  const averagePrice = onlineProperties.length > 0 ? totalValue / onlineProperties.length : 0;

  return [
    {
      label: "Biens en ligne",
      value: String(onlineProperties.length),
      description: "Publies et non vendus.",
    },
    {
      label: "A la une",
      value: String(featuredProperties.length),
      description: "Biens publies mis en avant sur l'accueil.",
    },
    {
      label: "Valeur catalogue",
      value: formatPrice(totalValue),
      description: "Somme des prix affiches en ligne.",
    },
    {
      label: "Prix moyen",
      value: formatPrice(Math.round(averagePrice)),
      description: "Moyenne des biens publies disponibles.",
    },
  ];
}

export function getPropertyStatusBreakdown(properties: Property[]): PropertyBreakdownItem[] {
  const statuses: PropertyStatus[] = ["available", "under_offer", "sold"];

  return statuses.map((status) => ({
    key: status,
    label: propertyStatusLabels[status],
    count: properties.filter((property) => property.status === status).length,
  }));
}

export function getPropertyPublicationBreakdown(properties: Property[]): PropertyBreakdownItem[] {
  const statuses: PropertyPublicationStatus[] = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];

  return statuses.map((status) => ({
    key: status,
    label: propertyPublicationStatusLabels[status],
    count: properties.filter((property) => property.publicationStatus === status).length,
  }));
}

export function getPropertyTypeBreakdown(properties: Property[]): PropertyBreakdownItem[] {
  const types: PropertyType[] = ["apartment", "house", "land"];

  return types.map((type) => ({
    key: type,
    label: type === "apartment" ? "Appartements" : `${propertyTypeLabels[type]}s`,
    count: properties.filter((property) => property.type === type).length,
  }));
}

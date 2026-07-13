import {
  formatPrice,
  type Property,
  type PropertyStatus,
  type PropertyType,
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
  currentSource: "src/data/properties.ts",
  futureSource: "Supabase properties",
  importedAt: "2026-06-24",
  note: "Les biens publics restent versionnés dans le code tant que l'édition Supabase n'est pas activée.",
};

export function getPropertyInventoryMetrics(properties: Property[]): PropertyInventoryMetric[] {
  const onlineProperties = properties.filter((property) => property.status !== "sold");
  const featuredProperties = properties.filter((property) => property.featured);
  const totalValue = onlineProperties.reduce((sum, property) => sum + property.price, 0);
  const averagePrice = onlineProperties.length > 0 ? totalValue / onlineProperties.length : 0;

  return [
    {
      label: "Biens en ligne",
      value: String(onlineProperties.length),
      description: "Hors biens marqués comme vendus.",
    },
    {
      label: "À la une",
      value: String(featuredProperties.length),
      description: "Biens mis en avant sur l'accueil.",
    },
    {
      label: "Valeur catalogue",
      value: formatPrice(totalValue),
      description: "Somme des prix affichés en ligne.",
    },
    {
      label: "Prix moyen",
      value: formatPrice(Math.round(averagePrice)),
      description: "Moyenne des biens disponibles.",
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

export function getPropertyTypeBreakdown(properties: Property[]): PropertyBreakdownItem[] {
  const types: PropertyType[] = ["apartment", "house", "land"];

  return types.map((type) => ({
    key: type,
    label: type === "apartment" ? "Appartements" : `${propertyTypeLabels[type]}s`,
    count: properties.filter((property) => property.type === type).length,
  }));
}


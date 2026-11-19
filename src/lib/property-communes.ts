import { propertySearchText } from "@/lib/property-workspace";

export type CommuneCentre = {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type PropertyCommuneIndex = Record<string, CommuneCentre[]>;

export function isMapPostalCode(value: string) {
  return /^(?!00000)\d{5}$/.test(value);
}

function normalizeCommuneName(value: string) {
  return propertySearchText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findPropertyCommune(
  city: string,
  postalCode: string,
  index: PropertyCommuneIndex,
) {
  if (!isMapPostalCode(postalCode)) return undefined;
  const candidates = index[postalCode] ?? [];
  const name = normalizeCommuneName(city);
  const exact = candidates.find(
    (commune) => normalizeCommuneName(commune.name) === name,
  );
  if (exact) return exact;
  // A unique postcode can cover a locality or an arrondissement in the same commune.
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function groupPropertiesByCommune<
  T extends { city: string; postalCode: string },
>(properties: T[], index: PropertyCommuneIndex) {
  const groups = new Map<string, { centre: CommuneCentre; properties: T[] }>();
  const unlocated: T[] = [];
  for (const property of properties) {
    const centre = findPropertyCommune(
      property.city,
      property.postalCode,
      index,
    );
    if (!centre) {
      unlocated.push(property);
      continue;
    }
    const group = groups.get(centre.code);
    if (group) group.properties.push(property);
    else groups.set(centre.code, { centre, properties: [property] });
  }
  return {
    groups: Array.from(groups.values()).sort((a, b) =>
      a.centre.name.localeCompare(b.centre.name, "fr"),
    ),
    unlocated,
  };
}

import reference from "@/data/property-commune-centres.json";
import type {
  CommuneCentre,
  PropertyCommuneIndex,
} from "@/lib/property-communes";

type ReferenceRow = [
  code: string,
  name: string,
  latitude: number,
  longitude: number,
  postalCodes: string[],
];

const byPostalCode = new Map<string, CommuneCentre[]>();
for (const [
  code,
  name,
  latitude,
  longitude,
  postalCodes,
] of reference as ReferenceRow[]) {
  const centre = { code, name, latitude, longitude };
  for (const postalCode of postalCodes) {
    const entries = byPostalCode.get(postalCode);
    if (entries) entries.push(centre);
    else byPostalCode.set(postalCode, [centre]);
  }
}

export function readCommuneReference(
  postalCodes: string[],
): PropertyCommuneIndex {
  return Object.fromEntries(
    postalCodes.map((code) => [code, byPostalCode.get(code) ?? []]),
  );
}

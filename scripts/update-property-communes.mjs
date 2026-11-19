import { writeFile } from "node:fs/promises";

const postalSource =
  "https://data.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/metadata-attachments/base-officielle-codes-postaux.csv";
const communeSource =
  "https://unpkg.com/@etalab/decoupage-administratif@6.0.0/data/communes.json";

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

const [csv, communes] = await Promise.all([
  download(postalSource).then((response) => response.text()),
  download(communeSource).then((response) => response.json()),
]);
const [header, ...lines] = csv.split(/\r?\n/);
if (!header.endsWith('"_geopoint","latitude","longitude"')) {
  throw new Error("Colonnes de localisation La Poste inattendues.");
}

const centres = new Map();
for (const line of lines) {
  const code = line.match(/^"([0-9AB]{5})",/)?.[1];
  const coordinates = line.match(/,"(-?\d+(?:\.\d+)?)","(-?\d+(?:\.\d+)?)"$/);
  if (code && coordinates && !centres.has(code)) {
    centres.set(code, coordinates.slice(1).map(Number));
  }
}

const byParent = new Map();
for (const { code, commune, type } of communes) {
  if (type !== "arrondissement-municipal" || !commune || !centres.has(code)) {
    continue;
  }
  if (!byParent.has(commune)) byParent.set(commune, []);
  byParent.get(commune).push(centres.get(code));
}

const rows = [];
for (const { code, nom, type, codesPostaux } of communes) {
  if (type !== "commune-actuelle" || !codesPostaux?.length) continue;
  let centre = centres.get(code);
  const districts = byParent.get(code);
  // Paris, Lyon et Marseille n'ont que leurs arrondissements dans l'export postal.
  if (!centre && districts?.length) {
    centre = [0, 1].map(
      (axis) =>
        districts.reduce((sum, point) => sum + point[axis], 0) /
        districts.length,
    );
  }
  if (!centre) continue;
  const [latitude, longitude] = centre.map((coordinate) =>
    Number(coordinate.toFixed(5)),
  );
  rows.push([code, nom, latitude, longitude, codesPostaux]);
}

if (rows.length < 34_000) throw new Error("Référentiel communal incomplet.");
const target = new URL(
  "../src/data/property-commune-centres.json",
  import.meta.url,
);
await writeFile(
  target,
  `[\n${rows.map((row) => JSON.stringify(row)).join(",\n")}\n]\n`,
);
console.log(`${rows.length} communes avec coordonnées.`);

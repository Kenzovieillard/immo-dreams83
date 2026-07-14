export type DpeLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type DpeAssessment = {
  letter: DpeLetter;
  value: number;
  unit: string;
  index: number;
  range: string;
};

export const dpeLetters: DpeLetter[] = ["A", "B", "C", "D", "E", "F", "G"];

type DiagnosticThreshold = {
  letter: DpeLetter;
  max: number;
  range: string;
};

const energyThresholds = [
  { letter: "A", max: 70, range: "≤ 70" },
  { letter: "B", max: 110, range: "71 à 110" },
  { letter: "C", max: 180, range: "111 à 180" },
  { letter: "D", max: 250, range: "181 à 250" },
  { letter: "E", max: 330, range: "251 à 330" },
  { letter: "F", max: 420, range: "331 à 420" },
  { letter: "G", max: Infinity, range: "> 420" },
] satisfies DiagnosticThreshold[];

const climateThresholds = [
  { letter: "A", max: 6, range: "≤ 6" },
  { letter: "B", max: 11, range: "7 à 11" },
  { letter: "C", max: 30, range: "12 à 30" },
  { letter: "D", max: 50, range: "31 à 50" },
  { letter: "E", max: 70, range: "51 à 70" },
  { letter: "F", max: 100, range: "71 à 100" },
  { letter: "G", max: Infinity, range: "> 100" },
] satisfies DiagnosticThreshold[];

export const energyUnit = "kWhEP/m².an";
export const climateUnit = "kg eqCO2/m².an";

export const dpeBadgeClasses: Record<DpeLetter, string> = {
  A: "bg-emerald-600 text-white",
  B: "bg-green-500 text-white",
  C: "bg-lime-400 text-[#111111]",
  D: "bg-yellow-300 text-[#111111]",
  E: "bg-orange-400 text-white",
  F: "bg-orange-600 text-white",
  G: "bg-red-700 text-white",
};

export function parseDiagnosticValue(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (!value) return null;

  const parsed = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getAssessment(
  value: string | number | null | undefined,
  unit: string,
  thresholds: readonly DiagnosticThreshold[]
): DpeAssessment | null {
  const parsed = parseDiagnosticValue(value);
  if (parsed === null) return null;

  const threshold = thresholds.find((item) => parsed <= item.max) ?? thresholds[thresholds.length - 1];
  return {
    letter: threshold.letter,
    value: parsed,
    unit,
    index: dpeLetters.indexOf(threshold.letter),
    range: threshold.range,
  };
}

export function getEnergyAssessment(value: string | number | null | undefined) {
  return getAssessment(value, energyUnit, energyThresholds);
}

export function getClimateAssessment(value: string | number | null | undefined) {
  return getAssessment(value, climateUnit, climateThresholds);
}

export function getPropertyDpePosition(
  energyValue: string | number | null | undefined,
  climateValue: string | number | null | undefined
) {
  const energy = getEnergyAssessment(energyValue);
  const climate = getClimateAssessment(climateValue);
  if (!energy && !climate) return null;

  const retained = [energy, climate].filter(Boolean).sort((a, b) => b!.index - a!.index)[0];
  return retained ?? null;
}

export function formatEnergyDiagnostic(value: string | number | null | undefined, fallback = "Non renseigné") {
  const assessment = getEnergyAssessment(value);
  return assessment ? `${assessment.letter} - ${assessment.value} ${assessment.unit}` : fallback;
}

export function formatClimateDiagnostic(value: string | number | null | undefined, fallback = "Non renseigné") {
  const assessment = getClimateAssessment(value);
  return assessment ? `${assessment.letter} - ${assessment.value} ${assessment.unit}` : fallback;
}

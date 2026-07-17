import {
  type DpeAssessment,
  type DpeLetter,
  climateUnit,
  climateBadgeClasses,
  dpeBadgeClasses,
  dpeLetters,
  energyUnit,
  getClimateAssessment,
  getEnergyAssessment,
} from "@/lib/dpe";
import { cn } from "@/lib/utils";

type DiagnosticBarKind = "energy" | "climate";

type DiagnosticBarProps = {
  kind: DiagnosticBarKind;
  value: string | number | null | undefined;
  compact?: boolean;
  dark?: boolean;
};

const diagnosticLabels: Record<DiagnosticBarKind, string> = {
  energy: "DPE",
  climate: "GES",
};

function getAssessment(kind: DiagnosticBarKind, value: DiagnosticBarProps["value"]) {
  return kind === "energy" ? getEnergyAssessment(value) : getClimateAssessment(value);
}

function getUnit(kind: DiagnosticBarKind) {
  return kind === "energy" ? energyUnit : climateUnit;
}

function getBadgeClasses(kind: DiagnosticBarKind, letter: DpeLetter) {
  return kind === "energy" ? dpeBadgeClasses[letter] : climateBadgeClasses[letter];
}

function getLetterWidth(letter: DpeLetter) {
  const index = dpeLetters.indexOf(letter);
  return `${((index + 1) / dpeLetters.length) * 100}%`;
}

function DiagnosticValue({
  assessment,
  value,
  kind,
  dark,
}: {
  assessment: DpeAssessment | null;
  value: DiagnosticBarProps["value"];
  kind: DiagnosticBarKind;
  dark?: boolean;
}) {
  if (!assessment) {
    const unavailableLabel =
      typeof value === "string" && value.trim().toLowerCase().includes("non soumis")
        ? "Non soumis"
        : "Non renseigné";

    return (
      <span className={cn("text-xs font-semibold", dark ? "text-white/60" : "text-gray-500")}>
        {unavailableLabel}
      </span>
    );
  }

  return (
    <span className={cn("text-xs font-semibold", dark ? "text-white/80" : "text-gray-700")}>
      {assessment.value} {getUnit(kind)}
    </span>
  );
}

export function DiagnosticBar({ kind, value, compact = false, dark = false }: DiagnosticBarProps) {
  const assessment = getAssessment(kind, value);

  return (
    <div className={cn("grid gap-2", compact ? "text-xs" : "text-sm")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("font-black", dark ? "text-white" : "text-[#111111]")}>{diagnosticLabels[kind]}</span>
          {assessment ? (
            <span className={cn("rounded px-2 py-0.5 text-xs font-black", getBadgeClasses(kind, assessment.letter))}>
              {assessment.letter}
            </span>
          ) : null}
        </div>
        <DiagnosticValue assessment={assessment} value={value} kind={kind} dark={dark} />
      </div>

      <div className={cn("relative h-3 overflow-hidden rounded-full", dark ? "bg-white/15" : "bg-gray-100")}>
        <div className="grid h-full grid-cols-7">
          {dpeLetters.map((letter) => (
            <span key={letter} className={cn("h-full", getBadgeClasses(kind, letter))} />
          ))}
        </div>
        {assessment ? (
          <span
            className={cn(
              "absolute inset-y-0 w-1 rounded-full ring-2",
              kind === "energy" ? "bg-[#111111] ring-white" : "bg-white ring-[#111111]/30"
            )}
            style={{ left: `calc(${getLetterWidth(assessment.letter)} - 4px)` }}
            aria-hidden="true"
          />
        ) : null}
      </div>

      {!compact && assessment ? (
        <p className={cn("text-xs", dark ? "text-white/60" : "text-gray-500")}>
          Classe {assessment.letter} · tranche {assessment.range} {assessment.unit}
        </p>
      ) : null}
    </div>
  );
}

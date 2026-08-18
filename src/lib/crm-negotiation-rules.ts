import type { NegotiationKpis, NegotiationStatus } from "@/types/crm";

export type NegotiationMetricInput = {
  status: NegotiationStatus;
  currentAmount: number;
  currentGapPercent: number;
  isUrgent: boolean;
  daysWithoutActivity: number;
  concludedAt: string | null;
};

const terminalStatuses = new Set<NegotiationStatus>(["ACCEPTED", "REJECTED", "EXPIRED", "CONCLUDED"]);

export function isNegotiationTerminal(status: NegotiationStatus) {
  return terminalStatuses.has(status);
}

export function requiresNegotiationAction(value: Pick<NegotiationMetricInput, "status" | "isUrgent" | "daysWithoutActivity">) {
  return !isNegotiationTerminal(value.status) && (value.isUrgent || value.daysWithoutActivity >= 3);
}

export function calculateNegotiationGap(askingPrice: number, currentAmount: number) {
  if (!Number.isFinite(askingPrice) || askingPrice <= 0 || !Number.isFinite(currentAmount)) return null;
  return Math.round(((currentAmount - askingPrice) / askingPrice) * 10_000) / 100;
}

export function calculateNegotiationKpis(rows: NegotiationMetricInput[], now = new Date()): NegotiationKpis {
  const active = rows.filter((row) => !isNegotiationTerminal(row.status));
  const gaps = active.map((row) => row.currentGapPercent);
  const acceptedThisMonth = rows.filter((row) => {
    if (!row.concludedAt || !["ACCEPTED", "CONCLUDED"].includes(row.status)) return false;
    const concluded = new Date(row.concludedAt);
    return concluded.getUTCFullYear() === now.getUTCFullYear() && concluded.getUTCMonth() === now.getUTCMonth();
  }).length;

  return {
    active: active.length,
    awaitingResponse: active.filter((row) => ["WAITING_SELLER", "WAITING_BUYER"].includes(row.status)).length,
    actionRequired: rows.filter(requiresNegotiationAction).length,
    acceptedThisMonth,
    averageGap: gaps.length ? Math.round((gaps.reduce((sum, value) => sum + value, 0) / gaps.length) * 10) / 10 : null,
    totalVolume: active.reduce((sum, row) => sum + row.currentAmount, 0),
  };
}

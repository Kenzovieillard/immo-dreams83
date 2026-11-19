// UI labels are separate from the persisted API enums.
export const commercialLabels: Record<string, string> = {
  NEW_REQUEST: "Nouvelle demande",
  TO_CONTACT: "À contacter",
  SCHEDULED: "Planifiée",
  COMPLETED: "Réalisée",
  REPORT_SENT: "Rapport envoyé",
  NO_FOLLOW_UP: "Sans suite",
  FINISHED: "Mandat obtenu",
  TO_CONFIRM: "À confirmer",
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée",
  DRAFT: "Brouillon",
  TO_BE_SIGNED: "À signer",
  SIGNED_BY_BUYER: "Signée acquéreur",
  SENT_TO_SELLER: "Présentée au vendeur",
  NEGOTIATING: "En négociation",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  WITHDRAWN: "Retirée",
  EXPIRED: "Expirée",
  CASH: "Comptant",
  LOAN: "Prêt immobilier",
  MIXED: "Financement mixte",
  UNKNOWN: "À préciser",
  CREATE_OFFER: "Préparation de l’offre d’achat",
  PLAN_SECOND_VISIT: "Planifier une autre visite",
  FOLLOW_UP_LATER: "Relancer plus tard",
  POSITIVE: "Positive",
  NEGATIVE: "Négative",
};
export const commercialLabel = (value: string) =>
  commercialLabels[value] ?? value;
export function commercialTone(
  status: string,
): "success" | "warning" | "danger" | "neutral" {
  if (
    ["ACCEPTED", "FINISHED", "CONFIRMED", "COMPLETED", "REPORT_SENT"].includes(
      status,
    )
  )
    return "success";
  if (["REJECTED", "WITHDRAWN", "CANCELLED", "NO_FOLLOW_UP"].includes(status))
    return "danger";
  if (
    ["TO_CONFIRM", "TO_CONTACT", "NEGOTIATING", "NEW_REQUEST"].includes(status)
  )
    return "warning";
  return "neutral";
}
export function money(value: number | null | undefined) {
  return value == null
    ? "Non renseigné"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value);
}
export function priceGap(amount: number, asking: number) {
  return asking > 0 ? ((amount - asking) / asking) * 100 : null;
}
export function parisDay(value: string) {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(
    new Date(value),
  );
}
export function shortDate(value: string | null, time = false) {
  if (!value) return "À planifier";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(new Date(value));
}
export function calendarDays(anchor: string, mode: "week" | "month") {
  const date = new Date(`${anchor}T12:00:00Z`);
  if (mode === "month") date.setUTCDate(1);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return Array.from({ length: mode === "week" ? 7 : 42 }, (_, index) => {
    const day = new Date(date);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

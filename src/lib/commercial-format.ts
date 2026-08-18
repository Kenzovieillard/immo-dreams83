export function formatCommercialPrice(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/\u202f/g, " ")} €`;
}

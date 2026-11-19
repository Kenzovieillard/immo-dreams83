// Shared by the admin entry points and the dedicated commercial shell.
export const commercialLinks = [
  { key: "pipeline", href: "/commercial/pipeline", label: "Pipeline" },
  { key: "estimations", href: "/commercial/estimations", label: "Estimations" },
  { key: "visites", href: "/commercial/visites", label: "Visites" },
  { key: "offres", href: "/commercial/offres", label: "Offres" },
  { key: "negociations", href: "/commercial/negociations", label: "Négociations" },
] as const;

export function commercialHrefForTab(tab: string | undefined): string | null {
  return commercialLinks.find((link) => link.key === tab)?.href ?? null;
}

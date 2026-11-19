export type PipelineKind = "buyers" | "sellers";

export type PipelineStage =
  | "BUYER_NEW"
  | "BUYER_QUALIFIED"
  | "BUYER_VISIT"
  | "BUYER_OFFER"
  | "BUYER_COMPROMISE"
  | "BUYER_FINALIZED"
  | "SELLER_NEW"
  | "SELLER_CONTACT"
  | "SELLER_ESTIMATE_SCHEDULED"
  | "SELLER_ESTIMATE_DONE"
  | "SELLER_MANDATE_PROPOSED"
  | "SELLER_MANDATE_SIGNED"
  | "SELLER_MARKETED";

export type PipelineCardData = {
  id: string;
  stage: PipelineStage;
  contact: string;
  role: string;
  property: string;
  location?: string;
  amount: number;
  owner?: "Antoine" | "Sophie" | null;
  updatedLabel?: string;
  alert?: string;
  alertTone?: "info" | "warning" | "danger" | "success";
  status?: string;
  blocked?: boolean;
  compact?: boolean;
};

export const buyerStages: Array<{ id: PipelineStage; label: string; color: string }> = [
  { id: "BUYER_NEW", label: "Nouveau", color: "#4d7a5c" },
  { id: "BUYER_QUALIFIED", label: "Qualifié", color: "#c28b2c" },
  { id: "BUYER_VISIT", label: "Visite", color: "#c28b2c" },
  { id: "BUYER_OFFER", label: "Offre", color: "#c28b2c" },
  { id: "BUYER_COMPROMISE", label: "Compromis", color: "#c28b2c" },
  { id: "BUYER_FINALIZED", label: "Finalisé", color: "#4d7a5c" },
];

export const sellerStages: Array<{ id: PipelineStage; label: string; color: string }> = [
  { id: "SELLER_NEW", label: "Nouveau", color: "#4d7a5c" },
  { id: "SELLER_CONTACT", label: "À contacter", color: "#c28b2c" },
  { id: "SELLER_ESTIMATE_SCHEDULED", label: "Est. Planifiée", color: "#4d7a5c" },
  { id: "SELLER_ESTIMATE_DONE", label: "Est. Réalisée", color: "#4d7a5c" },
  { id: "SELLER_MANDATE_PROPOSED", label: "Mandat proposé", color: "#4d7a5c" },
  { id: "SELLER_MANDATE_SIGNED", label: "Mandat signé", color: "#4d7a5c" },
  { id: "SELLER_MARKETED", label: "Bien commercialisé", color: "#4d7a5c" },
];

export const pipelineFixtures: PipelineCardData[] = [
  { id: "demo-marc", stage: "BUYER_NEW", contact: "Marc Durand", role: "Vendeur", property: "Villa Les Issambres", amount: 850000, owner: null, updatedLabel: "Il y a 1h", status: "Nouveau" },
  { id: "demo-marie", stage: "BUYER_NEW", contact: "Marie Dubois", role: "Propriétaire", property: "Maison Solliès-Pont", amount: 620000, owner: null, updatedLabel: "Il y a 30 min" },
  { id: "demo-lucas", stage: "BUYER_NEW", contact: "Lucas Morel", role: "Acquéreur", property: "Appartement Toulon", amount: 210000, compact: true },
  { id: "demo-emma", stage: "BUYER_NEW", contact: "Emma Fournier", role: "Acquéreuse", property: "Terrain Saint-Raphaël", amount: 450000, compact: true },
  { id: "demo-claire", stage: "BUYER_QUALIFIED", contact: "Claire Martin", role: "Acquéreuse", property: "Villa vue mer", amount: 700000, owner: "Sophie", updatedLabel: "Il y a 2h", alert: "Financement OK", alertTone: "info", status: "Qualifié" },
  { id: "demo-thomas", stage: "BUYER_QUALIFIED", contact: "Thomas Petit", role: "Acquéreur", property: "Studio Fréjus", amount: 180000, owner: "Antoine", updatedLabel: "Il y a 4h" },
  { id: "demo-julie", stage: "BUYER_QUALIFIED", contact: "Julie Lambert", role: "Acquéreuse", property: "Appart T2 Toulon", amount: 290000, compact: true },
  { id: "demo-julien", stage: "BUYER_VISIT", contact: "Julien Bernard", role: "Acquéreur", property: "Appart T3 Saint-Raphaël", amount: 350000, owner: "Antoine", alert: "3 jours dans cette étape", alertTone: "danger", status: "À relancer", blocked: true },
  { id: "demo-sophie", stage: "BUYER_VISIT", contact: "Sophie Leroy", role: "Acquéreuse", property: "Maison familiale", amount: 550000, owner: "Antoine", alert: "Visite demain 14h", alertTone: "success" },
  { id: "demo-alexandre", stage: "BUYER_VISIT", contact: "Alexandre Martin", role: "Acquéreur", property: "Villa Hyères", amount: 950000, compact: true },
  { id: "demo-pierre", stage: "BUYER_OFFER", contact: "Pierre Moreau", role: "Acquéreur", property: "Villa piscine Saint-Tropez", amount: 900000, owner: "Sophie", alert: "Bloqué depuis 12j — Action requise", alertTone: "danger", status: "À relancer", blocked: true },
  { id: "demo-mathilde", stage: "BUYER_OFFER", contact: "Mathilde Roux", role: "Acquéreuse", property: "Maison Sainte-Maxime", amount: 680000, compact: true },
  { id: "demo-isabelle", stage: "BUYER_COMPROMISE", contact: "Isabelle Rossi", role: "Investisseuse", property: "Studio Sainte-Maxime", amount: 400000, owner: "Sophie", alert: "Signature prévue 5 août", alertTone: "warning", status: "À qualifier" },
  { id: "demo-antoine-final", stage: "BUYER_FINALIZED", contact: "Antoine Fardoini", role: "Vendeur", property: "Vente appart · Toulon", amount: 280000, status: "Acté", compact: true },
  { id: "demo-lucas-final", stage: "BUYER_FINALIZED", contact: "Lucas Chevalier", role: "Acquéreur", property: "Achat Studio · Fréjus", amount: 145000, status: "Acté", compact: true },
  { id: "demo-robert", stage: "SELLER_NEW", contact: "M. Robert", role: "Vendeur", property: "Villa Fréjus", location: "Ville Fréjus", amount: 450000 },
  { id: "demo-mercier", stage: "SELLER_NEW", contact: "Mme. Mercier", role: "Vendeuse", property: "Appartement Saint-Raphaël", location: "Appartement Saint-Raphaël", amount: 290000 },
  { id: "demo-bernard", stage: "SELLER_CONTACT", contact: "Famille Bernard", role: "Vendeur", property: "Maison Sainte-Maxime", location: "Maison Sainte-Maxime", amount: 820000 },
  { id: "demo-dubois", stage: "SELLER_ESTIMATE_SCHEDULED", contact: "Mme. Dubois", role: "Vendeuse", property: "Studio Toulon", location: "Studio Toulon", amount: 140000, owner: "Sophie" },
  { id: "demo-blanc", stage: "SELLER_ESTIMATE_SCHEDULED", contact: "M. Blanc", role: "Vendeur", property: "Villa Saint-Tropez", location: "Villa Saint-Tropez", amount: 1950000, owner: "Sophie" },
  { id: "demo-girard", stage: "SELLER_ESTIMATE_DONE", contact: "M. Girard", role: "Vendeur", property: "Maison Draguignan", location: "Maison Draguignan", amount: 380000, owner: "Sophie" },
  { id: "demo-moreau", stage: "SELLER_MANDATE_PROPOSED", contact: "Mme. Moreau", role: "Vendeuse", property: "Villa Gassin", location: "Villa Gassin", amount: 1250000, owner: "Antoine" },
  { id: "demo-petit-seller", stage: "SELLER_MANDATE_SIGNED", contact: "M. Petit", role: "Vendeur", property: "Appartement Hyères", location: "Appartement Hyères", amount: 210000, owner: "Antoine" },
  { id: "demo-roux", stage: "SELLER_MARKETED", contact: "Famille Roux", role: "Vendeur", property: "Maison Cavalaire", location: "Maison Cavalaire", amount: 680000, owner: "Antoine" },
];

export type EstimationData = {
  id: string;
  owner: string;
  address: string;
  type: string;
  requestDate: string;
  appointment: string;
  agent: "Antoine" | "Sophie" | null;
  status: "Nouvelle demande" | "À contacter" | "Planifiée" | "Réalisée" | "Rapport envoyé" | "Sans suite" | "Terminée";
  estimate?: string;
  action: string;
};

export const estimationFixtures: EstimationData[] = [
  { id: "demo-estimation-mimosas", owner: "Marc Durand", address: "45 av. des Mimosas, Les Issambres", type: "Villa", requestDate: "20 juil", appointment: "28 juil 10h", agent: "Sophie", status: "Réalisée", estimate: "780 000 — 850 000 €", action: "Envoyer rapport" },
  { id: "demo-estimation-vignes", owner: "Marie Dubois", address: "8 ch. des Vignes, Solliès-Pont", type: "Maison", requestDate: "24 juil", appointment: "À planifier", agent: null, status: "Nouvelle demande", action: "Attribuer" },
  { id: "demo-estimation-gambetta", owner: "Julien Bernard", address: "12 bd Gambetta, Toulon", type: "Appartement T3", requestDate: "18 juil", appointment: "22 juil 14h", agent: "Sophie", status: "Rapport envoyé", estimate: "260 000 — 275 000 €", action: "Relancer pour mandat" },
  { id: "demo-estimation-port", owner: "Julie Lambert", address: "3 rue du Port, Fréjus", type: "Studio", requestDate: "15 juil", appointment: "19 juil 11h", agent: "Antoine", status: "Terminée", estimate: "165 000 — 180 000 €", action: "Transformer en bien →" },
  { id: "demo-estimation-bougainvilliers", owner: "Nathalie Vidal", address: "22 imp. Bougainvilliers, Sainte-Maxime", type: "Villa", requestDate: "25 juil", appointment: "30 juil 9h", agent: "Antoine", status: "Planifiée", action: "Préparer dossier" },
  { id: "demo-estimation-pins", owner: "Robert Girard", address: "5 allée des Pins, Hyères", type: "Maison", requestDate: "23 juil", appointment: "26 juil 15h", agent: "Sophie", status: "Réalisée", estimate: "580 000 — 620 000 €", action: "Rédiger rapport" },
  { id: "demo-estimation-mer", owner: "Claire Martin", address: "18 av. de la Mer, Saint-Raphaël", type: "Appartement T4", requestDate: "22 juil", appointment: "À planifier", agent: "Antoine", status: "À contacter", action: "Appeler" },
  { id: "demo-estimation-valescure", owner: "Famille Roux", address: "7 ch. de Valescure, Fréjus", type: "Villa provençale", requestDate: "10 juil", appointment: "14 juil", agent: "Sophie", status: "Sans suite", estimate: "450 000 — 510 000 €", action: "Archiver" },
];

export type VisitData = {
  id: string;
  group: "Aujourd'hui" | "À venir" | "Passées";
  date: string;
  title: string;
  location: string;
  buyer: string;
  agent: "Antoine" | "Sophie";
  status: "Confirmée" | "À confirmer" | "Réalisée" | "Annulée";
  note?: number;
  reportMissing?: boolean;
};

export const visitFixtures: VisitData[] = [
  { id: "demo-visit-1", group: "Aujourd'hui", date: "Aujourd'hui · 14h00 — 15h00", title: "Villa contemporaine vue mer", location: "Les Issambres, 83380", buyer: "Julien Bernard", agent: "Antoine", status: "Confirmée" },
  { id: "demo-visit-2", group: "Aujourd'hui", date: "Aujourd'hui · 16h30 — 17h30", title: "Appartement T3 centre Fréjus", location: "Fréjus, 83600", buyer: "Claire Martin", agent: "Sophie", status: "Confirmée" },
  { id: "demo-visit-3", group: "À venir", date: "Demain · 10h00 — 11h30", title: "Maison familiale Hyères", location: "Hyères, 83400", buyer: "Sophie Leroy", agent: "Antoine", status: "À confirmer" },
  { id: "demo-visit-4", group: "À venir", date: "30 juil · 11h00 — 12h00", title: "Villa Sainte-Maxime vue mer", location: "Sainte-Maxime, 83120", buyer: "Isabelle Rossi", agent: "Sophie", status: "À confirmer" },
  { id: "demo-visit-report", group: "Passées", date: "28 juil · 14h00 — 15h30", title: "Appartement T3 Saint-Raphaël", location: "Saint-Raphaël, 83700", buyer: "Thomas Petit", agent: "Antoine", status: "Réalisée", reportMissing: true },
  { id: "demo-visit-6", group: "Passées", date: "25 juil · 10h00 — 11h00", title: "Studio port Fréjus", location: "Fréjus Port, 83600", buyer: "Pierre Moreau", agent: "Sophie", status: "Réalisée", note: 3 },
  { id: "demo-visit-7", group: "Passées", date: "22 juil · 15h00 — 16h30", title: "Villa provençale Fréjus", location: "Fréjus, 83600", buyer: "Marc Durand", agent: "Sophie", status: "Annulée" },
];

export type OfferData = {
  id: string;
  property: string;
  location: string;
  askingPrice: number;
  amount: number;
  buyer: string;
  agent: "Antoine" | "Sophie";
  date: string;
  status: "Brouillon" | "Nouvelle" | "En négociation" | "Reçue" | "Acceptée" | "Refusée" | "Expirée";
  action: string;
  image: string;
  negotiationId?: string;
};

export const offerFixtures: OfferData[] = [
  { id: "demo-offer-pierre", property: "Villa Les Issambres", location: "Les Issambres, 83380", askingPrice: 900000, amount: 850000, buyer: "Pierre Moreau", agent: "Sophie", date: "Val. 5 août", status: "En négociation", action: "Voir négociation", image: "/images/crm-commercial/property-1.png", negotiationId: "demo-negotiation-pierre" },
  { id: "demo-offer-thomas", property: "Appartement T3 centre", location: "Saint-Raphaël, 83700", askingPrice: 350000, amount: 335000, buyer: "Thomas Petit", agent: "Antoine", date: "Val. 2 août", status: "Reçue", action: "Présenter au vendeur", image: "/images/crm-commercial/property-2.png" },
  { id: "demo-offer-claire", property: "Studio Fréjus Port", location: "Fréjus Port, 83600", askingPrice: 185000, amount: 180000, buyer: "Claire Martin", agent: "Sophie", date: "", status: "Acceptée", action: "Préparer compromis", image: "/images/crm-commercial/property-3.png" },
  { id: "demo-offer-isabelle", property: "Villa Sainte-Maxime", location: "Sainte-Maxime, 83120", askingPrice: 750000, amount: 680000, buyer: "Isabelle Rossi", agent: "Sophie", date: "", status: "Refusée", action: "Contre-proposition possible", image: "/images/crm-commercial/property-4.png" },
  { id: "demo-offer-sophie", property: "Maison Hyères", location: "Hyères, 83400", askingPrice: 550000, amount: 520000, buyer: "Sophie Leroy", agent: "Antoine", date: "Val. 8 août", status: "En négociation", action: "Suivre", image: "/images/crm-commercial/property-5.png", negotiationId: "demo-negotiation-sophie" },
  { id: "demo-offer-marc", property: "Appartement Toulon", location: "Toulon, 83000", askingPrice: 290000, amount: 260000, buyer: "Marc Durand", agent: "Sophie", date: "", status: "Expirée", action: "Renouveler", image: "/images/crm-commercial/property-6.png" },
];

export const commercialDemoSourceLabel = "Données de démonstration Figma";

export function formatPrice(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value).replace(/\u202f/g, " ") + " €";
}

export function offerGap(askingPrice: number, amount: number) {
  return ((amount - askingPrice) / askingPrice) * 100;
}

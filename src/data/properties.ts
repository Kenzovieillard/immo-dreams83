export type PropertyType = "apartment" | "house" | "land" | "commercial" | "parking" | "other";

export type TransactionType = "sale";

export type PropertyStatus = "available" | "under_offer" | "sold";

export type PropertyCommercialStatus = "AVAILABLE" | "UNDER_OFFER" | "SOLD";

export type PropertyPublicationStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";

export type PropertyHistoryItem = {
  id: string;
  action: string;
  changedFields: string[];
  previousValue: Record<string, unknown> | null;
  nextValue: Record<string, unknown> | null;
  actorEmail: string | null;
  createdAt: string;
};

export type Property = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  type: PropertyType;
  transactionType: TransactionType;
  status: PropertyStatus;
  commercialStatus?: PropertyCommercialStatus;
  publicationStatus?: PropertyPublicationStatus;
  city: string;
  postalCode: string;
  price: number;
  feesIncluded: boolean;
  surface: number;
  landSurface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  energyClass: string;
  climateClass: string;
  descriptionShort: string;
  descriptionLong: string;
  features: string[];
  photos: string[];
  featured: boolean;
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  mandateNumber: string;
  history?: PropertyHistoryItem[];
};

export const propertyTypeLabels: Record<PropertyType, string> = {
  apartment: "Appartement",
  house: "Maison",
  land: "Terrain",
  commercial: "Local commercial",
  parking: "Stationnement",
  other: "Autre bien",
};

export const propertyStatusLabels: Record<PropertyStatus, string> = {
  available: "Disponible",
  under_offer: "Sous offre",
  sold: "Vendu",
};

export const propertyStatusBadgeClasses: Record<PropertyStatus, string> = {
  available: "bg-orange-500 text-white",
  under_offer: "bg-yellow-300 text-[#111111]",
  sold: "bg-[#111111] text-white",
};

export const propertyCommercialStatusLabels: Record<PropertyCommercialStatus, string> = {
  AVAILABLE: "Disponible",
  UNDER_OFFER: "Sous offre",
  SOLD: "Vendu",
};

export const propertyPublicationStatusLabels: Record<PropertyPublicationStatus, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publie",
  UNPUBLISHED: "Depublie",
  ARCHIVED: "Archive",
};

export const propertyPublicationStatusBadgeClasses: Record<PropertyPublicationStatus, string> = {
  DRAFT: "bg-white text-gray-700 border border-orange-100",
  PUBLISHED: "bg-emerald-600 text-white",
  UNPUBLISHED: "bg-yellow-300 text-[#111111]",
  ARCHIVED: "bg-[#111111] text-white",
};

const officialBase = "https://www.immo-dreams83.fr";
const updatedAt = "2026-06-24";

// TODO V3: move properties to Supabase as the primary source, then add authenticated
// property creation/editing, image upload, CRM automation, multidiffusion, XML feeds,
// and portal exports for SeLoger, Leboncoin, Bien'ici, Figaro Immo and Meilleurs Agents.
export const properties: Property[] = [
  {
    id: "prop-official-152",
    reference: "099",
    slug: "maison-carqueiranne-83320-ref-099",
    title: "Maison à Carqueiranne avec piscine",
    type: "house",
    transactionType: "sale",
    status: "available",
    city: "Carqueiranne",
    postalCode: "83320",
    price: 1595000,
    feesIncluded: true,
    surface: 240,
    landSurface: 1910,
    rooms: 6,
    bedrooms: 3,
    bathrooms: 4,
    energyClass: "115 kWhEP/m2.an",
    climateClass: "14 kg eqCO2/m2.an",
    descriptionShort:
      "Demeure de 240 m2 sur terrain arboré avec piscine, studio indépendant et belle exposition sud.",
    descriptionLong:
      "À Carqueiranne, dans un secteur recherché proche du village et du port, cette demeure offre de beaux volumes, une pièce de vie généreuse ouverte sur l'extérieur, trois suites, un studio indépendant et des prestations extérieures complètes : piscine, carport, arrosage automatique et canal de Provence.",
    features: [
      "Piscine",
      "Studio indépendant",
      "Terrain arboré",
      "Exposition sud",
      "Carport 3 voitures",
      "Proche village et port",
    ],
    photos: [
      `${officialBase}/photos/biens/152-1/maison-villa-carqueiranne-83320-1779865656.webp`,
      `${officialBase}/photos/biens/152-2/maison-villa-carqueiranne-83320-1779865656.webp`,
      `${officialBase}/photos/biens/152-3/maison-villa-carqueiranne-83320-1779865656.webp`,
      `${officialBase}/photos/biens/152-4/maison-villa-carqueiranne-83320-1779865656.webp`,
      `${officialBase}/photos/biens/152-5/maison-villa-carqueiranne-83320-1779865656.webp`,
      `${officialBase}/photos/biens/152-6/maison-villa-carqueiranne-83320-1779865656.webp`,
    ],
    featured: true,
    sourceUrl: `${officialBase}/vente-achat/maison-villa-carqueiranne-83320/152.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "099",
  },
  {
    id: "prop-official-125",
    reference: "67",
    slug: "maison-toulon-83200-ref-67",
    title: "Demeure atypique sur les pentes du Faron",
    type: "house",
    transactionType: "sale",
    status: "available",
    city: "Toulon",
    postalCode: "83200",
    price: 830000,
    feesIncluded: true,
    surface: 244,
    landSurface: 1700,
    rooms: 9,
    bedrooms: 5,
    bathrooms: 2,
    energyClass: "250 kWhEP/m2.an",
    climateClass: "78 kg eqCO2/m2.an",
    descriptionShort:
      "Vaste maison de 244 m2 avec terrain en restanques, vue dégagée et nombreuses dépendances.",
    descriptionLong:
      "Sur les pentes du Faron à Toulon, cette propriété atypique bénéficie d'une exposition sud-est, de deux accès, d'un vaste garage et d'un cadre calme. Elle propose deux niveaux habitables, cinq chambres, plusieurs pièces de vie et un potentiel familial rare.",
    features: [
      "Vue dégagée",
      "Terrain piscinable",
      "Garage",
      "Nombreuses dépendances",
      "Quartier résidentiel",
      "Deux accès",
    ],
    photos: [
      `${officialBase}/photos/biens/125-1/maison-villa-toulon-83200-1772044511.webp`,
      `${officialBase}/photos/biens/125-2/maison-villa-toulon-83200-1772044511.webp`,
      `${officialBase}/photos/biens/125-3/maison-villa-toulon-83200-1772044511.webp`,
      `${officialBase}/photos/biens/125-4/maison-villa-toulon-83200-1772044511.webp`,
      `${officialBase}/photos/biens/125-5/maison-villa-toulon-83200-1772044511.webp`,
    ],
    featured: true,
    sourceUrl: `${officialBase}/vente-achat/maison-villa-toulon-83200/125.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "67",
  },
  {
    id: "prop-official-156",
    reference: "101",
    slug: "maison-hyeres-83400-ref-101",
    title: "Maison avec terrasse et vue dégagée à Hyères",
    type: "house",
    transactionType: "sale",
    status: "under_offer",
    city: "Hyères",
    postalCode: "83400",
    price: 379000,
    feesIncluded: true,
    surface: 68.5,
    landSurface: 70,
    rooms: 4,
    bedrooms: 2,
    bathrooms: 1,
    energyClass: "183 kWhEP/m2.an",
    climateClass: "7 kg eqCO2/m2.an",
    descriptionShort:
      "Maison au calme avec terrasse d'environ 60 m2, vue dégagée et proximité des commodités.",
    descriptionLong:
      "À Hyères, cette maison mitoyenne sous offre se situe dans un quartier recherché, au calme, proche des écoles et commerces. Elle propose une belle pièce de vie, deux chambres, un dressing, un cellier extérieur et une grande terrasse avec vue dégagée vers les îles.",
    features: [
      "Sous offre",
      "Grande terrasse",
      "Vue dégagée",
      "Quartier calme",
      "Proche commerces",
      "Cellier extérieur",
    ],
    photos: [
      `${officialBase}/photos/biens/156-1/maison-villa-hyeres-83400-1782281307.webp`,
      `${officialBase}/photos/biens/156-2.backup/maison-villa-hyeres-83400-1782281307.webp`,
      `${officialBase}/photos/biens/156-3/maison-villa-hyeres-83400-1782281307.webp`,
      `${officialBase}/photos/biens/156-4/maison-villa-hyeres-83400-1782281307.webp`,
    ],
    featured: true,
    sourceUrl: `${officialBase}/vente-achat/maison-villa-hyeres-83400/156.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "101",
  },
  {
    id: "prop-official-145",
    reference: "091",
    slug: "terrain-pierrefeu-du-var-83390-ref-091",
    title: "Terrain plat à Pierrefeu-du-Var",
    type: "land",
    transactionType: "sale",
    status: "under_offer",
    city: "Pierrefeu-du-Var",
    postalCode: "83390",
    price: 309000,
    feesIncluded: true,
    surface: 944,
    landSurface: 944,
    rooms: null,
    bedrooms: null,
    bathrooms: null,
    energyClass: "Non soumis",
    climateClass: "Non soumis",
    descriptionShort:
      "Terrain plat de 944 m2 au calme, libre constructeur, avec viabilités en bordure.",
    descriptionLong:
      "À Pierrefeu-du-Var, ce terrain sous offre bénéficie d'un environnement calme, d'une bonne exposition et de viabilités en bordure. Sa configuration se prête à un projet familial ou à une grande maison composée de deux logements.",
    features: [
      "Sous offre",
      "Terrain plat",
      "Libre constructeur",
      "Viabilités en bordure",
      "Environnement calme",
    ],
    photos: [
      `${officialBase}/photos/biens/145-1/terrain-pierrefeu-du-var-83390-1765978001.webp`,
      `${officialBase}/photos/biens/145-2/terrain-pierrefeu-du-var-83390-1765978001.webp`,
      `${officialBase}/photos/biens/145-3/terrain-pierrefeu-du-var-83390-1765978001.webp`,
      `${officialBase}/photos/biens/145-4/terrain-pierrefeu-du-var-83390-1765978001.webp`,
    ],
    featured: true,
    sourceUrl: `${officialBase}/vente-achat/terrain-pierrefeu-du-var-83390/145.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "091",
  },
  {
    id: "prop-official-147",
    reference: "093bis",
    slug: "appartement-sollies-pont-83210-ref-093bis",
    title: "Haut de villa rénové à Solliès-Pont",
    type: "apartment",
    transactionType: "sale",
    status: "under_offer",
    city: "Solliès-Pont",
    postalCode: "83210",
    price: 298000,
    feesIncluded: true,
    surface: 73.34,
    landSurface: 200,
    rooms: 3,
    bedrooms: 1,
    bathrooms: 1,
    energyClass: "134 kWhEP/m2.an",
    climateClass: "4 kg eqCO2/m2.an",
    descriptionShort:
      "Haut de villa rénové avec terrasse, jardin privatif et petite piscine chauffée.",
    descriptionLong:
      "Au cœur de Solliès-Pont, ce haut de villa sous offre propose une rénovation soignée, une grande pièce de vie ouvrant sur terrasse, une chambre avec salle de bain, un bureau et un jardin privatif au calme avec petite piscine chauffée.",
    features: [
      "Sous offre",
      "Terrasse",
      "Jardin privatif",
      "Piscine chauffée",
      "Exposition plein sud",
      "Dernier étage",
    ],
    photos: [
      `${officialBase}/photos/biens/147-1/appartement-sollies-pont-83210-1771520863.webp`,
      `${officialBase}/photos/biens/147-2/appartement-sollies-pont-83210-1771520863.webp`,
      `${officialBase}/photos/biens/147-3/appartement-sollies-pont-83210-1771520863.webp`,
      `${officialBase}/photos/biens/147-4/appartement-sollies-pont-83210-1771520863.webp`,
      `${officialBase}/photos/biens/147-5/appartement-sollies-pont-83210-1771520863.webp`,
    ],
    featured: true,
    sourceUrl: `${officialBase}/vente-achat/appartement-sollies-pont-83210/147.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "093bis",
  },
  {
    id: "prop-official-119",
    reference: "066",
    slug: "terrain-sollies-pont-83210-ref-066",
    title: "Terrain dominant libre constructeur",
    type: "land",
    transactionType: "sale",
    status: "available",
    city: "Solliès-Pont",
    postalCode: "83210",
    price: 273000,
    feesIncluded: true,
    surface: 881,
    landSurface: 881,
    rooms: null,
    bedrooms: null,
    bathrooms: null,
    energyClass: "Non soumis",
    climateClass: "Non soumis",
    descriptionShort:
      "Terrain dominant de 881 m2 vendu viabilisé et clôturé, libre constructeur.",
    descriptionLong:
      "Suite à un détachement de parcelle à Solliès-Pont, ce terrain en position dominante offre un cadre champêtre, une exposition sud-est, une emprise au sol de 10% et une possibilité de construction en étage.",
    features: [
      "Libre constructeur",
      "Vendu viabilisé",
      "Terrain clôturé",
      "Position dominante",
      "Exposition sud-est",
    ],
    photos: [
      `${officialBase}/photos/biens/119-1/terrain-sollies-pont-83210-1774962083.webp`,
      `${officialBase}/photos/biens/119-2/terrain-sollies-pont-83210-1774962083.webp`,
      `${officialBase}/photos/biens/119-3/terrain-sollies-pont-83210-1774962083.webp`,
    ],
    featured: true,
    sourceUrl: `${officialBase}/vente-achat/terrain-sollies-pont-83210/119.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "066",
  },
  {
    id: "prop-official-161",
    reference: "103",
    slug: "appartement-hyeres-83400-ref-103",
    title: "Appartement T3 rénové quartier gare à Hyères",
    type: "apartment",
    transactionType: "sale",
    status: "available",
    city: "Hyères",
    postalCode: "83400",
    price: 249000,
    feesIncluded: true,
    surface: 63.05,
    landSurface: null,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    energyClass: "120 kWhEP/m2.an",
    climateClass: "22 kg eqCO2/m2.an",
    descriptionShort:
      "Appartement T3 traversant, rénové, lumineux, avec cave et stationnement.",
    descriptionLong:
      "Au cœur du quartier de la gare à Hyères, cet appartement de type 3 a été entièrement rénové. Traversant et lumineux, il comprend une cuisine ouverte avec loggia, un séjour avec balcon fermé, deux chambres, une salle d'eau et une cave privative.",
    features: [
      "Appartement traversant",
      "Rénové",
      "Cave privative",
      "Stationnement",
      "Balcon fermé",
      "Climatisation réversible",
    ],
    photos: [
      `${officialBase}/photos/biens/161-1/appartement-hyeres-83400-1782281681.webp`,
      `${officialBase}/photos/biens/161-2/appartement-hyeres-83400-1782281681.webp`,
      `${officialBase}/photos/biens/161-3/appartement-hyeres-83400-1782281681.webp`,
      `${officialBase}/photos/biens/161-4/appartement-hyeres-83400-1782281681.webp`,
      `${officialBase}/photos/biens/161-5/appartement-hyeres-83400-1782281681.webp`,
    ],
    featured: true,
    sourceUrl: `${officialBase}/vente-achat/appartement-hyeres-83400/161.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "103",
  },
  {
    id: "prop-official-159",
    reference: "102",
    slug: "appartement-hyeres-83400-ref-102",
    title: "Appartement T2 rénové sur les hauteurs de Hyères",
    type: "apartment",
    transactionType: "sale",
    status: "available",
    city: "Hyères",
    postalCode: "83400",
    price: 209000,
    feesIncluded: true,
    surface: 57,
    landSurface: null,
    rooms: 3,
    bedrooms: 1,
    bathrooms: 1,
    energyClass: "140 kWhEP/m2.an",
    climateClass: "21 kg eqCO2/m2.an",
    descriptionShort:
      "Appartement rénové dans une petite copropriété, avec cave, balcon et vue dégagée.",
    descriptionLong:
      "Sur les hauteurs de Hyères, dans un secteur calme et recherché proche du centre-ville, cet appartement rénové offre une cuisine équipée, un espace salon/salle à manger, un coin bureau, une chambre, une salle d'eau, une grande cave et un balcon.",
    features: [
      "Petite copropriété",
      "Sans charges",
      "Grande cave",
      "Balcon",
      "Vue dégagée",
      "Quartier calme",
    ],
    photos: [
      `${officialBase}/photos/biens/159-1/appartement-hyeres-83400-1780484583.webp`,
      `${officialBase}/photos/biens/159-2/appartement-hyeres-83400-1780484583.webp`,
      `${officialBase}/photos/biens/159-3/appartement-hyeres-83400-1780484583.webp`,
      `${officialBase}/photos/biens/159-4/appartement-hyeres-83400-1780484583.webp`,
    ],
    featured: false,
    sourceUrl: `${officialBase}/vente-achat/appartement-hyeres-83400/159.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "102",
  },
  {
    id: "prop-official-153",
    reference: "098",
    slug: "appartement-cuers-83390-ref-098",
    title: "Appartement T2 avec jardin à Cuers",
    type: "apartment",
    transactionType: "sale",
    status: "under_offer",
    city: "Cuers",
    postalCode: "83390",
    price: 170000,
    feesIncluded: true,
    surface: 49.65,
    landSurface: 300,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    energyClass: "144 kWhEP/m2.an",
    climateClass: "5 kg eqCO2/m2.an",
    descriptionShort:
      "T2 en rez-de-chaussée avec grand jardin et deux places de parking privatives.",
    descriptionLong:
      "À Cuers, proche du centre-ville, cet appartement T2 en rez-de-chaussée bénéficie d'un grand jardin d'environ 300 m2, de deux stationnements privatifs et d'une exposition sud. Le bien est actuellement sous compromis.",
    features: [
      "Sous compromis",
      "Grand jardin",
      "Deux parkings privatifs",
      "Rez-de-chaussée",
      "Proche centre-ville",
      "Exposition sud",
    ],
    photos: [
      `${officialBase}/photos/biens/153-1/appartement-cuers-83390-1775911980.webp`,
      `${officialBase}/photos/biens/153-2/appartement-cuers-83390-1775911980.webp`,
      `${officialBase}/photos/biens/153-3/appartement-cuers-83390-1775911980.webp`,
      `${officialBase}/photos/biens/153-4/appartement-cuers-83390-1775911980.webp`,
    ],
    featured: false,
    sourceUrl: `${officialBase}/vente-achat/appartement-cuers-83390/153.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "098",
  },
  {
    id: "prop-official-123",
    reference: "72",
    slug: "appartement-toulon-83000-ref-72",
    title: "Appartement T2 lumineux au Mourillon",
    type: "apartment",
    transactionType: "sale",
    status: "available",
    city: "Toulon",
    postalCode: "83000",
    price: 167000,
    feesIncluded: true,
    surface: 47,
    landSurface: null,
    rooms: 2,
    bedrooms: 1,
    bathrooms: null,
    energyClass: "146 kWhEP/m2.an",
    climateClass: "4 kg eqCO2/m2.an",
    descriptionShort:
      "T2 lumineux de 47 m2 au cœur du Mourillon, proche marché, commerces et plages.",
    descriptionLong:
      "Au cœur du quartier du Mourillon à Toulon, cet appartement T2 lumineux se situe au deuxième étage d'une maison de ville. Il profite d'un environnement vivant, proche du marché, des commerces, du port et des plages.",
    features: [
      "Quartier Mourillon",
      "Proche marché",
      "Proche plages",
      "Deuxième étage",
      "Commerces à pied",
    ],
    photos: [
      `${officialBase}/photos/biens/123-1/appartement-toulon-83000-1781361952.webp`,
      `${officialBase}/photos/biens/123-2/appartement-toulon-83000-1781361952.webp`,
      `${officialBase}/photos/biens/123-3/appartement-toulon-83000-1781361952.webp`,
    ],
    featured: false,
    sourceUrl: `${officialBase}/vente-achat/appartement-toulon-83000/123.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "72",
  },
  {
    id: "prop-official-122",
    reference: "71",
    slug: "appartement-toulon-83000-ref-71",
    title: "Appartement T2 au Mourillon",
    type: "apartment",
    transactionType: "sale",
    status: "available",
    city: "Toulon",
    postalCode: "83000",
    price: 144000,
    feesIncluded: true,
    surface: 50.36,
    landSurface: null,
    rooms: 2,
    bedrooms: 1,
    bathrooms: null,
    energyClass: "146 kWhEP/m2.an",
    climateClass: "4 kg eqCO2/m2.an",
    descriptionShort:
      "T2 lumineux de 50,36 m2 au premier étage, dans le secteur recherché du Mourillon.",
    descriptionLong:
      "À Toulon, dans le quartier du Mourillon, cet appartement T2 lumineux se trouve au premier étage d'une maison de ville. Il bénéficie d'une proximité immédiate avec le marché, les commerces, les écoles, les transports et le littoral.",
    features: [
      "Quartier Mourillon",
      "Premier étage",
      "Proche commerces",
      "Proche mer",
      "Transports à proximité",
    ],
    photos: [
      `${officialBase}/photos/biens/122-1/appartement-toulon-83000-1744193021.webp`,
      `${officialBase}/photos/biens/122-2/appartement-toulon-83000-1744193021.webp`,
      `${officialBase}/photos/biens/122-3/appartement-toulon-83000-1744193021.webp`,
    ],
    featured: false,
    sourceUrl: `${officialBase}/vente-achat/appartement-toulon-83000/122.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "71",
  },
  {
    id: "prop-official-124",
    reference: "73",
    slug: "appartement-toulon-83000-ref-73",
    title: "Studio lumineux au Mourillon",
    type: "apartment",
    transactionType: "sale",
    status: "available",
    city: "Toulon",
    postalCode: "83000",
    price: 79000,
    feesIncluded: true,
    surface: 16.88,
    landSurface: null,
    rooms: 1,
    bedrooms: null,
    bathrooms: null,
    energyClass: "275 kWhEP/m2.an",
    climateClass: "8 kg eqCO2/m2.an",
    descriptionShort:
      "Studio lumineux au deuxième étage, au cœur du Mourillon et proche des commodités.",
    descriptionLong:
      "Ce studio à Toulon, situé au deuxième étage d'une maison de ville du Mourillon, offre une petite surface facile à projeter pour un investissement ou un pied-à-terre proche du marché, des commerces et du littoral.",
    features: [
      "Studio",
      "Quartier Mourillon",
      "Deuxième étage",
      "Proche commerces",
      "Proche plages",
    ],
    photos: [
      `${officialBase}/photos/biens/124-1/appartement-toulon-83000-1744383167.webp`,
      `${officialBase}/photos/biens/124-2/appartement-toulon-83000-1744383167.webp`,
    ],
    featured: false,
    sourceUrl: `${officialBase}/vente-achat/appartement-toulon-83000/124.htm`,
    createdAt: "2026-06-01",
    updatedAt,
    mandateNumber: "73",
  },
];

export const availableProperties = properties.filter(
  (property) => property.status !== "sold"
);

export const featuredProperties = properties.filter((property) => property.featured);

export const propertyTypeFilters: Array<"all" | PropertyType> = [
  "all",
  "apartment",
  "house",
  "land",
  "commercial",
  "parking",
  "other",
];

export const propertyCities = [
  "Toutes",
  ...Array.from(new Set(availableProperties.map((property) => property.city))),
];

export function getPropertyBySlug(slug: string) {
  return properties.find((property) => property.slug === slug);
}

export function getSimilarProperties(property: Property, limit = 3) {
  return availableProperties
    .filter((candidate) => {
      if (candidate.id === property.id) return false;
      return candidate.type === property.type || candidate.city === property.city;
    })
    .slice(0, limit);
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

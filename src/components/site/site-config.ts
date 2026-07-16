export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://immo-dreams83.vercel.app";

export const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/agence", label: "L'Agence" },
  { href: "/a-vendre", label: "À vendre" },
  { href: "/estimation", label: "Estimation" },
  { href: "/biens", label: "Biens" },
  { href: "/contact", label: "Contact" },
];

export const legalLinks = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/legal/privacy-policy", label: "Politique de confidentialité" },
  { href: "/legal/cookies", label: "Cookies" },
];

export const agencyContact = {
  name: "IMMO-DREAMS83",
  representative: "Antoine Faridoni",
  addressLine1: "4 chemin des Bancaous",
  postalCode: "83210",
  city: "Solliès-Pont",
  country: "France",
  address: "4 chemin des Bancaous, 83210 Solliès-Pont, France",
  phone: "06 72 88 15 34",
  phoneInternational: "+33 6 72 88 15 34",
  phoneHref: "tel:+33672881534",
  email: "antoine.faridoni@immo-dreams83.fr",
  emailHref: "mailto:antoine.faridoni@immo-dreams83.fr",
  siret: "97933837300017",
  website: "https://www.immo-dreams83.fr",
  publicUrl: siteUrl,
  openingHours: ["Lundi au vendredi : 9h00 - 18h30", "Samedi : sur rendez-vous"],
};

export const fullAgencyAddress = `${agencyContact.addressLine1}, ${agencyContact.postalCode} ${agencyContact.city}, ${agencyContact.country}`;

export const crmSettings = {
  contactReceiverEmailEnv: "CONTACT_RECEIVER_EMAIL",
  emailFromEnv: "EMAIL_FROM",
  emailApiKeyEnv: "EMAIL_API_KEY",
  supabaseUrlEnv: "NEXT_PUBLIC_SUPABASE_URL",
  supabaseAnonKeyEnv: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  adminBootstrapEmailsEnv: "ADMIN_BOOTSTRAP_EMAILS",
  siteUrlEnv: "NEXT_PUBLIC_SITE_URL",
};

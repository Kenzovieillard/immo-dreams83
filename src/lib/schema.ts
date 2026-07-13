import { agencyContact, fullAgencyAddress, siteUrl } from "@/components/site/site-config";
import { Property, formatPrice, propertyTypeLabels } from "@/data/properties";

export const agencySchema = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "RealEstateAgent"],
  "@id": `${siteUrl}/#agency`,
  name: agencyContact.name,
  description: "Agence immobilière locale spécialisée dans la vente et l'estimation de biens dans le Var.",
  url: siteUrl,
  telephone: agencyContact.phoneInternational,
  email: agencyContact.email,
  founder: agencyContact.representative,
  address: {
    "@type": "PostalAddress",
    streetAddress: agencyContact.addressLine1,
    postalCode: agencyContact.postalCode,
    addressLocality: agencyContact.city,
    addressCountry: "FR",
  },
  areaServed: ["Solliès-Pont", "Var", "Toulon", "Hyères", "Cuers", "Carqueiranne"],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:30",
    },
  ],
};

export function getBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function getPropertySchema(property: Property) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title,
    url: `${siteUrl}/biens/${property.slug}`,
    image: property.photos,
    description: property.descriptionShort,
    datePosted: property.createdAt,
    offers: {
      "@type": "Offer",
      price: property.price,
      priceCurrency: "EUR",
      availability: property.status === "available" ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",
      url: `${siteUrl}/biens/${property.slug}`,
    },
    itemOffered: {
      "@type": "Product",
      name: `${propertyTypeLabels[property.type]} à ${property.city}`,
      description: `${formatPrice(property.price)}, ${property.surface} m², référence ${property.reference}`,
    },
    provider: { "@id": `${siteUrl}/#agency` },
    address: `${property.postalCode} ${property.city}, France`,
    seller: { "@id": `${siteUrl}/#agency`, name: agencyContact.name, address: fullAgencyAddress },
  };
}

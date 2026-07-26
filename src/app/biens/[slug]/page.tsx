import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Check,
  ExternalLink,
  Home,
  MapPin,
  Phone,
  Ruler,
  Trees,
} from "lucide-react";
import { PropertyLeadForm } from "@/components/forms/property-lead-form";
import { DiagnosticBar } from "@/components/site/diagnostic-bar";
import { GoogleMapEmbed } from "@/components/site/google-map-embed";
import { PropertyCard } from "@/components/site/property-card";
import { PropertyGallery } from "@/components/site/property-gallery";
import { PropertyShare } from "@/components/site/property-share";
import { RivieraCtaBand } from "@/components/site/riviera-cta-band";
import { StructuredData } from "@/components/site/structured-data";
import { agencyContact, siteUrl } from "@/components/site/site-config";
import { buttonVariants } from "@/components/ui/button";
import {
  formatNumber,
  formatPrice,
  propertyStatusBadgeClasses,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/data/properties";
import {
  getPublicPropertyBySlug,
  getSimilarPublicProperties,
} from "@/lib/public-properties";
import { getBreadcrumbSchema, getPropertySchema } from "@/lib/schema";
import { cn } from "@/lib/utils";

type PropertyPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: PropertyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPublicPropertyBySlug(slug);
  if (!property) return { title: "Bien introuvable" };

  const url = `${siteUrl}/biens/${property.slug}`;
  const description = `${property.descriptionShort} ${formatPrice(property.price)}. Référence ${property.reference}.`;
  return {
    title: `${property.title} à ${property.city}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${property.title} | IMMO DREAMS`,
      description,
      type: "website",
      url,
      images: property.photos.map((photo) => ({
        url: photo,
        alt: property.title,
      })),
    },
  };
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params;
  const property = await getPublicPropertyBySlug(slug);
  if (!property) notFound();

  const similarProperties = await getSimilarPublicProperties(property, 3);
  const pageUrl = `${siteUrl}/biens/${property.slug}`;
  const breadcrumbs = getBreadcrumbSchema([
    { name: "Accueil", url: siteUrl },
    { name: "Biens", url: `${siteUrl}/biens` },
    { name: property.title, url: pageUrl },
  ]);

  const facts = [
    {
      label: "Surface",
      value: `${formatNumber(property.surface)} m²`,
      icon: Ruler,
    },
    {
      label: "Pièces",
      value: property.rooms ?? "Non concerné",
      icon: Home,
    },
    {
      label: "Chambres",
      value: property.bedrooms ?? "Non concerné",
      icon: BedDouble,
    },
    {
      label: "Salle d'eau / bain",
      value: property.bathrooms ?? "Non concerné",
      icon: Bath,
    },
    {
      label: "Terrain",
      value: property.landSurface
        ? `${formatNumber(property.landSurface)} m²`
        : "Non concerné",
      icon: Trees,
    },
  ];

  return (
    <>
      <StructuredData data={[getPropertySchema(property), breadcrumbs]} />

      <section className="bg-[#fbf9f4] px-5 pb-14 pt-8 sm:px-8 sm:pb-20 sm:pt-12">
        <div className="mx-auto max-w-[80rem]">
          <nav
            aria-label="Fil d'Ariane"
            className="mb-7 flex flex-wrap items-center gap-2 text-sm text-gray-500"
          >
            <Link href="/" className="hover:text-orange-600">
              Accueil
            </Link>
            <span>/</span>
            <Link href="/a-vendre" className="hover:text-orange-600">
              Biens
            </Link>
            <span>/</span>
            <span className="text-[#111111]">{property.city}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start">
            <PropertyGallery photos={property.photos} title={property.title} />

            <aside className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-orange-100 lg:sticky lg:top-28">
              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    "rounded-md px-3 py-2 text-[0.65rem] font-bold uppercase",
                    propertyStatusBadgeClasses[property.status]
                  )}
                >
                  {propertyStatusLabels[property.status]}
                </span>
                <span className="rounded-md bg-orange-50 px-3 py-2 text-[0.65rem] font-bold uppercase text-[#111111]">
                  {propertyTypeLabels[property.type]}
                </span>
              </div>

              <p className="mt-7 text-xs font-bold uppercase text-orange-600">
                {property.city} · Réf. {property.reference}
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-[#111111] sm:text-4xl">
                {property.title}
              </h1>
              <p className="mt-5 flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="size-4 text-orange-500" aria-hidden="true" />
                {property.city} ({property.postalCode})
              </p>

              <div className="mt-7 border-y border-orange-100 py-5">
                <p className="text-xs font-bold uppercase text-gray-500">
                  Prix de vente
                </p>
                <p className="mt-2 text-3xl font-black text-[#111111]">
                  {formatPrice(property.price)}
                </p>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Honoraires inclus selon les conditions du mandat.
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {facts.map((fact, index) => (
                  <div
                    key={fact.label}
                    className={cn(
                      "rounded-lg bg-orange-50 p-3",
                      index === facts.length - 1 && "col-span-2"
                    )}
                  >
                    <fact.icon
                      className="size-4 text-orange-600"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-[0.65rem] font-bold uppercase text-gray-500">
                      {fact.label}
                    </p>
                    <p className="mt-1 text-sm font-black text-[#111111]">
                      {fact.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-3">
                <a
                  href="#demande"
                  className={buttonVariants({
                    className:
                      "h-12 w-full bg-orange-500 text-white hover:bg-orange-600",
                  })}
                >
                  Demander une visite
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
                <a
                  href={agencyContact.phoneHref}
                  className={buttonVariants({
                    variant: "outline",
                    className:
                      "h-12 w-full border-orange-200 bg-white text-[#111111] hover:bg-orange-50",
                  })}
                >
                  <Phone className="size-4" aria-hidden="true" />
                  {agencyContact.phone}
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-[80rem] gap-12 lg:grid-cols-[minmax(0,1fr)_25rem]">
          <div>
            <p className="text-xs font-bold uppercase text-orange-600">
              Le bien en détail
            </p>
            <h2 className="mt-4 text-3xl font-black text-[#111111]">
              Description
            </h2>
            <p className="mt-6 text-base leading-8 text-gray-700">
              {property.descriptionLong}
            </p>

            <h2 className="mt-12 text-2xl font-black text-[#111111]">
              Caractéristiques
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {property.features.map((feature) => (
                <p
                  key={feature}
                  className="flex items-center gap-3 border-b border-orange-100 py-3 text-sm text-gray-700"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                  {feature}
                </p>
              ))}
            </div>
          </div>

          <div className="grid h-fit gap-6">
            <div className="rounded-lg bg-[#111111] p-6 text-white">
              <p className="text-xs font-bold uppercase text-orange-400">
                Diagnostics
              </p>
              <h2 className="mt-3 text-2xl font-black">
                Performance énergétique
              </h2>
              <div className="mt-6 grid gap-5">
                <DiagnosticBar
                  kind="energy"
                  value={property.energyClass}
                  dark
                />
                <DiagnosticBar
                  kind="climate"
                  value={property.climateClass}
                  dark
                />
              </div>
            </div>

            <div className="rounded-lg bg-orange-50 p-6">
              <h2 className="text-lg font-black text-[#111111]">
                Partager cette annonce
              </h2>
              <div className="mt-5">
                <PropertyShare title={property.title} url={pageUrl} />
              </div>
              {property.sourceUrl ? (
                <a
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-orange-700 hover:underline"
                  href={property.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Consulter la source officielle
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section
        id="demande"
        className="scroll-mt-24 bg-[#fbf9f4] px-5 py-14 sm:px-8 sm:py-20"
      >
        <div className="mx-auto grid max-w-[80rem] gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg bg-[#111111] p-6 text-white sm:p-8">
            <p className="text-xs font-bold uppercase text-orange-400">
              Ce bien vous intéresse ?
            </p>
            <h2 className="mt-4 text-3xl font-black leading-tight">
              Organisez une visite avec l’agence
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/68">
              Indiquez vos coordonnées et votre question. L’équipe vous répond
              avec les informations utiles sur le bien.
            </p>
            <div className="mt-8">
              <PropertyLeadForm
                title={property.title}
                reference={property.reference}
                city={property.city}
                dark
              />
            </div>
          </div>

          <GoogleMapEmbed
            query={`${property.city} ${property.postalCode} France`}
            title={`Localisation indicative du bien à ${property.city}`}
            helperText="Localisation indicative basée sur la commune et le code postal. L'adresse précise est communiquée par l'agence selon le dossier."
          />
        </div>
      </section>

      {similarProperties.length > 0 ? (
        <section className="bg-white px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[80rem]">
            <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase text-orange-600">
                  Biens similaires
                </p>
                <h2 className="mt-3 text-3xl font-black text-[#111111] sm:text-4xl">
                  Continuer votre recherche
                </h2>
              </div>
              <Link
                href="/a-vendre"
                className={buttonVariants({
                  variant: "outline",
                  className:
                    "h-11 border-orange-200 bg-white text-[#111111] hover:bg-orange-50",
                })}
              >
                Voir tous les biens
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {similarProperties.map((item) => (
                <PropertyCard key={item.id} property={item} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <RivieraCtaBand />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Bath,
  BedDouble,
  CheckCircle2,
  ExternalLink,
  Home,
  Leaf,
  MapPin,
  Phone,
  Ruler,
  Trees,
} from "lucide-react";
import { PropertyLeadForm } from "@/components/forms/property-lead-form";
import { PropertyCard } from "@/components/site/property-card";
import { PropertyGallery } from "@/components/site/property-gallery";
import { GoogleMapEmbed } from "@/components/site/google-map-embed";
import { PropertyShare } from "@/components/site/property-share";
import { StructuredData } from "@/components/site/structured-data";
import { agencyContact, siteUrl } from "@/components/site/site-config";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  formatNumber,
  formatPrice,
  propertyStatusBadgeClasses,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/data/properties";
import { getPublicPropertyBySlug, getSimilarPublicProperties } from "@/lib/public-properties";
import { getBreadcrumbSchema, getPropertySchema } from "@/lib/schema";
import { cn } from "@/lib/utils";

type PropertyPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
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
      title: `${property.title} | IMMO-DREAMS83`,
      description,
      type: "website",
      url,
      images: property.photos.map((photo) => ({ url: photo, alt: property.title })),
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
    { label: "Surface", value: `${formatNumber(property.surface)} m²`, icon: Ruler },
    { label: "Pièces", value: property.rooms ?? "Non concerné", icon: Home },
    { label: "Chambres", value: property.bedrooms ?? "Non concerné", icon: BedDouble },
    { label: "Salle d'eau / bain", value: property.bathrooms ?? "Non concerné", icon: Bath },
    { label: "Terrain", value: property.landSurface ? `${formatNumber(property.landSurface)} m²` : "Non concerné", icon: Trees },
  ];

  return (
    <>
      <StructuredData data={[getPropertySchema(property), breadcrumbs]} />

      <section className="bg-[#111111] px-4 pb-10 pt-6 text-white sm:px-6 sm:pb-12 sm:pt-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-2 text-sm text-white/60">
            <Link href="/" className="hover:text-orange-300">Accueil</Link>
            <span>/</span>
            <Link href="/biens" className="hover:text-orange-300">Biens</Link>
            <span>/</span>
            <span className="text-white">{property.city}</span>
          </nav>

          <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge className={cn("border-0", propertyStatusBadgeClasses[property.status])}>{propertyStatusLabels[property.status]}</Badge>
                <Badge variant="outline" className="border-white/20 text-white">{propertyTypeLabels[property.type]}</Badge>
                <Badge variant="outline" className="border-white/20 font-mono text-white">Réf. {property.reference}</Badge>
              </div>
              <h1 className="mt-5 max-w-[20rem] break-words text-[1.85rem] font-black leading-[1.08] tracking-tight sm:max-w-4xl sm:text-5xl">{property.title}</h1>
              <p className="mt-4 flex items-center gap-2 text-base text-white/70 sm:text-lg"><MapPin className="size-5 text-orange-300" />{property.city} ({property.postalCode})</p>
            </div>
            <div>
              <p className="text-sm font-bold uppercase text-white/55">Prix de vente</p>
              <p className="mt-2 text-3xl font-black text-orange-300 sm:text-4xl">{formatPrice(property.price)}</p>
              <p className="mt-2 text-sm text-white/60">Honoraires inclus selon les conditions du mandat.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-orange-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-7xl"><PropertyGallery photos={property.photos} title={property.title} /></div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-8">
            <div>
              <p className="text-sm font-bold uppercase text-orange-600">L&apos;essentiel</p>
              <h2 className="mt-2 text-2xl font-black text-[#111111] sm:text-3xl">Les points clés du bien</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {facts.map((fact) => (
                  <div key={fact.label} className="rounded-lg border border-orange-100 bg-orange-50 p-4">
                    <fact.icon className="size-5 text-orange-600" />
                    <p className="mt-3 text-xs font-bold uppercase text-gray-500">{fact.label}</p>
                    <p className="mt-1 text-lg font-black text-[#111111]">{fact.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-orange-100" />

            <div>
              <h2 className="text-2xl font-black text-[#111111] sm:text-3xl">Description</h2>
              <p className="mt-5 text-base leading-8 text-gray-700">{property.descriptionLong}</p>
            </div>

            <div>
              <h2 className="text-2xl font-black text-[#111111]">Caractéristiques</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {property.features.map((feature) => (
                  <p key={feature} className="flex items-center gap-3 rounded-md bg-orange-50 p-3 text-sm text-gray-700">
                    <CheckCircle2 className="size-5 shrink-0 text-orange-600" />{feature}
                  </p>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-orange-100 bg-[#111111] text-white">
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><Leaf className="size-5 text-orange-300" />Performance énergétique</CardTitle></CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex items-center justify-between gap-4"><span className="text-white/60">DPE</span><strong className="text-orange-300">{property.energyClass}</strong></div>
                  <div className="flex items-center justify-between gap-4"><span className="text-white/60">GES</span><strong className="text-orange-300">{property.climateClass}</strong></div>
                </CardContent>
              </Card>
              <Card className="border-orange-100 bg-white">
                <CardHeader><CardTitle className="text-xl text-[#111111]">Partager cette annonce</CardTitle></CardHeader>
                <CardContent className="grid gap-4">
                  <PropertyShare title={property.title} />
                  {property.sourceUrl ? (
                    <a className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700 hover:underline" href={property.sourceUrl} target="_blank" rel="noreferrer">
                      Consulter la source officielle <ExternalLink className="size-4" />
                    </a>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <GoogleMapEmbed
              query={`${property.city} ${property.postalCode} France`}
              title={`Localisation indicative du bien a ${property.city}`}
              helperText="Localisation indicative basee sur la commune et le code postal. L'adresse precise est communiquee par l'agence selon le dossier."
            />

          </div>

          <aside className="grid h-fit gap-5 lg:sticky lg:top-24">
            <Card className="border-orange-100 bg-white shadow-xl shadow-orange-100/60">
              <CardHeader>
                <CardTitle className="text-2xl font-black text-[#111111]">Ce bien vous intéresse ?</CardTitle>
                <p className="text-sm leading-6 text-gray-600">Recevez les informations utiles ou organisez une visite avec l&apos;agence.</p>
              </CardHeader>
              <CardContent><PropertyLeadForm title={property.title} reference={property.reference} city={property.city} /></CardContent>
            </Card>
            <a href={agencyContact.phoneHref} className={buttonVariants({ className: "h-12 bg-[#111111] text-white hover:bg-orange-600" })}>
              <Phone className="size-4" />{agencyContact.phone}
            </a>
            <Link href="/estimation" className={buttonVariants({ variant: "outline", className: "h-11 border-orange-200 text-orange-700" })}>Faire estimer mon bien</Link>
          </aside>
        </div>
      </section>

      {similarProperties.length > 0 ? (
        <section className="bg-orange-50 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="text-sm font-bold uppercase text-orange-600">Biens similaires</p><h2 className="mt-2 text-3xl font-black text-[#111111]">Continuer votre recherche</h2></div>
              <Link href="/a-vendre" className={buttonVariants({ variant: "outline", className: "border-orange-200 bg-white text-orange-700" })}>Voir tous les biens <ArrowRight className="size-4" /></Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{similarProperties.map((item) => <PropertyCard key={item.id} property={item} />)}</div>
          </div>
        </section>
      ) : null}
    </>
  );
}

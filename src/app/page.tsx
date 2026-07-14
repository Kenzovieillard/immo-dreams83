import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  HandCoins,
  KeyRound,
  SearchCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CTASection } from "@/components/site/cta-section";
import { PropertyCard } from "@/components/site/property-card";
import { PropertySearch } from "@/components/site/property-search";
import { SectionTitle } from "@/components/site/section-title";
import { ServiceCard } from "@/components/site/service-card";
import { StatsSection } from "@/components/site/stats-section";
import { getFeaturedPublicProperties } from "@/lib/public-properties";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agence immobilière Solliès-Pont",
  description:
    "IMMO-DREAMS83 accompagne vos projets immobiliers dans le Var : maison à vendre, appartement à vendre à Toulon, terrain à vendre et estimation immobilière.",
};

export default async function Home() {
  const featuredProperties = await getFeaturedPublicProperties();

  return (
    <>
      <section className="relative overflow-hidden bg-[#111111]">
        <Image
          src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1800&q=85"
          alt="Villa méditerranéenne dans le Sud de la France"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/86 via-black/54 to-orange-700/28" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white to-transparent" />

        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col justify-center px-4 py-10 sm:min-h-[700px] sm:px-6 sm:py-14 lg:px-8 lg:py-12">
          <div className="max-w-3xl">
            <Badge className="mb-4 border-0 bg-white/15 px-4 py-2 text-white backdrop-blur">
              Agence immobilière à Solliès-Pont
            </Badge>
            <p className="mb-4 text-base font-semibold text-orange-300 sm:text-lg">
              Votre horizon commence ici.
            </p>
            <h1 className="text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Trouvez le bien de vos rêves dans le Var
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/82 sm:text-lg sm:leading-8">
              Maisons, appartements et terrains sélectionnés avec exigence, pour
              construire votre projet immobilier dans le Sud de la France.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/a-vendre"
                className={buttonVariants({
                  className:
                    "h-12 bg-orange-500 px-5 text-white shadow-lg shadow-orange-900/20 hover:bg-orange-600",
                })}
              >
                Voir les biens disponibles
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/estimation"
                className={buttonVariants({
                  variant: "outline",
                  className:
                    "h-12 border-white/35 bg-white/10 px-5 text-white backdrop-blur hover:bg-white hover:text-[#111111]",
                })}
              >
                Faire estimer mon bien
              </Link>
            </div>
          </div>

          <div className="mt-8 w-full max-w-6xl">
            <PropertySearch />
          </div>
        </div>
      </section>

      {featuredProperties.length > 0 ? (
        <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <SectionTitle
                eyebrow="À la vente"
                title="Une sélection de biens dans le Var"
                description="Découvrez des appartements, maisons et terrains choisis pour leur emplacement, leur potentiel et leur cohérence avec le marché local."
              />
              <Link
                href="/a-vendre"
                className={buttonVariants({
                  variant: "outline",
                  className: "h-11 border-orange-200 text-orange-700 hover:bg-orange-50",
                })}
              >
                Voir toute la sélection
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredProperties.slice(0, 6).map((property, index) => (
                <PropertyCard key={property.id} property={property} priority={index < 3} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <StatsSection />

      <section className="bg-orange-50 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-orange-100 shadow-xl shadow-orange-200/50">
            <Image
              src="https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1400&q=85"
              alt="Intérieur lumineux d'une maison méditerranéenne"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <SectionTitle
              eyebrow="L'agence"
              title="Une agence locale, humaine et ambitieuse"
              description="IMMO-DREAMS83 accompagne les vendeurs et acquéreurs à Solliès-Pont, Toulon, Hyères, Carqueiranne, Cuers et dans les communes voisines. Notre priorité : rendre votre projet clair, lisible et bien accompagné."
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/agence"
                className={buttonVariants({
                  className: "h-11 bg-[#111111] px-5 text-white hover:bg-gray-800",
                })}
              >
                Découvrir l&apos;agence
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className={buttonVariants({
                  variant: "outline",
                  className: "h-11 border-orange-200 bg-white text-orange-700 hover:bg-orange-50",
                })}
              >
                Parler de mon projet
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Services"
            title="Un accompagnement clair à chaque étape"
            description="Une approche simple : comprendre le projet, cadrer la valeur, trouver les bons acquéreurs et sécuriser la transaction."
            align="center"
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <ServiceCard
              icon={Building2}
              title="Vente immobilière"
              description="Positionnement, mise en valeur et diffusion adaptée au marché local."
            />
            <ServiceCard
              icon={HandCoins}
              title="Estimation de bien"
              description="Analyse locale pour définir un prix crédible, clair et défendable."
            />
            <ServiceCard
              icon={SearchCheck}
              title="Recherche d'acquéreurs"
              description="Qualification des profils pour concentrer les visites utiles."
            />
            <ServiceCard
              icon={KeyRound}
              title="Achat maison, appartement ou terrain"
              description="Sélection de biens cohérents avec votre budget et votre mode de vie."
            />
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}

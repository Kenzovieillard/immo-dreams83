import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, KeyRound, MapPinned, ScanSearch } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PropertyCard } from "@/components/site/property-card";
import { RivieraCtaBand } from "@/components/site/riviera-cta-band";
import { RivieraHomeHero } from "@/components/site/riviera-home-hero";
import { StatsSection } from "@/components/site/stats-section";
import { homeFeaturedPropertyLimit } from "@/data/properties";
import { getFeaturedPublicProperties } from "@/lib/public-properties";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agence immobilière Solliès-Pont",
  description:
    "IMMO DREAMS accompagne vos projets immobiliers dans le Var : maisons, appartements, terrains et estimation immobilière locale.",
};

function getFeaturedGridClass(count: number) {
  if (count === 1) return "mx-auto grid max-w-xl grid-cols-1 gap-6";
  if (count === 2) return "mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2";
  return "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3";
}

const serviceItems = [
  {
    icon: MapPinned,
    title: "Une expertise vraiment locale",
    description:
      "Une lecture concrète de Solliès-Pont, Toulon, Hyères, Carqueiranne et des communes voisines.",
  },
  {
    icon: ScanSearch,
    title: "Une estimation argumentée",
    description:
      "Un prix cohérent avec le bien, son environnement et la demande actuelle.",
  },
  {
    icon: KeyRound,
    title: "Un suivi jusqu'à la signature",
    description:
      "Un interlocuteur unique pour garder chaque étape claire et utile.",
  },
];

export default async function Home() {
  const featuredProperties = await getFeaturedPublicProperties();
  const visibleFeaturedProperties = featuredProperties.slice(0, homeFeaturedPropertyLimit);

  return (
    <>
      <RivieraHomeHero />

      {visibleFeaturedProperties.length > 0 ? (
        <section className="bg-[#fbf9f4] px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[80rem]">
            <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase text-orange-600">
                  Sélection du moment
                </p>
                <h2 className="mt-4 max-w-[40rem] text-3xl font-black leading-tight text-[#111111] sm:text-5xl">
                  Des biens choisis pour leur potentiel
                </h2>
                <p className="mt-4 max-w-[43rem] text-base leading-7 text-gray-600">
                  Photos, prix, caractéristiques et diagnostics sont présentés sans
                  détour pour vous aider à décider plus vite.
                </p>
              </div>
              <Link
                href="/a-vendre"
                className={buttonVariants({
                  variant: "outline",
                  className:
                    "h-12 w-full border-orange-200 bg-white text-[#111111] hover:bg-orange-50 sm:w-auto",
                })}
              >
                Voir tous les biens
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <div className={getFeaturedGridClass(visibleFeaturedProperties.length)}>
              {visibleFeaturedProperties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-white px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[80rem] gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#e8e3da]">
            <Image
              src="/images/riviera/interior-hero.jpg"
              alt="Intérieur contemporain d'une villa dans le Var"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-orange-600">
              L’agence
            </p>
            <h2 className="mt-4 max-w-[34rem] text-3xl font-black leading-tight text-[#111111] sm:text-5xl">
              Une approche locale, directe et exigeante
            </h2>
            <p className="mt-5 max-w-[39rem] text-base leading-7 text-gray-600">
              IMMO DREAMS accompagne vendeurs et acquéreurs avec une méthode
              lisible : comprendre le projet, cadrer la valeur, présenter le bien
              avec soin et organiser les échanges utiles.
            </p>
            <ul className="mt-7 grid gap-3 text-sm font-semibold text-[#111111] sm:grid-cols-2">
              {[
                "Avis de valeur clair",
                "Présentation soignée",
                "Contacts qualifiés",
                "Suivi humain",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/agence"
                className={buttonVariants({
                  className: "h-12 bg-[#111111] px-5 text-white hover:bg-orange-600",
                })}
              >
                Découvrir l’agence
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className={buttonVariants({
                  variant: "outline",
                  className:
                    "h-12 border-orange-200 bg-white px-5 text-[#111111] hover:bg-orange-50",
                })}
              >
                Parler de mon projet
              </Link>
            </div>
          </div>
        </div>
      </section>

      <StatsSection />

      <section className="bg-[#fbf9f4] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[80rem]">
          <div className="max-w-[42rem]">
            <p className="text-xs font-bold uppercase text-orange-600">
              Un service complet
            </p>
            <h2 className="mt-4 text-3xl font-black leading-tight text-[#111111] sm:text-5xl">
              À chaque étape, une action claire
            </h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg bg-orange-100 md:grid-cols-3">
            {serviceItems.map((item, index) => (
              <article
                key={item.title}
                className={index === 0 ? "bg-[#111111] p-7 text-white" : "bg-white p-7"}
              >
                <item.icon
                  className={index === 0 ? "size-8 text-orange-400" : "size-8 text-orange-600"}
                  aria-hidden="true"
                />
                <h3 className="mt-7 text-xl font-black">{item.title}</h3>
                <p
                  className={
                    index === 0
                      ? "mt-4 text-sm leading-6 text-white/68"
                      : "mt-4 text-sm leading-6 text-gray-600"
                  }
                >
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <RivieraCtaBand />
    </>
  );
}

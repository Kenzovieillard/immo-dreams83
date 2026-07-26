import type { Metadata } from "next";
import { PropertyListingBrowser } from "@/components/site/property-listing-browser";
import { RivieraCtaBand } from "@/components/site/riviera-cta-band";
import { RivieraPageHero } from "@/components/site/riviera-page-hero";
import { PropertyType } from "@/data/properties";
import { getAvailablePublicProperties } from "@/lib/public-properties";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Biens à vendre dans le Var | IMMO DREAMS",
  description:
    "Découvrez les maisons, appartements et terrains à vendre autour de Solliès-Pont avec IMMO DREAMS.",
};

type AVendrePageProps = {
  searchParams: Promise<{
    type?: string;
    city?: string;
    budget?: string;
    surface?: string;
  }>;
};

function normalizeType(type?: string): "all" | PropertyType | undefined {
  if (
    type === "apartment" ||
    type === "house" ||
    type === "land" ||
    type === "commercial" ||
    type === "parking" ||
    type === "other" ||
    type === "all"
  ) {
    return type;
  }
  return undefined;
}

export default async function AVendrePage({ searchParams }: AVendrePageProps) {
  const params = await searchParams;
  const properties = await getAvailablePublicProperties();

  return (
    <>
      <RivieraPageHero
        eyebrow="Nos biens à vendre"
        title="Biens disponibles dans le Var"
        description="Maisons, appartements et terrains sélectionnés localement, avec une lecture simple des informations essentielles."
      />

      <section className="bg-[#fbf9f4] px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mx-auto max-w-[80rem]">
          <PropertyListingBrowser
            properties={properties}
            initialFilters={{
              type: normalizeType(params.type),
              city: params.city || undefined,
              budget: params.budget || undefined,
              surface: params.surface || undefined,
            }}
          />
        </div>
      </section>

      <RivieraCtaBand />

      <section className="bg-[#fbf9f4] px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mx-auto grid max-w-[80rem] gap-7 border-t-2 border-orange-500 pt-10 lg:grid-cols-2 lg:gap-20">
          <h2 className="max-w-[32rem] text-3xl font-black leading-tight text-[#111111] sm:text-4xl">
            Une sélection exigeante, un accompagnement local.
          </h2>
          <div>
            <p className="max-w-[34rem] text-base leading-7 text-gray-600">
              Présentation claire, diagnostics visibles et échanges directs avec
              l’agence pour comprendre chaque bien avant de se déplacer.
            </p>
            <p className="mt-7 text-xs font-bold uppercase text-[#111111]">
              Solliès-Pont · Toulon · Hyères · Carqueiranne
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

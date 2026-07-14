import type { Metadata } from "next";
import { PropertyListingBrowser } from "@/components/site/property-listing-browser";
import { SectionTitle } from "@/components/site/section-title";
import { PropertyType } from "@/data/properties";
import { getAvailablePublicProperties } from "@/lib/public-properties";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Biens à vendre dans le Var | IMMO-DREAMS83",
  description:
    "Découvrez les maisons à vendre dans le Var, appartements à vendre à Toulon et terrains à vendre autour de Solliès-Pont avec IMMO-DREAMS83.",
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
  if (type === "apartment" || type === "house" || type === "land" || type === "all") {
    return type;
  }
  return undefined;
}

export default async function AVendrePage({ searchParams }: AVendrePageProps) {
  const params = await searchParams;
  const properties = await getAvailablePublicProperties();

  return (
    <>
      <section className="bg-orange-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Nos biens à vendre"
            title="Biens disponibles dans le Var"
            description="Parcourez notre sélection de maisons, appartements et terrains, avec des filtres simples pour affiner votre recherche immobilière."
          />
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
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
    </>
  );
}

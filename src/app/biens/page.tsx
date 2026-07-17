import type { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyCard } from "@/components/site/property-card";
import { SectionTitle } from "@/components/site/section-title";
import {
  PropertyType,
  propertyTypeLabels,
} from "@/data/properties";
import { getAvailablePublicProperties } from "@/lib/public-properties";

const categories: PropertyType[] = ["apartment", "house", "land", "commercial", "parking", "other"];
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Biens immobiliers Var | IMMO-DREAMS83",
  description:
    "Catalogue IMMO-DREAMS83 : appartements, maisons et terrains à vendre dans le Var, à Solliès-Pont, Toulon, Hyères, Cuers et Carqueiranne.",
};

export default async function BiensPage() {
  const availableProperties = await getAvailablePublicProperties();

  return (
    <>
      <section className="bg-orange-50 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Biens"
            title="Explorer notre sélection par catégorie"
            description="Un catalogue clair pour distinguer les appartements, les maisons et les terrains disponibles dans le Var."
          />
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Tabs defaultValue="apartment" className="gap-8">
            <TabsList className="h-auto w-full justify-start overflow-x-auto bg-orange-50 p-1 md:w-fit">
              {categories.map((category) => (
                <TabsTrigger key={category} value={category} className="h-11 px-5 sm:h-10">
                  {category === "apartment"
                    ? "Appartements"
                    : category === "commercial"
                      ? "Locaux commerciaux"
                    : category === "parking"
                      ? "Stationnements"
                    : category === "other"
                      ? "Autres biens"
                    : `${propertyTypeLabels[category]}s`}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((category) => {
              const categoryProperties = availableProperties.filter(
                (property) => property.type === category
              );

              return (
                <TabsContent key={category} value={category}>
                  {categoryProperties.length > 0 ? (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {categoryProperties.map((property) => (
                        <PropertyCard key={property.id} property={property} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50 p-10 text-center">
                      <h2 className="text-xl font-black text-[#111111]">
                        Aucun bien disponible dans cette catégorie
                      </h2>
                      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-600">
                        Contactez l&apos;agence pour être informé des prochaines nouveautés.
                      </p>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </section>
    </>
  );
}

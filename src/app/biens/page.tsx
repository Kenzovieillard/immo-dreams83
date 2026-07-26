import type { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyCard } from "@/components/site/property-card";
import { RivieraCtaBand } from "@/components/site/riviera-cta-band";
import { RivieraPageHero } from "@/components/site/riviera-page-hero";
import { PropertyType, propertyTypeLabels } from "@/data/properties";
import { getAvailablePublicProperties } from "@/lib/public-properties";

const categories: PropertyType[] = [
  "apartment",
  "house",
  "land",
  "commercial",
  "parking",
  "other",
];

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Biens immobiliers dans le Var | IMMO DREAMS",
  description:
    "Explorez le catalogue IMMO DREAMS : appartements, maisons, terrains et locaux à vendre dans le Var.",
};

function getCategoryLabel(category: PropertyType) {
  if (category === "apartment") return "Appartements";
  if (category === "commercial") return "Locaux";
  if (category === "parking") return "Stationnements";
  if (category === "other") return "Autres";
  return `${propertyTypeLabels[category]}s`;
}

export default async function BiensPage() {
  const availableProperties = await getAvailablePublicProperties();

  return (
    <>
      <RivieraPageHero
        eyebrow="Catalogue"
        title="Explorer les biens par catégorie"
        description="Un accès direct aux appartements, maisons, terrains et autres opportunités disponibles dans le Var."
      />

      <section className="bg-[#fbf9f4] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[80rem]">
          <Tabs defaultValue="apartment" className="gap-9">
            <TabsList className="no-scrollbar h-auto w-full justify-start overflow-x-auto rounded-lg bg-white p-1 shadow-sm ring-1 ring-orange-100">
              {categories.map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="h-11 shrink-0 px-5 text-sm"
                >
                  {getCategoryLabel(category)}
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
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {categoryProperties.map((property) => (
                        <PropertyCard key={property.id} property={property} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-orange-200 bg-white p-10 text-center">
                      <h2 className="text-xl font-black text-[#111111]">
                        Aucun bien disponible dans cette catégorie
                      </h2>
                      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-600">
                        Contactez l’agence pour être informé des prochaines
                        nouveautés.
                      </p>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </section>

      <RivieraCtaBand />
    </>
  );
}

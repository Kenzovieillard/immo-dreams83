"use client";

import { useMemo, useRef, useState } from "react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Property,
  PropertyType,
  propertyTypeLabels,
} from "@/data/properties";
import { PropertyCard } from "./property-card";

const propertyTypeFilters: Array<"all" | PropertyType> = [
  "all",
  "apartment",
  "house",
  "land",
  "commercial",
  "parking",
  "other",
];

type Filters = {
  type: "all" | PropertyType;
  city: string;
  budget: string;
  surface: string;
  rooms: string;
};

const defaultFilters: Filters = {
  type: "all",
  city: "Toutes",
  budget: "",
  surface: "",
  rooms: "",
};

type PropertyListingBrowserProps = {
  properties: Property[];
  initialFilters?: Partial<Filters>;
};

type FilterFieldsProps = {
  filters: Filters;
  cities: string[];
  onChange: (next: Partial<Filters>) => void;
};

function matchNumber(value: string, propertyValue: number | null, mode: "max" | "min") {
  if (!value) return true;
  if (propertyValue === null) return false;
  const parsed = Number(value.replace(/\s/g, ""));
  if (Number.isNaN(parsed)) return true;
  return mode === "max" ? propertyValue <= parsed : propertyValue >= parsed;
}

function FilterFields({ filters, cities, onChange }: FilterFieldsProps) {
  return (
    <div className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-[#111111]">
        Type de bien
        <Select
          value={filters.type}
          onValueChange={(value) =>
            onChange({ type: (value as Filters["type"]) ?? "all" })
          }
        >
          <SelectTrigger className="h-12 w-full border-0 bg-orange-50">
            <span className="flex flex-1 text-left text-[#111111]">
              {filters.type === "all"
                ? "Tous les biens"
                : propertyTypeLabels[filters.type]}
            </span>
          </SelectTrigger>
          <SelectContent>
            {propertyTypeFilters.map((type) => (
              <SelectItem key={type} value={type}>
                {type === "all" ? "Tous les biens" : propertyTypeLabels[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#111111]">
        Secteur
        <Select
          value={filters.city}
          onValueChange={(value) => onChange({ city: value ?? "Toutes" })}
        >
          <SelectTrigger className="h-12 w-full border-0 bg-orange-50">
            <span className="flex flex-1 text-left text-[#111111]">
              {filters.city === "Toutes" ? "Tout le Var" : filters.city}
            </span>
          </SelectTrigger>
          <SelectContent>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>
                {city === "Toutes" ? "Tout le Var" : city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#111111]">
        Budget maximum
        <Input
          inputMode="numeric"
          value={filters.budget}
          onChange={(event) => onChange({ budget: event.target.value })}
          className="h-12 border-0 bg-orange-50"
          placeholder="Ex. 500 000 €"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#111111]">
        Surface minimum
        <Input
          inputMode="numeric"
          value={filters.surface}
          onChange={(event) => onChange({ surface: event.target.value })}
          className="h-12 border-0 bg-orange-50"
          placeholder="Ex. 80 m²"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#111111]">
        Nombre de pièces minimum
        <Input
          inputMode="numeric"
          value={filters.rooms}
          onChange={(event) => onChange({ rooms: event.target.value })}
          className="h-12 border-0 bg-orange-50"
          placeholder="Ex. 3"
        />
      </label>
    </div>
  );
}

export function PropertyListingBrowser({
  properties,
  initialFilters,
}: PropertyListingBrowserProps) {
  const resultsRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const propertyCities = useMemo(
    () => ["Toutes", ...Array.from(new Set(properties.map((property) => property.city)))],
    [properties]
  );
  const sanitizedInitialFilters = Object.fromEntries(
    Object.entries(initialFilters ?? {}).filter(([, value]) => value !== undefined)
  ) as Partial<Filters>;

  const [filters, setFilters] = useState<Filters>({
    ...defaultFilters,
    ...sanitizedInitialFilters,
  });

  const updateFilters = (next: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...next }));
  };

  const resetFilters = () => setFilters(defaultFilters);

  const filteredProperties = useMemo(() => {
    return properties.filter((property: Property) => {
      const matchType = filters.type === "all" || property.type === filters.type;
      const matchCity = filters.city === "Toutes" || property.city === filters.city;
      const matchBudget = matchNumber(filters.budget, property.price, "max");
      const matchSurface = matchNumber(filters.surface, property.surface, "min");
      const matchRooms = matchNumber(filters.rooms, property.rooms, "min");

      return matchType && matchCity && matchBudget && matchSurface && matchRooms;
    });
  }, [filters, properties]);

  const showResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <div className="relative z-20 -mt-16 rounded-lg bg-white p-4 shadow-[0_20px_38px_-12px_rgba(17,17,17,0.18)] sm:-mt-20 sm:p-6">
        <p className="text-xs font-bold uppercase text-orange-600">
          Recherche immobilière
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_0.8fr_auto] lg:items-end">
          <label className="grid gap-1.5 text-xs font-semibold text-[#111111]">
            Secteur
            <Select
              value={filters.city}
              onValueChange={(value) => updateFilters({ city: value ?? "Toutes" })}
            >
              <SelectTrigger className="h-12 w-full border-0 bg-orange-50">
                <span className="flex flex-1 text-left text-gray-600">
                  {filters.city === "Toutes" ? "Solliès-Pont, Toulon, Hyères..." : filters.city}
                </span>
              </SelectTrigger>
              <SelectContent>
                {propertyCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city === "Toutes" ? "Tout le Var" : city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-[#111111]">
            Type
            <Select
              value={filters.type}
              onValueChange={(value) =>
                updateFilters({ type: (value as Filters["type"]) ?? "all" })
              }
            >
              <SelectTrigger className="h-12 w-full border-0 bg-orange-50">
                <span className="flex flex-1 text-left text-[#111111]">
                  {filters.type === "all"
                    ? "Tous les biens"
                    : propertyTypeLabels[filters.type]}
                </span>
              </SelectTrigger>
              <SelectContent>
                {propertyTypeFilters.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "all" ? "Tous les biens" : propertyTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="hidden gap-1.5 text-xs font-semibold text-[#111111] sm:grid">
            Budget maximum
            <Input
              inputMode="numeric"
              value={filters.budget}
              onChange={(event) => updateFilters({ budget: event.target.value })}
              className="h-12 border-0 bg-orange-50"
              placeholder="Ex. 500 000 €"
            />
          </label>

          <label className="hidden gap-1.5 text-xs font-semibold text-[#111111] lg:grid">
            Surface
            <Input
              inputMode="numeric"
              value={filters.surface}
              onChange={(event) => updateFilters({ surface: event.target.value })}
              className="h-12 border-0 bg-orange-50"
              placeholder="Ex. 80 m²"
            />
          </label>

          <Button
            type="button"
            onClick={showResults}
            className="h-12 w-full bg-orange-500 px-5 text-white hover:bg-orange-600 lg:w-auto"
          >
            <Search className="size-4" aria-hidden="true" />
            Rechercher
          </Button>
        </div>
      </div>

      <div ref={resultsRef} className="scroll-mt-24 pt-14 sm:pt-20">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-orange-600">
              Sélection du moment
            </p>
            <h2 className="mt-3 text-3xl font-black text-[#111111] sm:text-4xl">
              {filteredProperties.length === 1
                ? "1 bien correspond"
                : `${filteredProperties.length} biens correspondent`}
            </h2>
          </div>

          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  className="h-11 border-orange-200 bg-white lg:hidden"
                />
              }
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filtres
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(92vw,24rem)] overflow-y-auto bg-[#fbf9f4]"
            >
              <SheetHeader>
                <SheetTitle>Filtrer les biens</SheetTitle>
                <SheetDescription>
                  Ajustez les critères puis appliquez la sélection.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4">
                <FilterFields
                  filters={filters}
                  cities={propertyCities}
                  onChange={updateFilters}
                />
                <div className="mt-6 grid gap-3">
                  <Button
                    type="button"
                    className="h-12 bg-orange-500 text-white hover:bg-orange-600"
                    onClick={() => setFiltersOpen(false)}
                  >
                    Appliquer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 border-orange-200"
                    onClick={resetFilters}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Réinitialiser
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid gap-6 lg:grid-cols-[16.25rem_1fr] lg:items-start lg:gap-10">
          <aside className="sticky top-28 hidden rounded-lg bg-white p-6 shadow-sm ring-1 ring-orange-100 lg:block">
            <div className="mb-7 flex items-center justify-between gap-3">
              <h3 className="text-xl font-black text-[#111111]">Filtres</h3>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold text-orange-600 hover:underline"
              >
                Réinitialiser
              </button>
            </div>
            <FilterFields
              filters={filters}
              cities={propertyCities}
              onChange={updateFilters}
            />
          </aside>

          <div>
            {filteredProperties.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {filteredProperties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-orange-200 bg-white p-10 text-center">
                <h3 className="text-xl font-black text-[#111111]">
                  Aucun bien ne correspond à votre recherche
                </h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-600">
                  Élargissez le budget, la surface ou le secteur, ou contactez
                  l’agence pour une recherche personnalisée.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-6 border-orange-200"
                  onClick={resetFilters}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Réinitialiser
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Property,
  PropertyType,
  availableProperties,
  propertyCities,
  propertyTypeFilters,
  propertyTypeLabels,
} from "@/data/properties";
import { PropertyCard } from "./property-card";

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
  initialFilters?: Partial<Filters>;
};

function matchNumber(value: string, propertyValue: number | null, mode: "max" | "min") {
  if (!value || propertyValue === null) return true;
  const parsed = Number(value.replace(/\s/g, ""));
  if (Number.isNaN(parsed)) return true;
  return mode === "max" ? propertyValue <= parsed : propertyValue >= parsed;
}

export function PropertyListingBrowser({
  initialFilters,
}: PropertyListingBrowserProps) {
  const sanitizedInitialFilters = Object.fromEntries(
    Object.entries(initialFilters ?? {}).filter(([, value]) => value !== undefined)
  ) as Partial<Filters>;

  const [filters, setFilters] = useState<Filters>({
    ...defaultFilters,
    ...sanitizedInitialFilters,
  });

  const filteredProperties = useMemo(() => {
    return availableProperties.filter((property: Property) => {
      const matchType = filters.type === "all" || property.type === filters.type;
      const matchCity = filters.city === "Toutes" || property.city === filters.city;
      const matchBudget = matchNumber(filters.budget, property.price, "max");
      const matchSurface = matchNumber(filters.surface, property.surface, "min");
      const matchRooms = matchNumber(filters.rooms, property.rooms, "min");

      return matchType && matchCity && matchBudget && matchSurface && matchRooms;
    });
  }, [filters]);

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit border-orange-100 bg-white shadow-sm">
        <CardContent className="grid gap-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-orange-600" aria-hidden="true" />
            <h2 className="text-lg font-black text-[#111111]">Filtres</h2>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-gray-700">
            Type
            <Select
              value={filters.type}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  type: (value as Filters["type"]) ?? "all",
                }))
              }
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Tous les types" />
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

          <label className="grid gap-2 text-sm font-semibold text-gray-700">
            Ville
            <Select
              value={filters.city}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, city: value ?? "Toutes" }))
              }
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Toutes les villes" />
              </SelectTrigger>
              <SelectContent>
                {propertyCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-gray-700">
            Budget maximum
            <Input
              inputMode="numeric"
              value={filters.budget}
              onChange={(event) =>
                setFilters((current) => ({ ...current, budget: event.target.value }))
              }
              placeholder="500000"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-gray-700">
            Surface minimum
            <Input
              inputMode="numeric"
              value={filters.surface}
              onChange={(event) =>
                setFilters((current) => ({ ...current, surface: event.target.value }))
              }
              placeholder="80"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-gray-700">
            Nombre de pièces minimum
            <Input
              inputMode="numeric"
              value={filters.rooms}
              onChange={(event) =>
                setFilters((current) => ({ ...current, rooms: event.target.value }))
              }
              placeholder="3"
            />
          </label>

          <Button
            type="button"
            variant="outline"
            className="h-10 border-orange-200"
            onClick={() => setFilters(defaultFilters)}
          >
            Réinitialiser
          </Button>
        </CardContent>
      </Card>

      <div>
        <div className="mb-5 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-gray-600">
            {filteredProperties.length} bien
            {filteredProperties.length > 1 ? "s" : ""} disponible
            {filteredProperties.length > 1 ? "s" : ""}
          </p>
        </div>

        {filteredProperties.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50 p-10 text-center">
            <h3 className="text-xl font-black text-[#111111]">
              Aucun bien ne correspond à votre recherche
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-600">
              Essayez d&apos;élargir le budget, la surface ou la ville. Vous pouvez aussi
              contacter l&apos;agence pour une recherche personnalisée dans le Var.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

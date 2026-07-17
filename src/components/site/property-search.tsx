"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const propertySearchTypeLabels = {
  all: "Tous les biens",
  apartment: "Appartement",
  house: "Maison",
  land: "Terrain",
  commercial: "Local commercial",
  parking: "Stationnement",
  other: "Autre bien",
} as const;

type PropertySearchType = keyof typeof propertySearchTypeLabels;

export function PropertySearch() {
  const [selectedType, setSelectedType] = useState<PropertySearchType>("all");

  return (
    <form
      action="/a-vendre"
      className="grid w-full max-w-full gap-5 rounded-xl border border-orange-100 bg-white p-4 shadow-2xl shadow-black/15 sm:p-5 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end"
    >
      <div className="md:col-span-5">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">
          Recherche immobilière
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Précisez votre projet, nous vous guidons vers les biens les plus adaptés.
        </p>
      </div>

      <label className="grid min-w-0 gap-2 text-base font-semibold text-gray-800 sm:text-sm">
        Type de bien recherché
        <Select
          name="type"
          value={selectedType}
          onValueChange={(value) => setSelectedType((value as PropertySearchType) ?? "all")}
        >
          <SelectTrigger className="h-12 w-full border-orange-200 bg-orange-50/40">
            <span className="flex flex-1 text-left text-gray-900">
              {propertySearchTypeLabels[selectedType]}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les biens</SelectItem>
            <SelectItem value="apartment">Appartement</SelectItem>
            <SelectItem value="house">Maison</SelectItem>
            <SelectItem value="land">Terrain</SelectItem>
            <SelectItem value="commercial">Local commercial</SelectItem>
            <SelectItem value="parking">Stationnement</SelectItem>
            <SelectItem value="other">Autre bien</SelectItem>
          </SelectContent>
        </Select>
      </label>

      <label className="grid min-w-0 gap-2 text-base font-semibold text-gray-800 sm:text-sm">
        Ville ou secteur
        <Input
          name="city"
          className="h-12 border-orange-200 bg-orange-50/40"
          placeholder="Solliès-Pont, Toulon..."
        />
      </label>

      <label className="grid min-w-0 gap-2 text-base font-semibold text-gray-800 sm:text-sm">
        Budget maximum
        <Input
          name="budget"
          className="h-12 border-orange-200 bg-orange-50/40"
          placeholder="Ex. 450 000 €"
        />
      </label>

      <label className="grid min-w-0 gap-2 text-base font-semibold text-gray-800 sm:text-sm">
        Surface souhaitée
        <Input
          name="surface"
          className="h-12 border-orange-200 bg-orange-50/40"
          placeholder="Ex. 90 m2"
        />
      </label>

      <Button
        type="submit"
        className="h-12 w-full bg-orange-500 px-6 text-white shadow-lg shadow-orange-200 hover:bg-orange-600 md:w-auto"
      >
        <Search className="size-4" aria-hidden="true" />
        Rechercher
      </Button>
    </form>
  );
}

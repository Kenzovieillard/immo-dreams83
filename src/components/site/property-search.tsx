"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
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
      className="w-full max-w-full rounded-lg border border-orange-100 bg-white p-4 shadow-[0_20px_38px_-12px_rgba(17,17,17,0.24)] sm:p-5"
    >
      <p className="text-xs font-bold uppercase text-orange-600 sm:text-sm">
        Recherche immobilière
      </p>
      <p className="mt-2 max-w-[48rem] text-sm leading-5 text-gray-500">
        <span className="sm:hidden">
          Précisez votre projet, nous ciblons les biens adaptés.
        </span>
        <span className="hidden sm:inline">
          Précisez votre projet, nous vous guidons vers les biens les plus adaptés.
        </span>
      </p>

      <div className="mt-4 grid gap-3 md:hidden">
        <label>
          <span className="sr-only">Type de bien recherché</span>
          <Select
            name="type"
            value={selectedType}
            onValueChange={(value) =>
              setSelectedType((value as PropertySearchType) ?? "all")
            }
          >
            <SelectTrigger className="h-12 w-full border-orange-200 bg-orange-50">
              <span className="flex flex-1 text-left font-medium text-[#111111]">
                {propertySearchTypeLabels[selectedType]}
              </span>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(propertySearchTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="grid grid-cols-[1fr_4rem] gap-3">
          <label>
            <span className="sr-only">Ville ou secteur</span>
            <Input
              name="city"
              className="h-12 border-orange-200 bg-orange-50"
              placeholder="Solliès-Pont, Toulon..."
            />
          </label>
          <Button
            type="submit"
            aria-label="Rechercher les biens"
            className="h-12 w-16 bg-orange-500 p-0 text-white hover:bg-orange-600"
          >
            <Search className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <Link
          href="/a-vendre"
          className="flex items-center justify-between py-1 text-xs font-semibold text-gray-500 hover:text-orange-600"
        >
          Filtres avancés
          <ArrowRight className="size-4 text-orange-500" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-5 hidden gap-4 md:grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-gray-800">
          Type de bien recherché
          <Select
            name="type"
            value={selectedType}
            onValueChange={(value) =>
              setSelectedType((value as PropertySearchType) ?? "all")
            }
          >
            <SelectTrigger className="h-12 w-full border-orange-200 bg-orange-50">
              <span className="flex flex-1 text-left text-gray-900">
                {propertySearchTypeLabels[selectedType]}
              </span>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(propertySearchTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="grid min-w-0 gap-2 text-sm font-semibold text-gray-800">
          Ville ou secteur
          <Input
            name="city"
            className="h-12 border-orange-200 bg-orange-50"
            placeholder="Solliès-Pont, Toulon..."
          />
        </label>

        <label className="grid min-w-0 gap-2 text-sm font-semibold text-gray-800">
          Budget maximum
          <Input
            name="budget"
            className="h-12 border-orange-200 bg-orange-50"
            placeholder="Ex. 450 000 €"
          />
        </label>

        <label className="grid min-w-0 gap-2 text-sm font-semibold text-gray-800">
          Surface souhaitée
          <Input
            name="surface"
            className="h-12 border-orange-200 bg-orange-50"
            placeholder="Ex. 90 m²"
          />
        </label>

        <Button
          type="submit"
          className="h-12 w-full bg-orange-500 px-6 text-white shadow-lg shadow-orange-200 hover:bg-orange-600 md:w-auto"
        >
          <Search className="size-4" aria-hidden="true" />
          Rechercher
        </Button>
      </div>
    </form>
  );
}

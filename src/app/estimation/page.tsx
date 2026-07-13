import type { Metadata } from "next";
import { BadgeCheck, Clock, Handshake, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EstimationForm } from "@/components/forms/estimation-form";
import { SectionTitle } from "@/components/site/section-title";

export const metadata: Metadata = {
  title: "Estimation immobilière Var",
  description:
    "Demandez une estimation immobilière dans le Var avec IMMO-DREAMS83 : maison, appartement, terrain ou immeuble à Solliès-Pont et alentours.",
};

const reassurance = [
  { label: "Estimation offerte", icon: BadgeCheck },
  { label: "Réponse rapide", icon: Clock },
  { label: "Expertise locale", icon: MapPinned },
  { label: "Accompagnement personnalisé", icon: Handshake },
];

const steps = [
  {
    title: "Analyse de votre bien",
    text: "Type, surface, état, emplacement, extérieurs et points de différenciation.",
  },
  {
    title: "Étude du marché local",
    text: "Comparaison avec les biens similaires et lecture de la demande dans votre secteur.",
  },
  {
    title: "Recommandation de prix",
    text: "Prix cible, marge de négociation et stratégie de commercialisation claire.",
  },
];

export default function EstimationPage() {
  return (
    <>
      <section className="bg-[#111111] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <Badge className="mb-5 border-0 bg-orange-500 text-white">
              Estimation immobilière
            </Badge>
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
              Faites estimer votre bien immobilier
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
              Recevez une estimation claire, locale et réaliste de votre maison,
              appartement, terrain ou immeuble dans le Var.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {reassurance.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3"
                >
                  <item.icon className="size-5 text-orange-400" aria-hidden="true" />
                  <span className="text-sm font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <EstimationForm />
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Méthode"
            title="Une estimation en 3 temps"
            description="Le but n'est pas seulement d'obtenir un chiffre, mais de comprendre comment vendre au bon prix."
            align="center"
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <Card key={step.title} className="border-orange-100 bg-white shadow-sm">
                <CardContent className="p-6">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-orange-100 text-lg font-black text-orange-700">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-xl font-black text-[#111111]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-600">{step.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

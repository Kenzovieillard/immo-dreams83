import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2, Handshake, MapPinned, Target, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CTASection } from "@/components/site/cta-section";
import { SectionTitle } from "@/components/site/section-title";
import { agencyContact } from "@/components/site/site-config";

export const metadata: Metadata = {
  title: "L'Agence immobilière IMMO-DREAMS83",
  description:
    "Découvrez IMMO-DREAMS83, agence immobilière locale à Solliès-Pont, spécialisée dans la vente et l'estimation de biens dans le Var.",
};

const values = [
  { title: "Proximité", description: "Une agence ancrée à Solliès-Pont et active dans le Var." },
  { title: "Transparence", description: "Des conseils lisibles, sans discours flou ni promesse artificielle." },
  { title: "Exigence", description: "Présentation soignée, prix cohérent et suivi rigoureux." },
  { title: "Réactivité", description: "Des retours rapides pour garder le projet en mouvement." },
];

const process = [
  "Estimation",
  "Stratégie de vente",
  "Diffusion",
  "Visites",
  "Négociation",
  "Signature",
];

export default function AgencePage() {
  return (
    <>
      <section className="bg-[#111111] px-4 py-12 text-white sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <Badge className="mb-5 border-0 bg-orange-500 text-white">Agence locale</Badge>
            <h1 className="max-w-[22rem] break-words text-[2rem] font-black leading-[1.08] tracking-tight sm:max-w-4xl sm:text-6xl">
              L&apos;agence IMMO-DREAMS83
            </h1>
            <p className="mt-5 max-w-[22rem] text-base leading-7 text-white/75 sm:mt-6 sm:max-w-2xl sm:text-lg sm:leading-8">
              Nous aidons les propriétaires et acquéreurs à vendre, acheter et
              arbitrer leurs projets immobiliers avec confiance dans le Var.
            </p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white/10">
            <Image
              src="https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=85"
              alt="Maison contemporaine dans le Sud"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <SectionTitle
            eyebrow="Mission"
            title="Vendre et acheter avec plus de clarté"
            description="Notre rôle est de transformer un projet immobilier souvent complexe en parcours lisible : valeur du bien, cible d'acquéreurs, présentation, négociation et calendrier."
          />
          <div className="grid gap-4">
            {[
              { icon: MapPinned, text: "Expertise locale sur Solliès-Pont, Toulon, Hyères, Carqueiranne et Cuers." },
              { icon: Target, text: "Stratégie de vente adaptée au bien, au quartier et à la demande." },
              { icon: Handshake, text: "Accompagnement humain, du premier échange jusqu'à la signature." },
              { icon: Timer, text: "Suivi réactif pour éviter les zones d'incertitude." },
            ].map((item) => (
              <div
                key={item.text}
                className="flex gap-4 rounded-xl border border-orange-100 bg-orange-50 p-5"
              >
                <item.icon className="size-6 shrink-0 text-orange-600" aria-hidden="true" />
                <p className="text-sm leading-6 text-gray-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-orange-50 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Valeurs"
            title="Un cadre de travail simple et fiable"
            align="center"
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <Card key={value.title} className="border-orange-100 bg-white shadow-sm">
                <CardHeader>
                  <CheckCircle2 className="size-7 text-orange-600" aria-hidden="true" />
                  <CardTitle className="text-xl font-black text-[#111111]">{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-gray-600">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <Card className="border-orange-100 bg-[#111111] text-white">
            <CardHeader>
              <div className="relative mb-4 aspect-square overflow-hidden rounded-xl bg-white/10">
                <Image
                  src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=900&q=85"
                  alt="Portrait d'un conseiller immobilier"
                  fill
                  sizes="(min-width: 1024px) 30vw, 100vw"
                  className="object-cover"
                />
              </div>
              <CardTitle className="text-2xl font-black">{agencyContact.representative}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-white/70">
                Représentant d&apos;IMMO-DREAMS83, Antoine accompagne vendeurs et acquéreurs
                avec une approche locale, pédagogique et réactive depuis Solliès-Pont.
              </p>
            </CardContent>
          </Card>

          <div>
            <SectionTitle
              eyebrow="Process"
              title="Une méthode de vente en 6 étapes"
              description="Chaque étape donne un repère clair au vendeur et permet de piloter la commercialisation sans improvisation."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {process.map((step, index) => (
                <div
                  key={step}
                  className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm"
                >
                  <span className="text-sm font-black text-orange-600">
                    Étape {index + 1}
                  </span>
                  <h3 className="mt-2 text-lg font-black text-[#111111]">{step}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title="Besoin d'un avis fiable sur votre projet ?"
        subtitle="L'agence vous aide à poser les bonnes priorités avant de vendre ou d'acheter."
        buttonLabel="Échanger avec l'agence"
      />
    </>
  );
}

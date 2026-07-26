import type { Metadata } from "next";
import Image from "next/image";
import { Check, Handshake, MapPinned, Target, Timer } from "lucide-react";
import { RivieraCtaBand } from "@/components/site/riviera-cta-band";
import { RivieraPageHero } from "@/components/site/riviera-page-hero";
import { agencyContact } from "@/components/site/site-config";

export const metadata: Metadata = {
  title: "L'agence immobilière IMMO DREAMS",
  description:
    "Découvrez IMMO DREAMS, agence immobilière locale à Solliès-Pont spécialisée dans la vente et l'estimation de biens dans le Var.",
};

const values = [
  {
    title: "Proximité",
    description: "Une agence ancrée à Solliès-Pont et active dans le Var.",
  },
  {
    title: "Transparence",
    description: "Des conseils lisibles, sans discours flou ni promesse artificielle.",
  },
  {
    title: "Exigence",
    description: "Présentation soignée, prix cohérent et suivi rigoureux.",
  },
  {
    title: "Réactivité",
    description: "Des retours rapides pour garder le projet en mouvement.",
  },
];

const process = [
  {
    title: "Estimation",
    description: "Comprendre le bien, son secteur et sa valeur défendable.",
  },
  {
    title: "Stratégie de vente",
    description: "Définir le positionnement, la cible et le calendrier.",
  },
  {
    title: "Mise en valeur",
    description: "Présenter les espaces et les informations sans approximation.",
  },
  {
    title: "Diffusion",
    description: "Rendre le bien visible auprès des bons acquéreurs.",
  },
  {
    title: "Visites et négociation",
    description: "Qualifier les échanges et défendre les intérêts du vendeur.",
  },
  {
    title: "Signature",
    description: "Sécuriser les dernières étapes jusqu'à l'acte définitif.",
  },
];

const missionPoints = [
  {
    icon: MapPinned,
    text: "Expertise locale sur Solliès-Pont, Toulon, Hyères, Carqueiranne et Cuers.",
  },
  {
    icon: Target,
    text: "Stratégie de vente adaptée au bien, au quartier et à la demande.",
  },
  {
    icon: Handshake,
    text: "Accompagnement humain, du premier échange jusqu'à la signature.",
  },
  {
    icon: Timer,
    text: "Suivi réactif pour éviter les zones d'incertitude.",
  },
];

export default function AgencePage() {
  return (
    <>
      <RivieraPageHero
        eyebrow="L'agence"
        title="L'immobilier local, avec plus de clarté"
        description="Nous aidons les propriétaires et acquéreurs à vendre, acheter et arbitrer leurs projets immobiliers avec confiance dans le Var."
        height="large"
        actions={[
          { href: "/contact", label: "Rencontrer l'agence" },
          { href: "/estimation", label: "Faire estimer mon bien", variant: "secondary" },
        ]}
      />

      <section className="bg-white px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[80rem] gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase text-orange-600">
              Notre mission
            </p>
            <h2 className="mt-4 max-w-[39rem] text-3xl font-black leading-tight text-[#111111] sm:text-5xl">
              Transformer un projet complexe en parcours lisible
            </h2>
            <p className="mt-6 max-w-[40rem] text-base leading-8 text-gray-600">
              Valeur du bien, cible d’acquéreurs, présentation, négociation et
              calendrier : chaque décision est expliquée, documentée et reliée à
              une prochaine action concrète.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {missionPoints.map((item) => (
                <div key={item.text} className="border-t border-orange-200 pt-5">
                  <item.icon
                    className="size-6 text-orange-600"
                    aria-hidden="true"
                  />
                  <p className="mt-4 text-sm leading-6 text-gray-700">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-[#e8e3da] sm:aspect-[4/3] lg:aspect-[4/5]">
            <Image
              src="https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=85"
              alt="Maison contemporaine accompagnée par IMMO DREAMS"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-[#111111]/88 p-6 text-white backdrop-blur-sm">
              <p className="text-xs font-bold uppercase text-orange-400">
                Votre interlocuteur
              </p>
              <p className="mt-2 text-xl font-black">
                {agencyContact.representative}
              </p>
              <p className="mt-2 text-sm text-white/65">
                Conseil immobilier à Solliès-Pont
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#fbf9f4] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[80rem]">
          <p className="text-xs font-bold uppercase text-orange-600">Nos valeurs</p>
          <h2 className="mt-4 max-w-[40rem] text-3xl font-black leading-tight text-[#111111] sm:text-5xl">
            Un cadre de travail simple et fiable
          </h2>

          <div className="mt-10 grid gap-px overflow-hidden rounded-lg bg-orange-100 md:grid-cols-2 xl:grid-cols-4">
            {values.map((value, index) => (
              <article
                key={value.title}
                className={index === 0 ? "bg-[#111111] p-7 text-white" : "bg-white p-7"}
              >
                <span
                  className={
                    index === 0
                      ? "flex size-9 items-center justify-center rounded-full bg-orange-500 text-white"
                      : "flex size-9 items-center justify-center rounded-full bg-orange-50 text-orange-600"
                  }
                >
                  <Check className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-8 text-2xl font-black">{value.title}</h3>
                <p
                  className={
                    index === 0
                      ? "mt-4 text-sm leading-6 text-white/68"
                      : "mt-4 text-sm leading-6 text-gray-600"
                  }
                >
                  {value.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[80rem]">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold uppercase text-orange-600">
                Notre méthode
              </p>
              <h2 className="mt-4 max-w-[28rem] text-3xl font-black leading-tight text-[#111111] sm:text-5xl">
                Une vente pilotée en six étapes
              </h2>
              <p className="mt-5 max-w-[29rem] text-base leading-7 text-gray-600">
                Chaque étape donne un repère clair au vendeur et permet de faire
                avancer la commercialisation sans improvisation.
              </p>
            </div>

            <ol className="grid gap-px overflow-hidden rounded-lg bg-orange-100 sm:grid-cols-2">
              {process.map((step, index) => (
                <li key={step.title} className="bg-[#fbf9f4] p-6">
                  <span className="text-sm font-black text-orange-600">
                    0{index + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-black text-[#111111]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-gray-600">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <RivieraCtaBand
        eyebrow="Un projet à cadrer"
        title="Besoin d'un avis fiable sur votre projet ?"
        description="L'agence vous aide à poser les bonnes priorités avant de vendre ou d'acheter."
        href="/contact"
        label="Échanger avec l'agence"
      />
    </>
  );
}

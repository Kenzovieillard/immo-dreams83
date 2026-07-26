import type { Metadata } from "next";
import Image from "next/image";
import { BadgeCheck, Clock, Handshake, MapPinned, Phone } from "lucide-react";
import { EstimationForm } from "@/components/forms/estimation-form";
import { RivieraCtaBand } from "@/components/site/riviera-cta-band";
import { agencyContact } from "@/components/site/site-config";

export const metadata: Metadata = {
  title: "Estimation immobilière dans le Var",
  description:
    "Demandez une estimation immobilière locale avec IMMO DREAMS pour votre maison, appartement, terrain ou immeuble dans le Var.",
};

const reassurance = [
  { label: "Estimation offerte", icon: BadgeCheck },
  { label: "Réponse personnalisée", icon: Clock },
  { label: "Expertise locale", icon: MapPinned },
  { label: "Conseil sans engagement", icon: Handshake },
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
      <section className="relative overflow-hidden bg-[#111111] text-white">
        <Image
          src="/images/riviera/interior-hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[#111111]/72" />

        <div className="relative mx-auto grid min-h-[47rem] max-w-[82rem] gap-10 px-5 pb-14 pt-28 sm:px-8 sm:pb-20 sm:pt-32 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase text-orange-400">
              Estimation immobilière
            </p>
            <h1 className="mt-4 max-w-[37rem] text-[2.55rem] font-black leading-[0.98] sm:text-6xl">
              Faites estimer votre bien dans le Var
            </h1>
            <p className="mt-6 max-w-[37rem] text-base leading-7 text-white/78 sm:text-lg sm:leading-8">
              Recevez un avis de valeur clair et local pour votre maison,
              appartement, terrain ou immeuble.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {reassurance.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 border-t border-white/20 py-3"
                >
                  <item.icon
                    className="size-5 text-orange-400"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            id="formulaire"
            className="scroll-mt-24 rounded-lg bg-white p-5 text-[#111111] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.42)] sm:p-7"
          >
            <p className="text-xs font-bold uppercase text-orange-600">
              Parlez-nous de votre bien
            </p>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">
              Demande d’estimation
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Quelques informations suffisent pour commencer l’analyse.
            </p>
            <div className="mt-6">
              <EstimationForm embedded />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#fbf9f4] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[80rem]">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-xs font-bold uppercase text-orange-600">
                Notre méthode
              </p>
              <h2 className="mt-4 max-w-[27rem] text-3xl font-black leading-tight text-[#111111] sm:text-5xl">
                Une estimation en trois temps
              </h2>
              <p className="mt-5 max-w-[30rem] text-base leading-7 text-gray-600">
                Le but n’est pas seulement d’obtenir un chiffre, mais de
                comprendre comment positionner votre bien.
              </p>
            </div>

            <ol className="grid gap-px overflow-hidden rounded-lg bg-orange-100 md:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className={index === 0 ? "bg-[#111111] p-7 text-white" : "bg-white p-7"}
                >
                  <span className="text-sm font-black text-orange-500">
                    0{index + 1}
                  </span>
                  <h3 className="mt-7 text-xl font-black">{step.title}</h3>
                  <p
                    className={
                      index === 0
                        ? "mt-4 text-sm leading-6 text-white/68"
                        : "mt-4 text-sm leading-6 text-gray-600"
                    }
                  >
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-[80rem] gap-6 border-y border-orange-200 py-10 sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase text-orange-600">
              Territoire
            </p>
            <p className="mt-3 text-xl font-black text-[#111111]">
              Solliès-Pont et le Var
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-orange-600">
              Restitution
            </p>
            <p className="mt-3 text-xl font-black text-[#111111]">
              Un avis expliqué
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-orange-600">
              Échange direct
            </p>
            <a
              href={agencyContact.phoneHref}
              className="mt-3 inline-flex items-center gap-2 text-xl font-black text-[#111111] hover:text-orange-600"
            >
              <Phone className="size-5" aria-hidden="true" />
              {agencyContact.phone}
            </a>
          </div>
        </div>
      </section>

      <RivieraCtaBand
        eyebrow="Un doute sur le bon moment ?"
        title="Parlons de votre projet avant de fixer un prix"
        description="Un premier échange permet de clarifier votre calendrier, vos priorités et les informations à réunir."
        href={agencyContact.phoneHref}
        label="Appeler l'agence"
      />
    </>
  );
}

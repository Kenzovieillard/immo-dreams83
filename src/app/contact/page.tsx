import type { Metadata } from "next";
import {
  Clock,
  HeartHandshake,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { ContactForm } from "@/components/forms/contact-form";
import { GoogleMapEmbed } from "@/components/site/google-map-embed";
import { RivieraCtaBand } from "@/components/site/riviera-cta-band";
import { RivieraPageHero } from "@/components/site/riviera-page-hero";
import { agencyContact } from "@/components/site/site-config";

export const metadata: Metadata = {
  title: "Contact agence immobilière Solliès-Pont",
  description:
    "Contactez IMMO DREAMS pour un projet d'achat, de vente ou d'estimation immobilière dans le Var.",
};

const reassuranceItems = [
  {
    title: "Réponse rapide",
    description: "Un premier retour clair sous un jour ouvré.",
    icon: Timer,
  },
  {
    title: "Expertise locale",
    description: "Une connaissance concrète du marché immobilier varois.",
    icon: ShieldCheck,
  },
  {
    title: "Accompagnement humain",
    description: "Un interlocuteur du premier échange à la signature.",
    icon: HeartHandshake,
  },
];

export default function ContactPage() {
  return (
    <>
      <RivieraPageHero
        eyebrow="Contact"
        title="Parlons de votre projet immobilier"
        description="Une question, une visite ou une estimation : choisissez le moyen le plus simple."
        actions={[
          {
            href: agencyContact.phoneHref,
            label: "Appeler l'agence",
            phone: true,
          },
          {
            href: "#message",
            label: "Envoyer un message",
            variant: "secondary",
          },
        ]}
      />

      <section className="bg-[#fbf9f4] px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mx-auto grid max-w-[80rem] gap-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div
            id="message"
            className="-mt-10 scroll-mt-24 rounded-lg bg-white p-5 shadow-sm ring-1 ring-orange-100 sm:-mt-16 sm:p-8"
          >
            <p className="text-xs font-bold uppercase text-orange-600">
              Écrivez-nous
            </p>
            <h2 className="mt-3 text-3xl font-black text-[#111111]">
              Votre message
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              Nous vous répondons sous un jour ouvré.
            </p>
            <div className="mt-7">
              <ContactForm embedded />
            </div>
            <p className="mt-5 text-xs leading-5 text-gray-500">
              En envoyant ce formulaire, vous acceptez notre politique de
              confidentialité.
            </p>
          </div>

          <div className="-mt-10 grid gap-6 sm:-mt-16">
            <div className="rounded-lg bg-[#111111] p-7 text-white">
              <p className="text-xs font-bold uppercase text-orange-400">
                L’agence
              </p>
              <h2 className="mt-4 text-3xl font-black">
                IMMO DREAMS
                <br />
                Solliès-Pont
              </h2>

              <dl className="mt-8 grid gap-6 text-sm">
                <div>
                  <dt className="text-[0.65rem] font-bold uppercase text-orange-400">
                    Adresse
                  </dt>
                  <dd className="mt-2 flex gap-3 text-white/78">
                    <MapPin className="size-4 shrink-0" aria-hidden="true" />
                    {agencyContact.address}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] font-bold uppercase text-orange-400">
                    Téléphone
                  </dt>
                  <dd className="mt-2">
                    <a
                      className="inline-flex items-center gap-3 text-white/78 hover:text-white"
                      href={agencyContact.phoneHref}
                    >
                      <Phone className="size-4" aria-hidden="true" />
                      {agencyContact.phone}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] font-bold uppercase text-orange-400">
                    E-mail
                  </dt>
                  <dd className="mt-2">
                    <a
                      className="inline-flex items-start gap-3 break-all text-white/78 hover:text-white"
                      href={agencyContact.emailHref}
                    >
                      <Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {agencyContact.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] font-bold uppercase text-orange-400">
                    Horaires
                  </dt>
                  <dd className="mt-2 flex gap-3 text-white/78">
                    <Clock className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      {agencyContact.openingHours[0]}
                      <br />
                      {agencyContact.openingHours[1]}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <GoogleMapEmbed
              query={`IMMO DREAMS, ${agencyContact.address}`}
              title="Localisation de l'agence IMMO DREAMS"
              helperText="Agence située à Solliès-Pont, au cœur du Var."
            />
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[80rem]">
          <p className="text-xs font-bold uppercase text-orange-600">
            Pourquoi nous contacter
          </p>
          <h2 className="mt-4 text-3xl font-black text-[#111111] sm:text-4xl">
            Un échange simple et utile
          </h2>
          <div className="mt-9 grid gap-px overflow-hidden rounded-lg bg-orange-100 md:grid-cols-3">
            {reassuranceItems.map((item, index) => (
              <article
                key={item.title}
                className={index === 0 ? "bg-[#111111] p-7 text-white" : "bg-[#fbf9f4] p-7"}
              >
                <item.icon
                  className={index === 0 ? "size-8 text-orange-400" : "size-8 text-orange-600"}
                  aria-hidden="true"
                />
                <h3 className="mt-7 text-xl font-black">{item.title}</h3>
                <p
                  className={
                    index === 0
                      ? "mt-4 text-sm leading-6 text-white/68"
                      : "mt-4 text-sm leading-6 text-gray-600"
                  }
                >
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <RivieraCtaBand
        eyebrow="Rencontrons-nous"
        title="Vous préférez passer à l'agence ?"
        description="Prenez rendez-vous à Solliès-Pont pour échanger autour de votre projet."
        href={agencyContact.phoneHref}
        label="Prendre rendez-vous"
      />
    </>
  );
}

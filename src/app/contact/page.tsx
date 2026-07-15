import type { Metadata } from "next";
import { Clock, HeartHandshake, Mail, MapPin, Phone, ShieldCheck, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ContactForm } from "@/components/forms/contact-form";
import { GoogleMapEmbed } from "@/components/site/google-map-embed";
import { SectionTitle } from "@/components/site/section-title";
import { agencyContact } from "@/components/site/site-config";

export const metadata: Metadata = {
  title: "Contact agence immobilière Solliès-Pont",
  description:
    "Contactez IMMO-DREAMS83 pour un projet d'achat, de vente ou d'estimation immobilière dans le Var.",
};

const reassuranceItems = [
  {
    title: "Réponse rapide",
    description: "Un premier retour clair pour cadrer votre demande et les prochaines étapes.",
    icon: Timer,
  },
  {
    title: "Expertise locale",
    description: "Une lecture concrète du marché à Solliès-Pont et dans le Var.",
    icon: ShieldCheck,
  },
  {
    title: "Accompagnement humain",
    description: "Un échange simple, direct et adapté à votre rythme.",
    icon: HeartHandshake,
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="bg-[#111111] px-4 py-12 text-white sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Badge className="mb-5 border-0 bg-orange-500 text-white">
            Contact agence
          </Badge>
          <h1 className="max-w-[22rem] break-words text-[2rem] font-black leading-[1.08] tracking-tight sm:max-w-4xl sm:text-6xl">
            Contactez IMMO-DREAMS83
          </h1>
          <p className="mt-5 max-w-[22rem] text-base leading-7 text-white/76 sm:mt-6 sm:max-w-2xl sm:text-lg sm:leading-8">
            Un projet de vente, d&apos;achat ou d&apos;estimation dans le Var ? Parlons-en
            simplement.
          </p>
        </div>
      </section>

      <section className="bg-orange-50 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <ContactForm />

          <div className="grid gap-5">
            <Card className="border-orange-100 bg-white shadow-xl shadow-orange-100/60">
              <CardHeader>
                <CardTitle className="text-2xl font-black text-[#111111]">
                  IMMO-DREAMS83
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-gray-700">
                <p className="flex gap-3">
                  <MapPin className="size-5 shrink-0 text-orange-500" aria-hidden="true" />
                  {agencyContact.address}
                </p>
                <p className="flex gap-3">
                  <Phone className="size-5 shrink-0 text-orange-500" aria-hidden="true" />
                  <a className="font-semibold text-orange-700 hover:underline" href={agencyContact.phoneHref}>
                    {agencyContact.phone}
                  </a>
                </p>
                <p className="flex gap-3">
                  <Mail className="size-5 shrink-0 text-orange-500" aria-hidden="true" />
                  <a className="break-all font-semibold text-orange-700 hover:underline" href={agencyContact.emailHref}>
                    {agencyContact.email}
                  </a>
                </p>
                <Separator className="bg-orange-100" />
                <div className="grid gap-2">
                  <p className="flex gap-3">
                    <Clock className="size-5 shrink-0 text-orange-500" aria-hidden="true" />
                    {agencyContact.openingHours[0]}
                  </p>
                  <p className="pl-8">{agencyContact.openingHours[1]}</p>
                </div>
              </CardContent>
            </Card>

            <GoogleMapEmbed
              query="IMMO-DREAMS83, 4 chemin des Bancaous, 83210 Sollies-Pont, France"
              title="Localisation de l'agence IMMO-DREAMS83"
              helperText="Agence situee a Sollies-Pont, au coeur du Var."
            />

          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Votre demande"
            title="Un premier échange simple et rassurant"
            description="Nous privilégions une réponse claire, sans jargon, pour vous aider à avancer dans votre projet immobilier."
            align="center"
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {reassuranceItems.map((item) => (
              <Card key={item.title} className="border-orange-100 bg-white shadow-sm">
                <CardContent className="p-6">
                  <item.icon className="size-8 text-orange-600" aria-hidden="true" />
                  <h2 className="mt-5 text-xl font-black text-[#111111]">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-gray-600">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

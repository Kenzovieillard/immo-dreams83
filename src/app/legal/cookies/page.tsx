import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Politique de cookies",
  description: "Informations sur les cookies utilisés par le site IMMO-DREAMS83.",
  alternates: { canonical: "/legal/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Politique de cookies"
      intro="Les cookies permettent au site de fonctionner correctement et, avec votre accord, d'en mesurer l'audience."
      sections={[
        {
          title: "Cookies nécessaires",
          content: <p>Des cookies techniques tels que BETB, BETB_ID ou PHPSESSID peuvent être utilisés pour assurer la navigation, la sécurité et le fonctionnement des formulaires. Ils ne servent pas à établir un profil publicitaire.</p>,
        },
        {
          title: "Mesure d'audience",
          content: <p>Des outils de mesure d&apos;audience, notamment Google Analytics lorsqu&apos;il est activé, peuvent déposer des cookies après recueil du consentement requis. Ils servent à comprendre l&apos;usage du site et à améliorer les parcours.</p>,
        },
        {
          title: "Gestion de vos choix",
          content: <p>Vous pouvez supprimer ou bloquer les cookies depuis les réglages de votre navigateur. Le refus des cookies nécessaires peut toutefois dégrader certaines fonctions essentielles du site.</p>,
        },
        {
          title: "Durée et mise à jour",
          content: <p>La durée de conservation varie selon la fonction du cookie et reste limitée à la durée nécessaire. Cette politique pourra évoluer lors de l&apos;activation d&apos;un outil de consentement ou de nouveaux services.</p>,
        },
      ]}
    />
  );
}

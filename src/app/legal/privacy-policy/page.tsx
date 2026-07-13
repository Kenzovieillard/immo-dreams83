import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { agencyContact } from "@/components/site/site-config";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Traitement des données personnelles et droits RGPD des visiteurs d'IMMO-DREAMS83.",
  alternates: { canonical: "/legal/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="Cette page explique quelles données sont recueillies, pourquoi elles le sont et comment exercer vos droits."
      sections={[
        {
          title: "Responsable du traitement",
          content: <p>{agencyContact.name}, {agencyContact.address}. Contact : <a className="font-semibold text-orange-700 hover:underline" href={agencyContact.emailHref}>{agencyContact.email}</a>.</p>,
        },
        {
          title: "Données collectées",
          content: <p>Les formulaires peuvent recueillir votre identité, votre adresse email, votre téléphone, la localisation et les caractéristiques du bien ainsi que le contenu de votre demande.</p>,
        },
        {
          title: "Finalités et base légale",
          content: <p>Ces informations servent à répondre à une demande de contact, d&apos;achat, de vente ou d&apos;estimation et à assurer le suivi commercial associé. Le traitement repose sur votre demande et, lorsque nécessaire, sur votre consentement.</p>,
        },
        {
          title: "Conservation et destinataires",
          content: <p>Les données sont accessibles uniquement aux personnes habilitées et aux prestataires techniques nécessaires au fonctionnement du service. Elles sont conservées pendant la durée utile au suivi de la demande, puis archivées ou supprimées conformément aux obligations applicables.</p>,
        },
        {
          title: "Vos droits",
          content: (
            <>
              <p>Vous pouvez demander l&apos;accès, la rectification, l&apos;effacement, la limitation, l&apos;opposition ou la portabilité de vos données.</p>
              <p>Pour exercer ces droits, écrivez à <a className="font-semibold text-orange-700 hover:underline" href={agencyContact.emailHref}>{agencyContact.email}</a>. Une preuve d&apos;identité peut être demandée lorsque cela est nécessaire.</p>
              <p>Vous pouvez également saisir la CNIL et vous inscrire sur la liste d&apos;opposition au démarchage téléphonique <a className="font-semibold text-orange-700 hover:underline" href="https://www.bloctel.gouv.fr" rel="noreferrer" target="_blank">Bloctel</a>.</p>
            </>
          ),
        },
      ]}
    />
  );
}

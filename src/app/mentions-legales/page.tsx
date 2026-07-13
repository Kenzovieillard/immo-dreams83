import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { agencyContact } from "@/components/site/site-config";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales, éditeur et hébergeur du site IMMO-DREAMS83.",
  alternates: { canonical: "/mentions-legales" },
};

export default function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      intro="Informations relatives à l'éditeur, à la publication et à l'hébergement du site IMMO-DREAMS83."
      sections={[
        {
          title: "Éditeur du site",
          content: (
            <>
              <p><strong>{agencyContact.name}</strong>, représentée par {agencyContact.representative}.</p>
              <p>{agencyContact.address}</p>
              <p>SIRET : {agencyContact.siret}</p>
              <p>Téléphone : <a className="font-semibold text-orange-700 hover:underline" href={agencyContact.phoneHref}>{agencyContact.phone}</a></p>
              <p>Email : <a className="font-semibold text-orange-700 hover:underline" href={agencyContact.emailHref}>{agencyContact.email}</a></p>
            </>
          ),
        },
        {
          title: "Directeur de la publication",
          content: <p>{agencyContact.representative}, représentant d&apos;IMMO-DREAMS83.</p>,
        },
        {
          title: "Hébergement",
          content: (
            <>
              <p><strong>BEXTER</strong></p>
              <p>58 Chemin des Guérins, 83500 La Seyne-sur-Mer, France.</p>
              <p>Téléphone : +33 (0)4 94 25 81 50.</p>
              <p>Site : <a className="font-semibold text-orange-700 hover:underline" href="https://www.bexter.fr" rel="noreferrer" target="_blank">www.bexter.fr</a></p>
            </>
          ),
        },
        {
          title: "Responsabilité et contenus",
          content: <p>IMMO-DREAMS83 s&apos;efforce de publier des informations exactes et actualisées. Les annonces, prix et disponibilités restent soumis à confirmation auprès de l&apos;agence et ne constituent pas une offre contractuelle.</p>,
        },
        {
          title: "Propriété intellectuelle",
          content: <p>Les textes, visuels, marques et éléments du site sont protégés. Toute reproduction ou réutilisation non autorisée est interdite, sauf accord écrit préalable de leurs titulaires.</p>,
        },
      ]}
    />
  );
}

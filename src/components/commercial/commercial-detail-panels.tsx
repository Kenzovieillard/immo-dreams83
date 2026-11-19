"use client";

import Link from "next/link";
import { Download, FileText, Star } from "lucide-react";
import { CommercialPanel, commercialSecondaryButton } from "./commercial-ui";
import {
  DetailField,
  Person,
  PropertyPhoto,
  StatusBadge,
} from "./commercial-design-ui";
import {
  commercialLabel,
  money,
  shortDate,
} from "@/lib/commercial-presentation";
import type {
  CommercialEstimationDetail,
  CommercialOfferDetail,
  CommercialVisitDetail,
} from "@/types/commercial";

export function EstimationDetailPanels({
  detail,
  onDownload,
  onGenerate,
}: {
  detail: CommercialEstimationDetail;
  onDownload: () => void;
  onGenerate: () => void;
}) {
  const range =
    detail.estimateLow != null &&
    detail.estimateHigh != null &&
    detail.estimateHigh > detail.estimateLow;
  const position =
    range && detail.estimatedValue != null
      ? Math.max(
          0,
          Math.min(
            100,
            ((detail.estimatedValue - detail.estimateLow!) /
              (detail.estimateHigh! - detail.estimateLow!)) *
              100,
          ),
        )
      : null;
  return (
    <>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(260px,1fr)]">
        <div className="grid gap-6">
          <CommercialPanel className="p-6">
            <h2 className="font-semibold">Informations du bien</h2>
            <dl className="mt-5 grid gap-6 sm:grid-cols-3">
              <DetailField label="Type">{detail.propertyType}</DetailField>
              <DetailField label="Surface habitable">
                {detail.surface} m²
              </DetailField>
              <DetailField label="Pièces">
                {detail.rooms ?? "Non renseigné"}
              </DetailField>
              <DetailField label="Année de construction">
                {detail.constructionYear ?? "Non renseignée"}
              </DetailField>
              <DetailField label="État général">
                {detail.propertyCondition ?? "Non renseigné"}
              </DetailField>
              <DetailField label="Statut">
                <StatusBadge status={detail.status} />
              </DetailField>
            </dl>
          </CommercialPanel>
          <CommercialPanel className="p-6">
            <h2 className="font-semibold">Fourchette de prix estimée</h2>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#66716c]">
              <span>Bas de marché</span>
              <strong className="text-base text-[#2f493a]">
                Conseillé : {money(detail.estimatedValue)}
              </strong>
              <span>Haut de marché</span>
            </div>
            <div className="relative my-4 h-3 rounded-full bg-[#f0eee8]">
              {position != null && (
                <div
                  className="h-full rounded-full bg-[#c7d8c2]"
                  style={{ width: `${position}%` }}
                />
              )}
            </div>
            <div className="flex justify-between gap-3 text-sm font-semibold">
              <span>{money(detail.estimateLow)}</span>
              <span>{money(detail.estimateHigh)}</span>
            </div>
          </CommercialPanel>
        </div>
        <aside className="grid gap-6">
          <CommercialPanel className="p-6">
            <h2 className="font-semibold">Rapport PDF</h2>
            <div className="my-4 flex items-center gap-3 rounded-xl bg-[#f6f4ef] p-4">
              <FileText className="size-6 shrink-0 text-[#2f493a]" />
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">
                  {detail.reference ?? "Rapport d’estimation"}
                </p>
                <p className="mt-1 text-xs text-[#66716c]">
                  {detail.reportAvailable
                    ? "Rapport disponible"
                    : "Aucun rapport généré"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={detail.reportAvailable ? onDownload : onGenerate}
              className={`${commercialSecondaryButton} w-full`}
            >
              <Download className="size-4" />
              {detail.reportAvailable
                ? "Télécharger le rapport"
                : "Générer le rapport"}
            </button>
          </CommercialPanel>
          <CommercialPanel className="p-6">
            <h2 className="mb-4 font-semibold">Propriétaire et rendez-vous</h2>
            <Person name={detail.contactName} label="Propriétaire" />
            <p className="mt-3 break-all text-xs text-[#66716c]">
              {detail.contactEmail}
            </p>
            <p className="mt-1 text-xs text-[#66716c]">{detail.contactPhone}</p>
            <p className="mt-4 text-sm font-semibold">
              {shortDate(detail.appointmentAt, true)}
            </p>
            <p className="mt-1 text-xs text-[#66716c]">
              {detail.assignedToName ?? "Conseiller non attribué"}
            </p>
            {detail.contactId && (
              <Link
                href={`/admin?tab=contacts&contact=${detail.contactId}`}
                className="mt-4 inline-block text-xs text-[#2f493a] underline"
              >
                Ouvrir le contact
              </Link>
            )}
          </CommercialPanel>
        </aside>
      </div>
      <CommercialPanel className="p-6">
        <h2 className="font-semibold">Comparables de marché</h2>
        {detail.marketComparables.length ? (
          <div className="mt-5 overflow-x-auto rounded-lg border border-[#dfddd4]">
            <table className="w-full min-w-[540px] text-left text-xs">
              <thead className="bg-[#f6f4ef]">
                <tr>
                  {[
                    "Bien comparable",
                    "Surface",
                    "Prix vendu",
                    "Date de vente",
                  ].map((label) => (
                    <th key={label} className="p-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.marketComparables.map((row, index) => (
                  <tr key={index} className="border-t border-[#dfddd4]">
                    <td className="p-3">{row.label}</td>
                    <td className="p-3">
                      {row.surface == null ? "—" : `${row.surface} m²`}
                    </td>
                    <td className="p-3">{money(row.price)}</td>
                    <td className="p-3">{row.soldAt ?? "Non renseignée"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#66716c]">
            Aucun comparable de marché renseigné pour cette estimation.
          </p>
        )}
      </CommercialPanel>
      {detail.notes && (
        <CommercialPanel className="p-6">
          <h2 className="font-semibold">Notes internes</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-[#66716c]">
            {detail.notes}
          </p>
        </CommercialPanel>
      )}
      <details className="rounded-xl border border-[#dfddd4] bg-[#fbfaf7] p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Historique de l’estimation
        </summary>
        <ol className="mt-4 grid gap-4">
          {detail.history.map((row) => (
            <li
              key={row.id}
              className="border-l-2 border-[#c7d8c2] pl-4 text-sm"
            >
              <p className="font-medium">{row.action}</p>
              <p className="mt-1 text-xs text-[#66716c]">
                {shortDate(row.createdAt, true)} · {row.actorName}
              </p>
            </li>
          ))}
          {!detail.history.length && (
            <li className="text-sm text-[#66716c]">
              Aucun événement enregistré.
            </li>
          )}
        </ol>
      </details>
    </>
  );
}

export function VisitDetailPanels({
  detail,
  propertyPrice,
}: {
  detail: CommercialVisitDetail;
  propertyPrice?: number;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(260px,1fr)]">
      <div className="grid gap-6">
        <CommercialPanel className="p-6">
          <h2 className="font-semibold">Informations de la visite</h2>
          <dl className="mt-5 grid gap-6 sm:grid-cols-3">
            <DetailField label="Acquéreur potentiel">
              {detail.contactName}
            </DetailField>
            <DetailField label="Conseiller présent">
              {detail.assignedToName}
            </DetailField>
            <DetailField label="Prix du bien">
              {money(propertyPrice)}
            </DetailField>
            <DetailField label="Date">
              {shortDate(detail.startsAt, true)}
            </DetailField>
            <DetailField label="Lieu">{detail.location}</DetailField>
            <DetailField label="Statut">
              <StatusBadge status={detail.visitStatus} />
            </DetailField>
          </dl>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-[#2f493a]">
            {detail.propertyId && (
              <Link
                className="underline"
                href={`/admin?tab=properties&property=${detail.propertyId}`}
              >
                Ouvrir le bien
              </Link>
            )}
            {detail.contactId && (
              <Link
                className="underline"
                href={`/admin?tab=contacts&contact=${detail.contactId}`}
              >
                Ouvrir l’acquéreur
              </Link>
            )}
          </div>
        </CommercialPanel>
        <CommercialPanel className="p-6">
          <h2 id="compte-rendu" className="scroll-mt-24 font-semibold">
            Retour de l’acquéreur post-visite
          </h2>
          {detail.reportSubmittedAt ? (
            <div className="mt-5 grid gap-5 text-sm">
              <div>
                <h3 className="font-semibold">Impression générale</h3>
                <p className="mt-2 text-[#66716c]">
                  {detail.generalImpression
                    ? detail.generalImpression === "MIXED"
                      ? "Mitigée"
                      : commercialLabel(detail.generalImpression)
                    : "Non renseignée"}
                </p>
              </div>
              {[
                ["Points positifs", detail.positivePoints],
                ["Points bloquants ou négociations", detail.blockingPoints],
              ].map(([title, points]) => (
                <div key={title as string}>
                  <h3 className="font-semibold">{title}</h3>
                  <ul className="mt-2 grid gap-1 text-[#66716c]">
                    {(points as string[]).map((point, i) => (
                      <li key={i}>— {point}</li>
                    ))}
                    {!(points as string[]).length && (
                      <li>Aucun point renseigné.</li>
                    )}
                  </ul>
                </div>
              ))}
              {detail.additionalComments && (
                <p className="whitespace-pre-wrap text-[#66716c]">
                  {detail.additionalComments}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#66716c]">
              Le compte rendu n’a pas encore été enregistré.
            </p>
          )}
        </CommercialPanel>
        {detail.comment && (
          <CommercialPanel className="p-6">
            <h2 className="font-semibold">Notes de préparation</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[#66716c]">
              {detail.comment}
            </p>
          </CommercialPanel>
        )}
      </div>
      <aside className="grid gap-6">
        <CommercialPanel className="p-6">
          <h2 className="font-semibold">Intérêt de l’acquéreur</h2>
          {detail.interestLevel != null ? (
            <div
              aria-label={`${detail.interestLevel} sur 5`}
              className="my-5 flex gap-2"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <Star
                  key={value}
                  className={`size-6 ${value <= detail.interestLevel! ? "fill-[#f7edd7] text-[#cb8f22]" : "text-[#dfddd4]"}`}
                />
              ))}
            </div>
          ) : (
            <p className="my-5 text-sm text-[#66716c]">Pas encore évalué</p>
          )}
          <p className="rounded-xl bg-[#dce5d7] p-4 text-xs font-semibold text-[#2f493a]">
            Prochaine étape :{" "}
            {detail.reportNextAction
              ? commercialLabel(detail.reportNextAction)
              : "À définir après la visite"}
          </p>
        </CommercialPanel>
        <CommercialPanel className="p-6">
          <h2 className="font-semibold">Historique</h2>
          <ol className="mt-4 grid gap-4">
            {detail.history.map((row) => (
              <li
                key={row.id}
                className="border-l-2 border-[#c7d8c2] pl-3 text-xs"
              >
                <p className="font-semibold">{row.action}</p>
                <p className="mt-1 text-[#66716c]">
                  {shortDate(row.createdAt, true)}
                </p>
              </li>
            ))}
            {!detail.history.length && (
              <li className="text-xs text-[#66716c]">
                Aucun événement enregistré.
              </li>
            )}
          </ol>
        </CommercialPanel>
      </aside>
    </div>
  );
}

export function OfferSummaryPanels({
  detail,
}: {
  detail: CommercialOfferDetail;
}) {
  return (
    <div className="grid gap-6">
      <CommercialPanel className="p-6">
        <h2 className="font-semibold">Résumé de l’offre</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <DetailField label="Bien concerné">
            <Link
              className="hover:underline"
              href={`/admin?tab=properties&property=${detail.propertyId}`}
            >
              {detail.propertyTitle}
            </Link>
          </DetailField>
          <DetailField label="Acquéreur">
            <Link href={`/admin?tab=contacts&contact=${detail.buyerContactId}`}>
              <Person name={detail.buyerName} />
            </Link>
          </DetailField>
          <DetailField label="Date de l’offre">
            {shortDate(detail.offerDate)}
          </DetailField>
          <DetailField label="Validité de l’offre">
            {shortDate(detail.validUntil)}
          </DetailField>
        </dl>
        <div className="mt-5 flex gap-4 text-xs text-[#2f493a]">
          <Link
            className="underline"
            href={`/commercial/pipeline?dossier=${detail.buyerDossierId}`}
          >
            Voir le dossier acquéreur
          </Link>
          {detail.visitId && (
            <Link
              className="underline"
              href={`/commercial/visites/${detail.visitId}`}
            >
              Voir la visite
            </Link>
          )}
        </div>
      </CommercialPanel>
      <CommercialPanel className="p-6">
        <h2 className="font-semibold">Détails du financement</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <DetailField label="Type de financement">
            {commercialLabel(detail.financingType)}
          </DetailField>
          <DetailField label="Apport personnel">
            {money(detail.downPaymentAmount)}
          </DetailField>
          <DetailField label="Montant du prêt">
            {money(detail.loanAmount)}
          </DetailField>
          <DetailField label="Conseiller responsable">
            {detail.responsibleUserName}
          </DetailField>
        </dl>
      </CommercialPanel>
      <CommercialPanel className="p-6">
        <h2 className="font-semibold">
          Conditions particulières et suspensives
        </h2>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#66716c]">
          {detail.suspensiveConditions ?? "Aucune condition renseignée."}
        </p>
        {detail.includedFurniture && (
          <p className="mt-4 text-sm">
            Mobilier inclus : {detail.includedFurniture}
          </p>
        )}
      </CommercialPanel>
      <CommercialPanel className="p-6">
        <h2 className="font-semibold">Photos & médias du bien</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {detail.propertyPhotos.slice(0, 6).map((src, i) => (
            <PropertyPhoto
              key={src}
              src={src}
              title={`${detail.propertyTitle} · photo ${i + 1}`}
              className="aspect-[1.5] h-auto w-full"
            />
          ))}
        </div>
        {!detail.propertyPhotos.length && (
          <p className="mt-4 text-sm text-[#66716c]">
            Aucune photo disponible pour ce bien.
          </p>
        )}
        <Link
          href={`/admin?tab=properties&property=${detail.propertyId}`}
          className="mt-4 inline-flex rounded-lg border border-dashed border-[#dfddd4] px-4 py-3 text-xs text-[#2f493a]"
        >
          Gérer les photos dans la fiche du bien
        </Link>
      </CommercialPanel>
    </div>
  );
}

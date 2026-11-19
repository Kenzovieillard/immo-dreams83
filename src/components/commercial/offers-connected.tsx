"use client";
import { useCommercialResourceSync } from "./use-commercial-resource-sync";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Download,
  FilePlus2,
  Handshake,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { z } from "zod";
import { BentoEmptyState } from "@/components/admin/bento/bento-states";
import {
  CommercialFeedback,
  CommercialPageHeader,
  CommercialPanel,
  DataSourceNotice,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import { OfferSummaryPanels } from "./commercial-detail-panels";
import { DetailField, Person, StatusBadge } from "./commercial-design-ui";
import {
  commercialLabel,
  money,
  priceGap,
} from "@/lib/commercial-presentation";
import type { CommercialOfferPayload } from "@/types/commercial";

type Feedback = {
  type: "loading" | "success" | "error";
  message: string;
} | null;
const formSchema = z
  .object({
    propertyId: z.string().uuid(),
    buyerDossierId: z.string().uuid(),
    buyerContactId: z.string().uuid(),
    visitId: z.string().uuid().or(z.literal("")).optional(),
    responsibleUserId: z.string().uuid(),
    amount: z.coerce.number().positive(),
    offerDate: z.string().min(1),
    validUntil: z.string().min(1),
    financingType: z.enum(["CASH", "LOAN", "MIXED", "UNKNOWN"]),
    downPaymentAmount: z
      .union([z.literal(""), z.coerce.number().nonnegative()])
      .optional(),
    loanAmount: z
      .union([z.literal(""), z.coerce.number().nonnegative()])
      .optional(),
    suspensiveConditions: z.string().optional(),
    includedFurniture: z.string().optional(),
    negotiationComment: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.validUntil < value.offerDate)
      ctx.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "La validité doit être postérieure à l'offre.",
      });
  });
type OfferFormInput = z.input<typeof formSchema>;
type OfferForm = z.output<typeof formSchema>;
async function jsonApi(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/commercial/offres", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    result?: { offer_id?: string; status?: string };
  } | null;
  if (!response.ok || !payload?.success)
    throw new Error(payload?.message ?? "Action impossible.");
  return payload;
}

export { OffersListConnected } from "./commercial-lists-connected";

export function OfferCreateConnected({
  data,
}: {
  data: CommercialOfferPayload;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const generatedAt = new Date(data.generatedAt);
  const today = generatedAt.toISOString().slice(0, 10);
  const week = new Date(generatedAt.getTime() + 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OfferFormInput, unknown, OfferForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyId: data.prefill.propertyId ?? "",
      buyerContactId: data.prefill.contactId ?? "",
      buyerDossierId: data.prefill.buyerDossierId ?? "",
      visitId: data.prefill.visitId ?? "",
      offerDate: today,
      validUntil: week,
      financingType: "UNKNOWN",
    },
  });
  const contactId = useWatch({ control, name: "buyerContactId" });
  const dossierId = useWatch({ control, name: "buyerDossierId" });
  const propertyId = useWatch({ control, name: "propertyId" });
  const amount = useWatch({ control, name: "amount" });
  const selectedProperty = data.options.properties.find(
    (row) => row.id === propertyId,
  );
  const selectedBuyer = data.options.contacts.find(
    (row) => row.id === contactId,
  );
  const gap =
    selectedProperty && Number(amount) > 0
      ? priceGap(Number(amount), selectedProperty.price)
      : null;
  const matchingCases = useMemo(
    () =>
      data.options.buyerCases.filter(
        (row) => !contactId || row.contactId === contactId,
      ),
    [contactId, data.options.buyerCases],
  );
  const selectedCase = data.options.buyerCases.find(
    (row) => row.id === dossierId,
  );
  useEffect(() => {
    if (selectedCase?.contactId && contactId !== selectedCase.contactId) {
      setValue("buyerContactId", selectedCase.contactId);
    }
  }, [contactId, selectedCase?.contactId, setValue]);
  async function submit(values: OfferForm, submission: "draft" | "create") {
    setFeedback({
      type: "loading",
      message:
        submission === "draft"
          ? "Sauvegarde du brouillon…"
          : "Création de l'offre…",
    });
    try {
      const result = await jsonApi({
        action: "create",
        submission,
        ...values,
        visitId: values.visitId || null,
        downPaymentAmount:
          values.downPaymentAmount === "" ? null : values.downPaymentAmount,
        loanAmount: values.loanAmount === "" ? null : values.loanAmount,
        suspensiveConditions: values.suspensiveConditions || null,
        includedFurniture: values.includedFurniture || null,
        negotiationComment: values.negotiationComment || null,
      });
      const id = result.result?.offer_id;
      if (!id) throw new Error("Identifiant d'offre manquant.");
      router.push(`/commercial/offres/${id}`);
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Création impossible.",
      });
    }
  }
  const draft = handleSubmit((values) => submit(values, "draft"));
  const create = handleSubmit((values) => submit(values, "create"));
  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        eyebrow="Commercial / Offres / Nouvelle offre"
        title="Créer une nouvelle offre d’achat"
        description="Formulaire de saisie pour soumettre une offre acquéreur."
        action={<DataSourceNotice demo={false} />}
      />
      <CommercialPanel className="p-5">
        <form onSubmit={create} className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            Bien
            <select
              {...register("propertyId")}
              defaultValue={data.prefill.propertyId ?? ""}
              className={fieldClass}
            >
              <option value="">Sélectionner…</option>
              {data.options.properties.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.reference} · {row.title} ·{" "}
                  {row.price.toLocaleString("fr-FR")} €
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Acquéreur
            <select
              {...register("buyerContactId")}
              defaultValue={data.prefill.contactId ?? ""}
              className={fieldClass}
            >
              <option value="">Sélectionner…</option>
              {data.options.contacts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.email}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Dossier acquéreur
            <select
              {...register("buyerDossierId")}
              defaultValue={data.prefill.buyerDossierId ?? ""}
              className={fieldClass}
            >
              <option value="">Sélectionner…</option>
              {matchingCases.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Conseiller
            <select {...register("responsibleUserId")} className={fieldClass}>
              <option value="">Sélectionner…</option>
              {data.options.profiles.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          {selectedProperty && (
            <div className="rounded-xl bg-[#dce5d7] p-4 text-xs">
              <p className="font-semibold">{selectedProperty.title}</p>
              <p className="mt-1 text-[#66716c]">
                {selectedProperty.city} · Prix demandé :{" "}
                {money(selectedProperty.price)}
              </p>
            </div>
          )}
          {selectedBuyer && (
            <div className="rounded-xl bg-[#dce5d7] p-4">
              <Person name={selectedBuyer.name} label="Acquéreur sélectionné" />
            </div>
          )}
          <input
            {...register("visitId")}
            type="hidden"
            defaultValue={data.prefill.visitId ?? ""}
          />
          <label className="grid gap-1 text-sm font-semibold">
            Montant
            <input
              {...register("amount")}
              type="number"
              min="1"
              className={fieldClass}
            />
          </label>
          <div className="grid content-start gap-2 text-sm font-semibold">
            <span>Écart par rapport au prix demandé</span>
            <output className="min-h-11 rounded-lg border border-[#dfddd4] p-3 text-sm text-[#b34d40]">
              {gap == null
                ? "Sélectionnez un bien et saisissez un montant"
                : gap.toFixed(1) +
                  " % (" +
                  money(Number(amount) - selectedProperty!.price) +
                  ")"}
            </output>
          </div>
          <h2 className="border-t border-[#dfddd4] pt-5 font-semibold sm:col-span-2">
            Détails du financement
          </h2>
          <label className="grid gap-1 text-sm font-semibold">
            Financement
            <select {...register("financingType")} className={fieldClass}>
              <option value="UNKNOWN">À préciser</option>
              <option value="CASH">Comptant</option>
              <option value="LOAN">Prêt</option>
              <option value="MIXED">Mixte</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Date de l&apos;offre
            <input
              {...register("offerDate")}
              type="date"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Valide jusqu&apos;au
            <input
              {...register("validUntil")}
              type="date"
              className={fieldClass}
            />
            {errors.validUntil ? (
              <span className="text-xs text-red-700">
                {errors.validUntil.message}
              </span>
            ) : null}
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Apport
            <input
              {...register("downPaymentAmount")}
              type="number"
              min="0"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Prêt
            <input
              {...register("loanAmount")}
              type="number"
              min="0"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Conditions suspensives
            <textarea
              {...register("suspensiveConditions")}
              className={`${fieldClass} min-h-24`}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Mobilier inclus
            <textarea
              {...register("includedFurniture")}
              className={`${fieldClass} min-h-20`}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Commentaire
            <textarea
              {...register("negotiationComment")}
              className={`${fieldClass} min-h-24`}
            />
          </label>
          {Object.keys(errors).length ? (
            <p className="text-sm text-red-700 sm:col-span-2">
              Certains champs obligatoires sont invalides.
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <Link
              href="/commercial/offres"
              className={commercialSecondaryButton}
            >
              Annuler
            </Link>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={draft}
              className={commercialSecondaryButton}
            >
              <Save className="size-4" />
              Sauvegarder le brouillon
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={create}
              className={commercialPrimaryButton}
            >
              <Send className="size-4" />
              Créer l&apos;offre
            </button>
          </div>
        </form>
      </CommercialPanel>
      <CommercialFeedback state={feedback} />
    </div>
  );
}

const nextStatuses: Record<string, string[]> = {
  DRAFT: ["TO_BE_SIGNED", "WITHDRAWN"],
  TO_BE_SIGNED: ["SIGNED_BY_BUYER", "WITHDRAWN"],
  SIGNED_BY_BUYER: ["SENT_TO_SELLER", "WITHDRAWN"],
  SENT_TO_SELLER: ["NEGOTIATING", "ACCEPTED", "REJECTED", "EXPIRED"],
  NEGOTIATING: ["ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
};
export function OfferDetailConnected({
  data: initialData,
}: {
  data: CommercialOfferPayload;
}) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [fileSelected, setFileSelected] = useState(false);
  const { data, refresh, status: syncStatus } = useCommercialResourceSync({
    initialData, endpoint: `/api/admin/commercial/offres?id=${initialData.detail!.id}`,
    paused: Boolean(status || reason || fileSelected) || feedback?.type === "loading",
  });
  const detail = data.detail!;
  const fileRef = useRef<HTMLInputElement>(null);
  async function updateStatus() {
    if (!status) return;
    setFeedback({ type: "loading", message: "Mise à jour du statut…" });
    try {
      await jsonApi({
        action: "set-status",
        id: detail.id,
        status,
        reason: reason || null,
      });
      setFeedback({ type: "success", message: "Statut mis à jour." });
      setStatus("");
      setReason("");
      await refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Mise à jour impossible.",
      });
    }
  }
  async function upload() {
    if (feedback?.type === "loading") return;
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setFeedback({ type: "loading", message: "Envoi sécurisé…" });
    try {
      const form = new FormData();
      form.set("offerId", detail.id);
      form.set("documentType", "OFFER_ATTACHMENT");
      form.set("file", file);
      const response = await fetch("/api/admin/commercial/offres", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
      };
      if (!response.ok || !payload.success)
        throw new Error(payload.message ?? "Upload impossible.");
      if (fileRef.current) fileRef.current.value = "";
      setFileSelected(false);
      setFeedback({ type: "success", message: "Document ajouté." });
      await refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Upload impossible.",
      });
    }
  }
  async function download(id: string) {
    setFeedback({ type: "loading", message: "Préparation du document…" });
    try {
      const response = await fetch(
        `/api/admin/commercial/offres?documentId=${id}`,
      );
      const payload = (await response.json()) as {
        success?: boolean;
        url?: string;
        message?: string;
      };
      if (!response.ok || !payload.url)
        throw new Error(payload.message ?? "Document indisponible.");
      window.location.assign(payload.url);
      setFeedback({ type: "success", message: "Téléchargement prêt." });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Téléchargement impossible.",
      });
    }
  }
  async function remove(id: string) {
    setFeedback({ type: "loading", message: "Suppression…" });
    try {
      const response = await fetch(
        `/api/admin/commercial/offres?documentId=${id}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
      };
      if (!response.ok || !payload.success)
        throw new Error(payload.message ?? "Suppression impossible.");
      setFeedback({ type: "success", message: "Document supprimé." });
      await refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Suppression impossible.",
      });
    }
  }
  return (
    <div className="grid min-w-0 gap-6">
      <CommercialPageHeader
        eyebrow="Commercial / Offres / Fiche offre"
        title="Détails de l’offre d’achat"
        description={detail.propertyTitle + " · " + detail.buyerName}
        action={
          <>
            <StatusBadge status={detail.status} />
            {detail.negotiationId && (
              <Link
                href={"/commercial/negociations/" + detail.negotiationId}
                className={commercialPrimaryButton}
              >
                <Handshake className="size-4" />
                Voir la négociation
              </Link>
            )}
          </>
        }
      />
      {syncStatus}
      <dl className="grid gap-5 rounded-xl bg-[#dce5d7] p-6 sm:grid-cols-3">
        <DetailField label="PRIX DEMANDÉ">
          <span className="text-2xl">{money(detail.propertyPrice)}</span>
        </DetailField>
        <DetailField label="MONTANT DE L’OFFRE">
          <span className="text-2xl text-[#2f493a]">
            {money(detail.amount)}
          </span>
        </DetailField>
        <DetailField label="ÉCART">
          <span className="text-xl text-[#b34d40]">
            {priceGap(detail.amount, detail.propertyPrice)?.toFixed(1) ?? "—"} %
          </span>
        </DetailField>
      </dl>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(280px,1fr)]">
        <OfferSummaryPanels detail={detail} />
        <aside className="grid min-w-0 gap-6">
          <CommercialPanel className="p-5">
            <div className="grid gap-4">
              <div>
                <h2 className="font-semibold">Documents associés</h2>
                <p className="text-sm text-[#69736e]">
                  PDF, JPG ou PNG · 10 Mo maximum · URL signée 5 minutes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  onChange={(event) => setFileSelected(Boolean(event.target.files?.length))}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  aria-label="Ajouter un document privé"
                  className="w-full min-w-0 text-xs"
                />
                <button
                  disabled={feedback?.type === "loading"}
                  onClick={upload}
                  className={commercialPrimaryButton}
                >
                  <Upload className="size-4" />
                  Ajouter
                </button>
              </div>
            </div>
            {detail.documents.length ? (
              <div className="mt-4 grid gap-2">
                {detail.documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center gap-3 rounded-lg border bg-white p-3"
                  >
                    <FilePlus2 className="size-5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {document.fileName}
                      </p>
                      <p className="text-xs text-[#69736e]">
                        {document.documentType} ·{" "}
                        {new Date(document.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <button
                      title="Télécharger"
                      onClick={() => download(document.id)}
                    >
                      <Download className="size-4" />
                    </button>
                    <button
                      title="Supprimer"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Supprimer définitivement ce document du dossier ?",
                          )
                        )
                          void remove(document.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <BentoEmptyState
                className="mt-4"
                title="Aucun document"
                description="Ajoutez uniquement des pièces utiles au dossier."
              />
            )}
          </CommercialPanel>
          <CommercialPanel className="p-5">
            <h2 className="font-bold">Changer le statut</h2>
            {(nextStatuses[detail.status] ?? []).length ? (
              <div className="mt-3 grid gap-3">
                <select
                  aria-label="Nouveau statut de l’offre"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Sélectionner…</option>
                  {nextStatuses[detail.status].map((value) => (
                    <option key={value} value={value}>
                      {commercialLabel(value)}
                    </option>
                  ))}
                </select>
                {["REJECTED", "WITHDRAWN"].includes(status) ? (
                  <textarea
                    aria-label="Raison du changement de statut"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={fieldClass}
                    placeholder="Raison obligatoire"
                  />
                ) : null}
                <button
                  disabled={!status || feedback?.type === "loading"}
                  onClick={updateStatus}
                  className={commercialPrimaryButton}
                >
                  <Send className="size-4" />
                  Appliquer
                </button>
                {(status || reason) && <button type="button" className={commercialSecondaryButton} onClick={() => { setStatus(""); setReason(""); }}>Annuler la saisie</button>}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#69736e]">
                Aucune transition disponible.
              </p>
            )}
            <h3 className="mt-6 font-bold">Historique</h3>
            <div className="mt-3 grid gap-2">
              {detail.history.map((row) => (
                <div key={row.id} className="border-l-2 border-[#2f493a] pl-3">
                  <p className="text-sm font-semibold">
                    {row.previousStatus
                      ? commercialLabel(row.previousStatus)
                      : "Création"}{" "}
                    → {commercialLabel(row.nextStatus)}
                  </p>
                  <p className="text-xs text-[#69736e]">
                    {new Date(row.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
              ))}
            </div>
          </CommercialPanel>
        </aside>
      </div>
      <DataSourceNotice demo={false} />
      <CommercialFeedback state={feedback} />
    </div>
  );
}

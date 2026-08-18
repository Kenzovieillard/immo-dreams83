"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Download,
  FilePlus2,
  Handshake,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { z } from "zod";
import { BentoEmptyState } from "@/components/admin/bento/bento-states";
import {
  CommercialBadge,
  CommercialFeedback,
  CommercialPageHeader,
  CommercialPanel,
  DataSourceNotice,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
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

export function OffersListConnected({
  data,
}: {
  data: CommercialOfferPayload;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const rows = data.items.filter(
    (row) =>
      (status === "ALL" || row.status === status) &&
      [
        row.propertyTitle,
        row.propertyReference,
        row.buyerName,
        row.buyerEmail,
      ].some((value) => value.toLowerCase().includes(query.toLowerCase())),
  );
  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        eyebrow="CRM Commercial"
        title="Offres"
        description={`${data.meta.count} offres réelles, hors données de recette.`}
        action={
          <>
            <DataSourceNotice demo={false} />
            <Link
              href="/commercial/offres/nouvelle"
              className={commercialPrimaryButton}
            >
              <Plus className="size-4" />
              Nouvelle offre
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Total", data.stats.total],
          ["Brouillons", data.stats.draft],
          ["Actives", data.stats.active],
          ["Négociation", data.stats.negotiating],
          ["Acceptées", data.stats.accepted],
        ].map(([label, value]) => (
          <CommercialPanel key={String(label)} className="p-4">
            <p className="text-xs text-[#69736e]">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </CommercialPanel>
        ))}
      </div>
      <CommercialPanel className="grid gap-3 p-4 sm:grid-cols-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={fieldClass}
          placeholder="Bien, acquéreur, référence…"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={fieldClass}
        >
          <option value="ALL">Tous les statuts</option>
          {[
            "DRAFT",
            "TO_BE_SIGNED",
            "SIGNED_BY_BUYER",
            "SENT_TO_SELLER",
            "NEGOTIATING",
            "ACCEPTED",
            "REJECTED",
            "WITHDRAWN",
            "EXPIRED",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </CommercialPanel>
      {rows.length === 0 ? (
        <BentoEmptyState
          title="Aucune offre"
          description="Créez une offre avec un bien et un dossier acquéreur existants."
        />
      ) : (
        <CommercialPanel className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#f1efe9]">
              <tr>
                <th className="p-4">Bien</th>
                <th className="p-4">Acquéreur</th>
                <th className="p-4">Montant</th>
                <th className="p-4">Statut</th>
                <th className="p-4">Date</th>
                <th className="p-4">Conseiller</th>
                <th className="p-4">Relations</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-[#f8f7f3]">
                  <td className="p-4">
                    <Link
                      href={`/commercial/offres/${row.id}`}
                      className="font-bold text-[#2f493a] hover:underline"
                    >
                      {row.propertyReference} · {row.propertyTitle}
                    </Link>
                    <p className="text-xs text-[#69736e]">{row.propertyCity}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold">{row.buyerName}</p>
                    <p className="text-xs text-[#69736e]">{row.buyerEmail}</p>
                  </td>
                  <td className="p-4 font-bold">
                    {row.amount.toLocaleString("fr-FR")} €
                  </td>
                  <td className="p-4">
                    <CommercialBadge
                      tone={
                        row.status === "ACCEPTED"
                          ? "success"
                          : row.status === "REJECTED"
                            ? "danger"
                            : row.status === "DRAFT"
                              ? "neutral"
                              : "info"
                      }
                    >
                      {row.status}
                    </CommercialBadge>
                  </td>
                  <td className="p-4">
                    {row.offerDate
                      ? new Date(
                          `${row.offerDate}T12:00:00`,
                        ).toLocaleDateString("fr-FR")
                      : "—"}
                  </td>
                  <td className="p-4">{row.responsibleUserName}</td>
                  <td className="p-4 text-xs">
                    {row.documentCount} document(s)
                    {row.negotiationId ? (
                      <>
                        <br />
                        <Link
                          className="underline"
                          href={`/commercial/negociations/${row.negotiationId}`}
                        >
                          Négociation
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CommercialPanel>
      )}
    </div>
  );
}

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
        title="Nouvelle offre"
        description="Les sélections et préremplissages sont validés contre Supabase."
        action={<DataSourceNotice demo={false} />}
      />
      <CommercialPanel className="p-5">
        <form className="grid gap-4 sm:grid-cols-2">
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
  data,
}: {
  data: CommercialOfferPayload;
}) {
  const router = useRouter();
  const detail = data.detail!;
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
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
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Mise à jour impossible.",
      });
    }
  }
  async function upload() {
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
      setFeedback({ type: "success", message: "Document ajouté." });
      router.refresh();
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
      router.refresh();
      setFeedback({ type: "success", message: "Document supprimé." });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Suppression impossible.",
      });
    }
  }
  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        title={`Offre · ${detail.propertyReference}`}
        description={`${detail.buyerName} · ${detail.amount.toLocaleString("fr-FR")} €`}
        action={
          <>
            <DataSourceNotice demo={false} />
            <CommercialBadge
              tone={
                detail.status === "ACCEPTED"
                  ? "success"
                  : detail.status === "REJECTED"
                    ? "danger"
                    : "info"
              }
            >
              {detail.status}
            </CommercialBadge>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <CommercialPanel className="p-5 lg:col-span-2">
          <h2 className="text-lg font-bold">Données et relations</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[#69736e]">Bien</dt>
              <dd className="font-semibold">
                {detail.propertyReference} · {detail.propertyTitle}
              </dd>
              <Link
                href={`/admin?tab=properties&property=${detail.propertyId}`}
                className="text-sm underline"
              >
                Ouvrir le bien
              </Link>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Acquéreur</dt>
              <dd className="font-semibold">{detail.buyerName}</dd>
              <dd>
                {detail.buyerEmail}
                <br />
                {detail.buyerPhone}
              </dd>
              <Link
                href={`/admin?tab=contacts&contact=${detail.buyerContactId}`}
                className="text-sm underline"
              >
                Ouvrir le contact
              </Link>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Dossier</dt>
              <dd>{detail.buyerDossierId}</dd>
              <Link
                href={`/commercial/pipeline?dossier=${detail.buyerDossierId}`}
                className="text-sm underline"
              >
                Voir le dossier
              </Link>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Conseiller</dt>
              <dd>{detail.responsibleUserName}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Dates</dt>
              <dd>
                {detail.offerDate ?? "—"} → {detail.validUntil ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Financement</dt>
              <dd>{detail.financingType}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {detail.visitId ? (
              <Link
                href={`/commercial/visites/${detail.visitId}`}
                className={commercialSecondaryButton}
              >
                Ouvrir la visite
              </Link>
            ) : null}
            {detail.negotiationId ? (
              <Link
                href={`/commercial/negociations/${detail.negotiationId}`}
                className={commercialPrimaryButton}
              >
                <Handshake className="size-4" />
                Ouvrir la négociation
              </Link>
            ) : detail.status === "NEGOTIATING" ? (
              <span className="text-sm text-[#69736e]">
                La négociation est créée automatiquement par PostgreSQL.
              </span>
            ) : null}
          </div>
        </CommercialPanel>
        <CommercialPanel className="p-5">
          <h2 className="font-bold">Changer le statut</h2>
          {(nextStatuses[detail.status] ?? []).length ? (
            <div className="mt-3 grid gap-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={fieldClass}
              >
                <option value="">Sélectionner…</option>
                {nextStatuses[detail.status].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              {["REJECTED", "WITHDRAWN"].includes(status) ? (
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={fieldClass}
                  placeholder="Raison obligatoire"
                />
              ) : null}
              <button
                onClick={updateStatus}
                className={commercialPrimaryButton}
              >
                <Send className="size-4" />
                Appliquer
              </button>
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
                  {row.previousStatus ?? "Création"} → {row.nextStatus}
                </p>
                <p className="text-xs text-[#69736e]">
                  {new Date(row.createdAt).toLocaleString("fr-FR")}
                </p>
              </div>
            ))}
          </div>
        </CommercialPanel>
      </div>
      <CommercialPanel className="p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold">Documents privés</h2>
            <p className="text-sm text-[#69736e]">
              PDF, JPG ou PNG · 10 Mo maximum · URL signée 5 minutes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="max-w-[240px] text-sm"
            />
            <button onClick={upload} className={commercialPrimaryButton}>
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
                  <p className="truncate font-semibold">{document.fileName}</p>
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
                <button title="Supprimer" onClick={() => remove(document.id)}>
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
      <CommercialFeedback state={feedback} />
    </div>
  );
}

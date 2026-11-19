"use client";
import { useCommercialResourceSync } from "./use-commercial-resource-sync";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, FileText, Home, Pencil, Save } from "lucide-react";
import { z } from "zod";
import {
  CommercialFeedback,
  CommercialPageHeader,
  CommercialPanel,
  DataSourceNotice,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import { CommercialDialog, FormSection } from "./commercial-design-ui";
import { EstimationDetailPanels } from "./commercial-detail-panels";
import { commercialLabel } from "@/lib/commercial-presentation";
import type { CommercialEstimationPayload } from "@/types/commercial";

type Feedback = {
  type: "loading" | "success" | "error";
  message: string;
} | null;
const estimationFormSchema = z.object({
  contactId: z.string().uuid(),
  assignedTo: z.string().uuid(),
  propertyAddress: z.string().min(3),
  city: z.string().min(2),
  postalCode: z.string().regex(/^\d{5}$/),
  propertyType: z.string().min(2),
  surface: z.coerce.number().positive(),
  rooms: z
    .union([z.literal(""), z.coerce.number().int().positive()])
    .optional(),
  constructionYear: z
    .union([z.literal(""), z.coerce.number().int().min(1500)])
    .optional(),
  propertyCondition: z.string().optional(),
  appointmentAt: z.string().min(1),
  durationMinutes: z.coerce.number().int().min(15),
  appointmentLocation: z.string().optional(),
  notes: z.string().optional(),
});
type EstimationFormInput = z.input<typeof estimationFormSchema>;
type EstimationFormValues = z.output<typeof estimationFormSchema>;

async function api(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/commercial/estimations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    id?: string;
    result?: { property_id?: string; property_slug?: string };
  } | null;
  if (!response.ok || !payload?.success)
    throw new Error(payload?.message ?? "Action impossible.");
  return payload;
}

export { EstimationsListConnected } from "./commercial-lists-connected";

export function EstimationCreateConnected({
  data,
}: {
  data: CommercialEstimationPayload;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EstimationFormInput, unknown, EstimationFormValues>({
    resolver: zodResolver(estimationFormSchema),
    defaultValues: { durationMinutes: 60 },
  });
  const submit = handleSubmit(async (values) => {
    setFeedback({ type: "loading", message: "Création…" });
    try {
      const result = await api({
        action: "create",
        ...values,
        rooms: values.rooms === "" ? null : values.rooms,
        constructionYear:
          values.constructionYear === "" ? null : values.constructionYear,
        appointmentAt: new Date(values.appointmentAt).toISOString(),
        propertyCondition: values.propertyCondition || null,
        appointmentLocation: values.appointmentLocation || null,
        notes: values.notes || null,
      });
      setFeedback({ type: "success", message: "Estimation créée." });
      router.push(`/commercial/estimations/${result.id}`);
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Création impossible.",
      });
    }
  });
  return (
    <div className="grid gap-7">
      <CommercialPageHeader
        eyebrow="Estimations / Création"
        title="Nouvelle demande d’estimation"
        description="Renseignez le propriétaire, le bien et le rendez-vous."
      />
      <form
        onSubmit={submit}
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(260px,1fr)]"
      >
        <div className="grid gap-6">
          <FormSection title="Choix du propriétaire">
            <label className="grid gap-2 text-xs text-[#66716c] sm:col-span-2">
              Rechercher un contact existant
              <select {...register("contactId")} className={fieldClass}>
                <option value="">Sélectionner un propriétaire…</option>
                {data.options.contacts.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.email}
                  </option>
                ))}
              </select>
            </label>
          </FormSection>
          <FormSection title="Adresse et informations du bien">
            <label className="grid gap-2 text-xs text-[#66716c] sm:col-span-2">
              Adresse complète
              <input
                {...register("propertyAddress")}
                placeholder="N° et nom de voie"
                className={fieldClass}
              />
            </label>
            <label className="grid gap-2 text-xs text-[#66716c]">
              Ville
              <input {...register("city")} className={fieldClass} />
            </label>
            <label className="grid gap-2 text-xs text-[#66716c]">
              Code postal
              <input
                {...register("postalCode")}
                inputMode="numeric"
                className={fieldClass}
              />
            </label>
            <label className="grid gap-2 text-xs text-[#66716c]">
              Type de bien
              <select {...register("propertyType")} className={fieldClass}>
                <option value="">Sélectionner…</option>
                {[
                  "Villa",
                  "Maison",
                  "Appartement",
                  "Terrain",
                  "Local commercial",
                  "Autre",
                ].map((v) => (
                  <option key={v} value={v}>
                    {commercialLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs text-[#66716c]">
              Surface habitable (m²)
              <input
                {...register("surface")}
                type="number"
                min="1"
                step="0.1"
                className={fieldClass}
              />
            </label>
            <label className="grid gap-2 text-xs text-[#66716c]">
              Nombre de pièces
              <input
                {...register("rooms")}
                type="number"
                min="1"
                className={fieldClass}
              />
            </label>
            <label className="grid gap-2 text-xs text-[#66716c]">
              Année de construction
              <input
                {...register("constructionYear")}
                type="number"
                className={fieldClass}
              />
            </label>
            <label className="grid gap-2 text-xs text-[#66716c] sm:col-span-2">
              État général
              <select {...register("propertyCondition")} className={fieldClass}>
                <option value="">À préciser</option>
                {[
                  "Neuf",
                  "Très bon état",
                  "Bon état",
                  "À rafraîchir",
                  "À rénover",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </FormSection>
          <FormSection title="Planification du rendez-vous">
            <label className="grid gap-2 text-xs text-[#66716c]">
              Date et heure du rendez-vous
              <input
                {...register("appointmentAt")}
                type="datetime-local"
                className={fieldClass}
              />
            </label>
            <label className="grid gap-2 text-xs text-[#66716c]">
              Durée estimée
              <select {...register("durationMinutes")} className={fieldClass}>
                {[30, 45, 60, 90, 120].map((v) => (
                  <option key={v} value={v}>
                    {v} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs text-[#66716c] sm:col-span-2">
              Lieu du rendez-vous
              <input
                {...register("appointmentLocation")}
                placeholder="Sur place, à l’agence…"
                className={fieldClass}
              />
            </label>
          </FormSection>
          <FormSection title="Conseiller responsable">
            <label className="grid gap-2 text-xs text-[#66716c] sm:col-span-2">
              Conseiller responsable
              <select {...register("assignedTo")} className={fieldClass}>
                <option value="">Sélectionner…</option>
                {data.options.profiles.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs text-[#66716c] sm:col-span-2">
              Notes internes (optionnel)
              <textarea
                {...register("notes")}
                placeholder="Ajouter des notes…"
                className={fieldClass + " min-h-24 py-3"}
              />
            </label>
          </FormSection>
        </div>
        <CommercialPanel className="p-6 lg:sticky lg:top-24">
          <h2 className="font-semibold">Validation</h2>
          <p className="my-5 text-xs leading-5 text-[#66716c]">
            Vérifiez les informations avant de planifier le premier rendez-vous
            d’estimation.
          </p>
          {Object.keys(errors).length > 0 && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-[#f8ded9] p-3 text-xs text-[#943f37]"
            >
              Vérifiez le propriétaire, le conseiller, l’adresse complète, la
              surface et la date du rendez-vous.
            </p>
          )}
          <button
            disabled={isSubmitting}
            className={commercialPrimaryButton + " w-full"}
          >
            <Save className="size-4" />
            Créer l’estimation
          </button>
          <Link
            className={commercialSecondaryButton + " mt-3 w-full"}
            href="/commercial/estimations"
          >
            Annuler
          </Link>
        </CommercialPanel>
      </form>
      <DataSourceNotice demo={false} />
      <CommercialFeedback state={feedback} />
    </div>
  );
}

export function EstimationDetailConnected({
  data: initialData,
}: {
  data: CommercialEstimationPayload;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [editing, setEditing] = useState(false);
  const [transformOpen, setTransformOpen] = useState(false);
  const { data, refresh, status: syncStatus } = useCommercialResourceSync({
    initialData, endpoint: `/api/admin/commercial/estimations?id=${initialData.detail!.id}`,
    paused: editing || transformOpen || feedback?.type === "loading",
  });
  const detail = data.detail!;
  async function generate() {
    if (feedback?.type === "loading") return;
    setFeedback({ type: "loading", message: "Génération du PDF…" });
    try {
      await api({ action: "generate-report", id: detail.id });
      setFeedback({ type: "success", message: "PDF généré." });
      await refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Génération impossible.",
      });
    }
  }
  async function download() {
    setFeedback({ type: "loading", message: "Préparation du téléchargement…" });
    try {
      const response = await fetch(
        `/api/admin/commercial/estimations?id=${detail.id}&download=report`,
      );
      const payload = (await response.json()) as {
        success?: boolean;
        url?: string;
        message?: string;
      };
      if (!response.ok || !payload.url)
        throw new Error(payload.message ?? "Téléchargement impossible.");
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
  async function transform(form: FormData) {
    if (feedback?.type === "loading") return;
    setFeedback({ type: "loading", message: "Transformation atomique…" });
    try {
      const result = await api({
        action: "transform",
        id: detail.id,
        listingPrice: Number(form.get("listingPrice")),
        mandateType: form.get("mandateType"),
      });
      const propertyId = result.result?.property_id;
      if (propertyId) {
        router.push(`/admin?tab=properties&property=${propertyId}`);
      } else {
        router.push("/admin?tab=properties");
      }
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Transformation impossible.",
      });
    }
  }
  async function update(form: FormData) {
    if (feedback?.type === "loading") return;
    setFeedback({ type: "loading", message: "Enregistrement…" });
    try {
      const date = String(form.get("appointmentAt") || "");
      await api({
        action: "update",
        id: detail.id,
        assignedTo: form.get("assignedTo"),
        appointmentAt: date ? new Date(date).toISOString() : null,
        durationMinutes: Number(form.get("durationMinutes")),
        appointmentLocation: form.get("appointmentLocation") || null,
        commercialStatus: form.get("status"),
        estimatedValue: form.get("estimatedValue")
          ? Number(form.get("estimatedValue"))
          : null,
        estimateLow: form.get("estimateLow")
          ? Number(form.get("estimateLow"))
          : null,
        estimateHigh: form.get("estimateHigh")
          ? Number(form.get("estimateHigh"))
          : null,
        notes: form.get("notes") || null,
      });
      setEditing(false);
      setFeedback({ type: "success", message: "Estimation mise à jour." });
      await refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Mise à jour impossible.",
      });
    }
  }
  const localDate = detail.appointmentAt
    ? new Date(
        new Date(detail.appointmentAt).getTime() -
          new Date(detail.appointmentAt).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        title={detail.address + ", " + detail.city}
        description={`${commercialLabel(detail.status)} · Réf. ${detail.reference ?? "—"} · ${detail.contactName}`}
        action={
          <>
            {!detail.convertedPropertyId ? (
              <button
                onClick={() => setTransformOpen(true)}
                className={commercialPrimaryButton}
              >
                <Home className="size-4" />
                Transformer en bien
              </button>
            ) : (
              <Link
                className={commercialPrimaryButton}
                href={`/admin?tab=properties&property=${detail.convertedPropertyId}`}
              >
                Ouvrir le bien créé
              </Link>
            )}
            <button
              onClick={() => setEditing((v) => !v)}
              className={commercialSecondaryButton}
            >
              <Pencil className="size-4" />
              Modifier
            </button>
            <button onClick={generate} className={commercialSecondaryButton}>
              <FileText className="size-4" />
              Générer PDF
            </button>
            {detail.reportAvailable ? (
              <button onClick={download} className={commercialPrimaryButton}>
                <Download className="size-4" />
                Télécharger
              </button>
            ) : null}
          </>
        }
      />
      {syncStatus}
      <EstimationDetailPanels
        detail={detail}
        onGenerate={generate}
        onDownload={download}
      />
      {editing ? (
        <CommercialPanel className="p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void update(new FormData(event.currentTarget));
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <select
              aria-label="Conseiller responsable"
              name="assignedTo"
              defaultValue={detail.assignedTo ?? ""}
              className={fieldClass}
            >
              {data.options.profiles.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Statut de l’estimation"
              name="status"
              defaultValue={detail.status}
              className={fieldClass}
            >
              {[
                "NEW_REQUEST",
                "TO_CONTACT",
                "SCHEDULED",
                "COMPLETED",
                "REPORT_SENT",
                "NO_FOLLOW_UP",
                "FINISHED",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <input
              aria-label="Date du rendez-vous"
              name="appointmentAt"
              type="datetime-local"
              defaultValue={localDate}
              className={fieldClass}
            />
            <input
              aria-label="Durée en minutes"
              name="durationMinutes"
              type="number"
              defaultValue={detail.durationMinutes}
              className={fieldClass}
            />
            <input
              aria-label="Lieu du rendez-vous"
              name="appointmentLocation"
              defaultValue={detail.appointmentLocation ?? ""}
              className={fieldClass}
              placeholder="Lieu"
            />
            <input
              aria-label="Valeur conseillée"
              name="estimatedValue"
              type="number"
              defaultValue={detail.estimatedValue ?? ""}
              className={fieldClass}
              placeholder="Valeur estimée"
            />
            <input
              aria-label="Estimation basse"
              name="estimateLow"
              type="number"
              defaultValue={detail.estimateLow ?? ""}
              className={fieldClass}
              placeholder="Fourchette basse"
            />
            <input
              aria-label="Estimation haute"
              name="estimateHigh"
              type="number"
              defaultValue={detail.estimateHigh ?? ""}
              className={fieldClass}
              placeholder="Fourchette haute"
            />
            <textarea
              aria-label="Notes internes"
              name="notes"
              defaultValue={detail.notes ?? ""}
              className={`${fieldClass} min-h-24 sm:col-span-2`}
            />
            <button className={`${commercialPrimaryButton} sm:col-span-2`}>
              <Save className="size-4" />
              Enregistrer
            </button>
          </form>
        </CommercialPanel>
      ) : null}
      {transformOpen && !detail.convertedPropertyId && (
        <CommercialDialog
          title="Transformer l’estimation en bien"
          onClose={() => setTransformOpen(false)}
        >
          <h3 className="mb-3 text-sm font-semibold">
            Données de l’estimation
          </h3>
          <div className="mb-6 rounded-xl bg-[#f6f4ef] p-4 text-xs leading-6 text-[#66716c]">
            Adresse : {detail.address}, {detail.city}
            <br />
            Type : {detail.propertyType} · {detail.surface} m²
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void transform(new FormData(event.currentTarget));
            }}
            className="grid gap-5"
          >
            <label className="grid gap-2 text-sm">
              Prix de mise en vente (€)
              <input
                required
                name="listingPrice"
                type="number"
                min="1"
                defaultValue={
                  detail.listingPrice ?? detail.estimatedValue ?? ""
                }
                className={fieldClass}
              />
            </label>
            <fieldset className="grid gap-3">
              <legend className="mb-3 text-sm">Type de mandat</legend>
              {[
                ["exclusive", "Mandat exclusif"],
                ["semi-exclusive", "Mandat semi-exclusif"],
                ["simple", "Mandat simple"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#dfddd4] p-4 text-sm has-checked:border-[#4f7d5e] has-checked:bg-[#dce5d7]"
                >
                  <input
                    required
                    type="radio"
                    name="mandateType"
                    value={value}
                    defaultChecked={value === "exclusive"}
                    className="accent-[#2f493a]"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {feedback?.type === "error" && (
              <p role="alert" className="text-sm text-[#943f37]">
                {feedback.message}
              </p>
            )}
            <div className="flex justify-end gap-3 border-t border-[#dfddd4] pt-5">
              <button
                type="button"
                onClick={() => setTransformOpen(false)}
                className={commercialSecondaryButton}
              >
                Annuler
              </button>
              <button
                disabled={feedback?.type === "loading"}
                className={commercialPrimaryButton}
              >
                Créer le bien
              </button>
            </div>
          </form>
        </CommercialDialog>
      )}
      <DataSourceNotice demo={false} />
      <CommercialFeedback state={feedback} />
    </div>
  );
}

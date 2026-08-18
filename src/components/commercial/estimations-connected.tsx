"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Download,
  FileText,
  Home,
  Pencil,
  Plus,
  Save,
  UserRound,
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

export function EstimationsListConnected({
  data,
}: {
  data: CommercialEstimationPayload;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const rows = data.items.filter(
    (row) =>
      (status === "ALL" || row.status === status) &&
      [row.reference, row.contactName, row.address, row.city].some((value) =>
        value?.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        eyebrow="CRM Commercial"
        title="Estimations"
        description={`${data.meta.count} estimations issues de Supabase.`}
        action={
          <>
            <DataSourceNotice demo={false} />
            <Link
              className={commercialPrimaryButton}
              href="/commercial/estimations/nouvelle"
            >
              <Plus className="size-4" />
              Nouvelle estimation
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Nouvelles", data.stats.newRequests],
          ["À planifier", data.stats.toSchedule],
          ["Cette semaine", data.stats.scheduledThisWeek],
          ["Terminées", data.stats.completedThisMonth],
          ["Mandats", data.stats.mandatesThisMonth],
        ].map(([label, value]) => (
          <CommercialPanel key={String(label)} className="p-4">
            <p className="text-xs text-[#69736e]">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </CommercialPanel>
        ))}
      </div>
      <CommercialPanel className="grid gap-3 p-4 sm:grid-cols-2">
        <input
          className={fieldClass}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher contact, adresse, ville…"
        />
        <select
          className={fieldClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">Tous les statuts</option>
          {[
            "NEW_REQUEST",
            "TO_CONTACT",
            "SCHEDULED",
            "COMPLETED",
            "REPORT_SENT",
            "NO_FOLLOW_UP",
            "FINISHED",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </CommercialPanel>
      {rows.length === 0 ? (
        <BentoEmptyState
          title="Aucune estimation"
          description="Aucune donnée réelle ne correspond aux filtres."
        />
      ) : (
        <CommercialPanel className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-[#f1efe9]">
              <tr>
                <th className="p-4">Référence</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Bien</th>
                <th className="p-4">Créneau</th>
                <th className="p-4">Conseiller</th>
                <th className="p-4">Statut</th>
                <th className="p-4">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-[#f8f7f3]">
                  <td className="p-4">
                    <Link
                      className="font-bold text-[#2f493a] underline-offset-4 hover:underline"
                      href={`/commercial/estimations/${row.id}`}
                    >
                      {row.reference ?? row.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold">{row.contactName}</p>
                    <p className="text-xs text-[#69736e]">{row.contactEmail}</p>
                  </td>
                  <td className="p-4">
                    {row.propertyType} · {row.surface} m²
                    <br />
                    <span className="text-xs text-[#69736e]">
                      {row.address}, {row.city}
                    </span>
                  </td>
                  <td className="p-4">
                    {row.appointmentAt
                      ? new Date(row.appointmentAt).toLocaleString("fr-FR")
                      : "Non planifié"}
                  </td>
                  <td className="p-4">{row.assignedToName ?? "Non assigné"}</td>
                  <td className="p-4">
                    <CommercialBadge
                      tone={row.status === "FINISHED" ? "success" : "info"}
                    >
                      {row.status}
                    </CommercialBadge>
                  </td>
                  <td className="p-4 font-semibold">
                    {row.estimatedValue
                      ? `${row.estimatedValue.toLocaleString("fr-FR")} €`
                      : "—"}
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
    <div className="grid gap-6">
      <CommercialPageHeader
        title="Nouvelle estimation"
        description="Planifiez le créneau réel avec un contact et un conseiller existants."
        action={<DataSourceNotice demo={false} />}
      />
      <CommercialPanel className="p-5">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            Contact
            <select {...register("contactId")} className={fieldClass}>
              <option value="">Sélectionner…</option>
              {data.options.contacts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.email}
                </option>
              ))}
            </select>
            {errors.contactId ? (
              <span className="text-xs text-red-700">Contact requis.</span>
            ) : null}
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Conseiller
            <select {...register("assignedTo")} className={fieldClass}>
              <option value="">Sélectionner…</option>
              {data.options.profiles.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Adresse
            <input {...register("propertyAddress")} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Ville
            <input {...register("city")} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Code postal
            <input {...register("postalCode")} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Type de bien
            <input {...register("propertyType")} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Surface m²
            <input
              {...register("surface")}
              type="number"
              step="0.1"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Pièces
            <input
              {...register("rooms")}
              type="number"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Année de construction
            <input
              {...register("constructionYear")}
              type="number"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            État
            <input {...register("propertyCondition")} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Date et heure
            <input
              {...register("appointmentAt")}
              type="datetime-local"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Durée (minutes)
            <input
              {...register("durationMinutes")}
              type="number"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Lieu
            <input
              {...register("appointmentLocation")}
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Notes
            <textarea
              {...register("notes")}
              className={`${fieldClass} min-h-28`}
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Link
              className={commercialSecondaryButton}
              href="/commercial/estimations"
            >
              Annuler
            </Link>
            <button disabled={isSubmitting} className={commercialPrimaryButton}>
              <Save className="size-4" />
              Créer l&apos;estimation
            </button>
          </div>
        </form>
      </CommercialPanel>
      <CommercialFeedback state={feedback} />
    </div>
  );
}

export function EstimationDetailConnected({
  data,
}: {
  data: CommercialEstimationPayload;
}) {
  const router = useRouter();
  const detail = data.detail!;
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [editing, setEditing] = useState(false);
  async function generate() {
    setFeedback({ type: "loading", message: "Génération du PDF…" });
    try {
      await api({ action: "generate-report", id: detail.id });
      setFeedback({ type: "success", message: "PDF généré." });
      router.refresh();
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
      router.refresh();
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
        title={detail.reference ?? "Détail estimation"}
        description={`${detail.contactName} · ${detail.address}, ${detail.city}`}
        action={
          <>
            <DataSourceNotice demo={false} />
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
      <div className="grid gap-4 lg:grid-cols-3">
        <CommercialPanel className="p-5 lg:col-span-2">
          <h2 className="text-lg font-bold">Données réelles</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[#69736e]">Contact</dt>
              <dd className="font-semibold">{detail.contactName}</dd>
              <dd>
                {detail.contactEmail}
                <br />
                {detail.contactPhone}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Conseiller</dt>
              <dd className="font-semibold">
                {detail.assignedToName ?? "Non assigné"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Bien</dt>
              <dd>
                {detail.propertyType} · {detail.surface} m² ·{" "}
                {detail.rooms ?? "—"} pièces
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Créneau</dt>
              <dd>
                {detail.appointmentAt
                  ? new Date(detail.appointmentAt).toLocaleString("fr-FR")
                  : "Non planifié"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Estimation</dt>
              <dd>
                {detail.estimatedValue
                  ? `${detail.estimatedValue.toLocaleString("fr-FR")} €`
                  : "Non renseignée"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Statut</dt>
              <dd>
                <CommercialBadge tone="info">{detail.status}</CommercialBadge>
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            {detail.contactId ? (
              <Link
                href={`/admin?tab=contacts&contact=${detail.contactId}`}
                className={commercialSecondaryButton}
              >
                <UserRound className="size-4" />
                Ouvrir le contact
              </Link>
            ) : null}
            {detail.convertedPropertyId ? (
              <Link
                href={`/admin?tab=properties&property=${detail.convertedPropertyId}`}
                className={commercialPrimaryButton}
              >
                <Home className="size-4" />
                Ouvrir le bien créé
              </Link>
            ) : null}
          </div>
        </CommercialPanel>
        <CommercialPanel className="p-5">
          <h2 className="font-bold">Historique</h2>
          <div className="mt-4 grid gap-3">
            {detail.history.length ? (
              detail.history.map((row) => (
                <div key={row.id} className="border-l-2 border-[#2f493a] pl-3">
                  <p className="text-sm font-semibold">{row.action}</p>
                  <p className="text-xs text-[#69736e]">
                    {new Date(row.createdAt).toLocaleString("fr-FR")} ·{" "}
                    {row.actorName}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#69736e]">Aucun événement.</p>
            )}
          </div>
        </CommercialPanel>
      </div>
      {editing ? (
        <CommercialPanel className="p-5">
          <form action={update} className="grid gap-3 sm:grid-cols-2">
            <select
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
              name="appointmentAt"
              type="datetime-local"
              defaultValue={localDate}
              className={fieldClass}
            />
            <input
              name="durationMinutes"
              type="number"
              defaultValue={detail.durationMinutes}
              className={fieldClass}
            />
            <input
              name="appointmentLocation"
              defaultValue={detail.appointmentLocation ?? ""}
              className={fieldClass}
              placeholder="Lieu"
            />
            <input
              name="estimatedValue"
              type="number"
              defaultValue={detail.estimatedValue ?? ""}
              className={fieldClass}
              placeholder="Valeur estimée"
            />
            <input
              name="estimateLow"
              type="number"
              defaultValue={detail.estimateLow ?? ""}
              className={fieldClass}
              placeholder="Fourchette basse"
            />
            <input
              name="estimateHigh"
              type="number"
              defaultValue={detail.estimateHigh ?? ""}
              className={fieldClass}
              placeholder="Fourchette haute"
            />
            <textarea
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
      {!detail.convertedPropertyId ? (
        <CommercialPanel className="p-5">
          <h2 className="text-lg font-bold">Transformer en bien et mandat</h2>
          <p className="mt-1 text-sm text-[#69736e]">
            Cette action est exécutée dans une transaction PostgreSQL unique.
          </p>
          <form
            action={transform}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              required
              name="listingPrice"
              type="number"
              min="1"
              className={fieldClass}
              placeholder="Prix de commercialisation"
            />
            <select name="mandateType" className={fieldClass}>
              <option value="exclusive">Exclusif</option>
              <option value="semi-exclusive">Semi-exclusif</option>
              <option value="simple">Simple</option>
            </select>
            <button className={commercialPrimaryButton}>
              <Home className="size-4" />
              Transformer
            </button>
          </form>
        </CommercialPanel>
      ) : null}
      <CommercialFeedback state={feedback} />
    </div>
  );
}

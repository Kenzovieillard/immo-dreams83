"use client";
import { useCommercialResourceSync } from "./use-commercial-resource-sync";

import Link from "next/link";
import { agendaEntryHref } from "@/lib/agenda-time";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Clock3, FileText, RotateCcw, Save } from "lucide-react";
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
import { VisitDetailPanels } from "./commercial-detail-panels";
import { shortDate } from "@/lib/commercial-presentation";
import { cn } from "@/lib/utils";
import type { CommercialVisitPayload } from "@/types/commercial";

type Feedback = {
  type: "loading" | "success" | "error";
  message: string;
} | null;
const createSchema = z.object({
  propertyId: z.string().uuid(),
  contactId: z.string().uuid(),
  leadId: z.string().uuid().or(z.literal("")).optional(),
  assignedTo: z.string().uuid(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;
const reportSchema = z
  .object({
    generalImpression: z.enum(["POSITIVE", "MIXED", "NEGATIVE"]),
    positivePoints: z.string(),
    blockingPoints: z.string(),
    interestLevel: z.coerce.number().int().min(1).max(5),
    comments: z.string().min(4),
    nextAction: z.enum([
      "CREATE_OFFER",
      "PLAN_SECOND_VISIT",
      "FOLLOW_UP_LATER",
      "NO_FOLLOW_UP",
    ]),
    followUpAt: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.nextAction === "FOLLOW_UP_LATER" && !value.followUpAt)
      ctx.addIssue({
        code: "custom",
        path: ["followUpAt"],
        message: "Date de relance requise.",
      });
  });
type ReportInput = z.input<typeof reportSchema>;
type ReportValues = z.output<typeof reportSchema>;
async function api(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/commercial/visites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    id?: string;
    result?: {
      property_id?: string;
      contact_id?: string;
      lead_id?: string;
      next_action?: string;
    };
  } | null;
  if (!response.ok || !payload?.success)
    throw new Error(payload?.message ?? "Action impossible.");
  return payload;
}

export {
  VisitsListConnected,
  VisitCalendarConnected,
} from "./commercial-lists-connected";

export function VisitCreateConnected({
  data,
  prefill,
}: {
  data: CommercialVisitPayload;
  prefill?: { propertyId?: string | null; contactId?: string | null };
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      propertyId: prefill?.propertyId ?? "",
      contactId: prefill?.contactId ?? "",
    },
  });
  const contactId = useWatch({ control, name: "contactId" });
  const matchingCases = data.options.buyerCases.filter(
    (row) => !contactId || row.contactId === contactId,
  );
  const submit = handleSubmit(async (values) => {
    setFeedback({ type: "loading", message: "Planification…" });
    try {
      const result = await api({
        action: "create",
        ...values,
        leadId: values.leadId || null,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
        location: values.location || null,
        notes: values.notes || null,
      });
      router.push(`/commercial/visites/${result.id}`);
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Planification impossible.",
      });
    }
  });
  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        title="Planifier une visite"
        description="Utilisez un bien, un acquéreur et un conseiller existants."
        action={<DataSourceNotice demo={false} />}
      />
      <CommercialPanel className="p-5">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            Bien
            <select {...register("propertyId")} className={fieldClass}>
              <option value="">Sélectionner…</option>
              {data.options.properties.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.reference} · {row.title}
                </option>
              ))}
            </select>
          </label>
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
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Dossier acquéreur
            <select {...register("leadId")} className={fieldClass}>
              <option value="">Aucun</option>
              {matchingCases.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
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
          <label className="grid gap-1 text-sm font-semibold">
            Début
            <input
              {...register("startsAt")}
              type="datetime-local"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Fin
            <input
              {...register("endsAt")}
              type="datetime-local"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Lieu
            <input {...register("location")} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Notes
            <textarea
              {...register("notes")}
              className={`${fieldClass} min-h-24`}
            />
          </label>
          {Object.keys(errors).length ? (
            <p className="text-sm text-red-700 sm:col-span-2">
              Vérifiez les champs obligatoires.
            </p>
          ) : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Link
              href="/commercial/visites"
              className={commercialSecondaryButton}
            >
              Annuler
            </Link>
            <button disabled={isSubmitting} className={commercialPrimaryButton}>
              <Save className="size-4" />
              Planifier
            </button>
          </div>
        </form>
      </CommercialPanel>
      <CommercialFeedback state={feedback} />
    </div>
  );
}

export function VisitDetailConnected({
  data: initialData,
}: {
  data: CommercialVisitPayload;
}) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [rescheduleDirty, setRescheduleDirty] = useState(false);
  const { data, refresh, status: syncStatus } = useCommercialResourceSync({
    initialData, endpoint: `/api/admin/commercial/visites?id=${initialData.detail!.id}`,
    paused: rescheduleDirty || feedback?.type === "loading",
  });
  const detail = data.detail!;
  async function act(body: Record<string, unknown>, message: string) {
    if (feedback?.type === "loading") return;
    setFeedback({ type: "loading", message });
    try {
      await api(body);
      if (body.action === "reschedule") setRescheduleDirty(false);
      setFeedback({ type: "success", message: "Visite mise à jour." });
      if (!rescheduleDirty || body.action === "reschedule") await refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Action impossible.",
      });
    }
  }
  async function reschedule(form: FormData) {
    const startsAt = String(form.get("startsAt") || "");
    const endsAt = String(form.get("endsAt") || "");
    await act(
      {
        action: "reschedule",
        id: detail.id,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      },
      "Replanification…",
    );
  }
  const local = (value: string | null) =>
    value
      ? new Date(
          new Date(value).getTime() -
            new Date(value).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        title={detail.propertyTitle ?? detail.title}
        description={`${detail.contactName ?? "Contact non relié"} · ${new Date(detail.startsAt).toLocaleString("fr-FR")}`}
        action={
          <>
            <Link href={agendaEntryHref("appointment", detail.id, detail.startsAt)} className={commercialSecondaryButton}>Voir dans l’agenda</Link>
            {detail.offerId ? (
              <Link
                href={"/commercial/offres/" + detail.offerId}
                className={commercialPrimaryButton}
              >
                Ouvrir l’offre liée
              </Link>
            ) : detail.reportSubmittedAt &&
              detail.propertyId &&
              detail.contactId ? (
              <Link
                href={
                  "/commercial/offres/nouvelle?bien_id=" +
                  detail.propertyId +
                  "&contact_id=" +
                  detail.contactId +
                  "&visite_id=" +
                  detail.id
                }
                className={commercialPrimaryButton}
              >
                Rédiger l’offre
              </Link>
            ) : null}
            {detail.visitStatus === "TO_CONFIRM" ? (
              <button
                disabled={feedback?.type === "loading"}
                onClick={() =>
                  act(
                    {
                      action: "set-status",
                      id: detail.id,
                      status: "CONFIRMED",
                    },
                    "Confirmation…",
                  )
                }
                className={commercialPrimaryButton}
              >
                <Check className="size-4" />
                Confirmer
              </button>
            ) : null}
            {["TO_CONFIRM", "CONFIRMED"].includes(detail.visitStatus) && (
              <button
                disabled={feedback?.type === "loading"}
                className={commercialSecondaryButton}
                onClick={() => {
                  if (
                    window.confirm(
                      "Annuler cette visite ? Elle restera visible dans l’historique.",
                    )
                  )
                    void act(
                      {
                        action: "set-status",
                        id: detail.id,
                        status: "CANCELLED",
                      },
                      "Annulation de la visite…",
                    );
                }}
              >
                Annuler la visite
              </button>
            )}
            {!detail.reportSubmittedAt ? (
              <Link
                href={`/commercial/visites/${detail.id}/compte-rendu`}
                className={commercialSecondaryButton}
              >
                <FileText className="size-4" />
                Compte rendu
              </Link>
            ) : null}
          </>
        }
      />
      {syncStatus}
      <VisitDetailPanels
        detail={detail}
        propertyPrice={
          data.options.properties.find((p) => p.id === detail.propertyId)?.price
        }
      />
      <CommercialPanel className="p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <RotateCcw className="size-4" />
          Replanifier
        </h2>
        <form
          key={`${detail.startsAt}-${detail.endsAt}`}
          onChange={() => setRescheduleDirty(true)}
          onSubmit={(event) => {
            event.preventDefault();
            void reschedule(new FormData(event.currentTarget));
          }}
          className="mt-3 grid gap-3 sm:grid-cols-3"
        >
          <input
            required
            aria-label="Nouvelle date de début"
            name="startsAt"
            type="datetime-local"
            defaultValue={local(detail.startsAt)}
            className={fieldClass}
          />
          <input
            aria-label="Nouvelle date de fin"
            name="endsAt"
            type="datetime-local"
            defaultValue={local(detail.endsAt)}
            className={fieldClass}
          />
          <button
            disabled={
              feedback?.type === "loading" ||
              detail.visitStatus === "CANCELLED" ||
              detail.visitStatus === "COMPLETED"
            }
            className={commercialPrimaryButton}
          >
            <Clock3 className="size-4" />
            Enregistrer
          </button>
          {rescheduleDirty && <button type="reset" className={commercialSecondaryButton} onClick={() => setRescheduleDirty(false)}>Annuler la saisie</button>}
        </form>
      </CommercialPanel>
      <CommercialFeedback state={feedback} />
    </div>
  );
}

export function VisitReportConnected({
  data: initialData,
}: {
  data: CommercialVisitPayload;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ReportInput, unknown, ReportValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      generalImpression:
        (initialData.detail!.generalImpression as ReportValues["generalImpression"]) ??
        "POSITIVE",
      interestLevel: initialData.detail!.interestLevel ?? 3,
      nextAction: "CREATE_OFFER",
      positivePoints: initialData.detail!.positivePoints.join("\n"),
      blockingPoints: initialData.detail!.blockingPoints.join("\n"),
      comments: initialData.detail!.additionalComments ?? "",
    },
  });
  const { data, status: syncStatus } = useCommercialResourceSync({
    initialData, endpoint: `/api/admin/commercial/visites?id=${initialData.detail!.id}`,
    paused: isDirty || isSubmitting || feedback?.type === "loading",
  });
  const detail = data.detail!;
  useEffect(() => {
    if (isDirty) return;
    reset({
      generalImpression: (detail.generalImpression as ReportValues["generalImpression"]) ?? "POSITIVE",
      interestLevel: detail.interestLevel ?? 3, nextAction: "CREATE_OFFER",
      positivePoints: detail.positivePoints.join("\n"), blockingPoints: detail.blockingPoints.join("\n"),
      comments: detail.additionalComments ?? "",
    });
  }, [detail, isDirty, reset]);
  const nextAction = useWatch({ control, name: "nextAction" });
  const interest = useWatch({ control, name: "interestLevel" });
  const positives = useWatch({ control, name: "positivePoints" });
  const blockers = useWatch({ control, name: "blockingPoints" });
  const togglePoint = (
    field: "positivePoints" | "blockingPoints",
    point: string,
  ) => {
    const current = (field === "positivePoints" ? positives : blockers)
      .split("\n")
      .filter(Boolean);
    setValue(
      field,
      (current.includes(point)
        ? current.filter((p) => p !== point)
        : [...current, point]
      ).join("\n"),
      { shouldDirty: true },
    );
  };
  const submit = handleSubmit(async (values) => {
    setFeedback({
      type: "loading",
      message: "Enregistrement du compte rendu…",
    });
    try {
      const response = await api({
        action: "submit-report",
        id: detail.id,
        generalImpression: values.generalImpression,
        positivePoints: values.positivePoints
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        blockingPoints: values.blockingPoints
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        interestLevel: values.interestLevel,
        comments: values.comments,
        nextAction: values.nextAction,
        followUpAt: values.followUpAt
          ? new Date(values.followUpAt).toISOString()
          : null,
      });
      const result = response.result;
      if (values.nextAction === "CREATE_OFFER")
        router.push(
          `/commercial/offres/nouvelle?bien_id=${result?.property_id}&contact_id=${result?.contact_id}&visite_id=${detail.id}`,
        );
      else if (values.nextAction === "PLAN_SECOND_VISIT")
        router.push(
          `/commercial/visites/nouvelle?bien_id=${result?.property_id}&contact_id=${result?.contact_id}`,
        );
      else router.push(`/commercial/visites/${detail.id}`);
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Compte rendu impossible.",
      });
    }
  });
  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        eyebrow="Commercial / Visites / Nouveau compte rendu"
        title="Saisie de compte rendu de visite"
        description="Complétez les informations après la visite du client."
      />
      {syncStatus}
      {isDirty && <button type="button" className={commercialSecondaryButton} onClick={() => { if (window.confirm("Abandonner ce brouillon et charger la dernière version ?")) reset(); }}>Abandonner le brouillon</button>}
      <CommercialPanel className="p-5 sm:p-6">
        <div className="mb-6 border-b border-[#dfddd4] pb-6">
          <h2 className="font-semibold">
            {detail.propertyTitle ?? detail.title}
          </h2>
          <p className="mt-1 text-xs text-[#66716c]">
            Visite du {shortDate(detail.startsAt, true)} ·{" "}
            {detail.contactName ?? "Contact non relié"}
          </p>
        </div>
        <form onSubmit={submit} className="grid gap-7">
          <label className="grid max-w-xs gap-2 text-sm font-semibold">
            Impression générale
            <select {...register("generalImpression")} className={fieldClass}>
              <option value="POSITIVE">Positive</option>
              <option value="MIXED">Mitigée</option>
              <option value="NEGATIVE">Négative</option>
            </select>
          </label>
          {(
            [
              {
                field: "positivePoints",
                title: "Points positifs",
                options: [
                  "Luminosité",
                  "Vue",
                  "Quartier",
                  "Agencement",
                  "Prix",
                  "État général",
                ],
                current: positives,
              },
              {
                field: "blockingPoints",
                title: "Points bloquants",
                options: [
                  "Prix trop élevé",
                  "Travaux nécessaires",
                  "Nuisances",
                  "Superficie insuffisante",
                  "Environnement",
                ],
                current: blockers,
              },
            ] as const
          ).map((group) => (
            <fieldset key={group.field}>
              <legend className="mb-3 text-sm font-semibold">
                {group.title}
              </legend>
              <div className="flex flex-wrap gap-2">
                {group.options.map((point) => (
                  <button
                    key={point}
                    type="button"
                    aria-pressed={group.current.split("\n").includes(point)}
                    onClick={() => togglePoint(group.field, point)}
                    className={cn(
                      "min-h-9 rounded-full px-4 text-xs font-semibold transition",
                      group.current.split("\n").includes(point)
                        ? "bg-[#2f493a] text-white"
                        : "bg-[#dce5d7] text-[#18211f]",
                    )}
                  >
                    {point}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-xs text-[#66716c]">
                Précisions libres (un point par ligne)
                <textarea
                  {...register(group.field)}
                  className={fieldClass + " mt-2 min-h-16 py-2"}
                />
              </label>
            </fieldset>
          ))}
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">
              Niveau d’intérêt
            </legend>
            <div className="flex flex-wrap items-center gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className={cn(
                    "relative grid size-10 cursor-pointer place-items-center rounded-full text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#2f493a]",
                    Number(interest) >= value
                      ? "bg-[#2f493a] text-white"
                      : "bg-[#dce5d7]",
                  )}
                >
                  <input
                    type="radio"
                    {...register("interestLevel")}
                    value={value}
                    checked={Number(interest) === value}
                    className="sr-only"
                    aria-label={value + " sur 5"}
                  />
                  {value}
                </label>
              ))}
              <span className="text-xs text-[#66716c]">
                {
                  [
                    "",
                    "Peu intéressé",
                    "Intérêt limité",
                    "À confirmer",
                    "Très intéressé",
                    "Prêt à faire une offre",
                  ][Number(interest)]
                }
              </span>
            </div>
          </fieldset>
          <label className="grid gap-3 text-sm font-semibold">
            Commentaires additionnels
            <textarea
              {...register("comments")}
              className={fieldClass + " min-h-28 py-3"}
              placeholder="Décrivez le retour du client…"
            />
            {errors.comments && (
              <span role="alert" className="text-xs text-[#943f37]">
                Précisez le retour de visite (4 caractères minimum).
              </span>
            )}
          </label>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">
              Action suivante planifiée
            </legend>
            <div className="flex flex-wrap gap-5">
              {[
                ["CREATE_OFFER", "Créer une offre"],
                ["PLAN_SECOND_VISIT", "Planifier une autre visite"],
                ["FOLLOW_UP_LATER", "Relancer plus tard"],
                ["NO_FOLLOW_UP", "Sans suite"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    {...register("nextAction")}
                    value={value}
                    className="accent-[#2f493a]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {nextAction === "FOLLOW_UP_LATER" && (
            <label className="grid max-w-sm gap-2 text-sm font-semibold">
              Date de relance
              <input
                {...register("followUpAt")}
                type="datetime-local"
                className={fieldClass}
              />
              {errors.followUpAt && (
                <span role="alert" className="text-xs text-[#943f37]">
                  {errors.followUpAt.message}
                </span>
              )}
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-3 border-t border-[#dfddd4] pt-6">
            <Link
              href={"/commercial/visites/" + detail.id}
              className={commercialSecondaryButton}
            >
              Annuler
            </Link>
            <button disabled={isSubmitting} className={commercialPrimaryButton}>
              <Save className="size-4" />
              Enregistrer le compte rendu
            </button>
          </div>
        </form>
      </CommercialPanel>
      <DataSourceNotice demo={false} />
      <CommercialFeedback state={feedback} />
    </div>
  );
}

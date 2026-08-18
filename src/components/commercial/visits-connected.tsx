"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Check,
  Clock3,
  FileText,
  Plus,
  RotateCcw,
  Save,
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

export function VisitsListConnected({
  data,
}: {
  data: CommercialVisitPayload;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const rows = data.items.filter(
    (row) =>
      (status === "ALL" || row.visitStatus === status) &&
      [row.propertyTitle, row.propertyReference, row.contactName].some(
        (value) => value?.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        eyebrow="CRM Commercial"
        title="Visites"
        description={`${data.meta.count} visites réelles enregistrées.`}
        action={
          <>
            <DataSourceNotice demo={false} />
            <Link
              href="/commercial/visites/calendrier"
              className={commercialSecondaryButton}
            >
              <CalendarDays className="size-4" />
              Calendrier
            </Link>
            <Link
              href="/commercial/visites/nouvelle"
              className={commercialPrimaryButton}
            >
              <Plus className="size-4" />
              Planifier
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Cette semaine", data.stats.total],
          ["Confirmées", data.stats.confirmed],
          ["À confirmer", data.stats.toConfirm],
          ["CR manquants", data.stats.reportsMissing],
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
          placeholder="Bien, référence, contact…"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={fieldClass}
        >
          <option value="ALL">Tous les statuts</option>
          {["TO_CONFIRM", "CONFIRMED", "COMPLETED", "CANCELLED"].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
      </CommercialPanel>
      {rows.length === 0 ? (
        <BentoEmptyState
          title="Aucune visite"
          description="Planifiez une visite avec un bien et un contact réels."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Link key={row.id} href={`/commercial/visites/${row.id}`}>
              <CommercialPanel className="h-full p-4 transition hover:border-[#2f493a]">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {row.propertyTitle ?? "Bien non relié"}
                    </p>
                    <p className="text-xs text-[#69736e]">
                      {row.propertyReference}
                    </p>
                  </div>
                  <CommercialBadge
                    tone={
                      row.visitStatus === "COMPLETED"
                        ? "success"
                        : row.visitStatus === "CANCELLED"
                          ? "danger"
                          : "info"
                    }
                  >
                    {row.visitStatus}
                  </CommercialBadge>
                </div>
                <p className="mt-4 text-sm font-semibold">
                  {row.contactName ?? "Contact non relié"}
                </p>
                <p className="mt-1 text-sm text-[#69736e]">
                  {new Date(row.startsAt).toLocaleString("fr-FR")}
                </p>
                <p className="mt-3 text-xs">
                  Conseiller : {row.assignedToName ?? "Non assigné"}
                </p>
                {row.reportNextAction ? (
                  <p className="mt-2 text-xs font-semibold">
                    Suite : {row.reportNextAction}
                  </p>
                ) : null}
              </CommercialPanel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function VisitCalendarConnected({
  data,
}: {
  data: CommercialVisitPayload;
}) {
  const items = data.items;
  const grouped = useMemo(() => {
    const map = new Map<string, CommercialVisitPayload["items"]>();
    for (const item of items) {
      const day = new Intl.DateTimeFormat("fr-CA", {
        timeZone: "Europe/Paris",
      }).format(new Date(item.startsAt));
      map.set(day, [...(map.get(day) ?? []), item]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);
  return (
    <div className="grid gap-6">
      <CommercialPageHeader
        title="Calendrier des visites"
        description="Calendrier construit uniquement depuis les rendez-vous Supabase."
        action={
          <>
            <DataSourceNotice demo={false} />
            <Link
              href="/commercial/visites/nouvelle"
              className={commercialPrimaryButton}
            >
              <Plus className="size-4" />
              Planifier
            </Link>
          </>
        }
      />
      {grouped.length === 0 ? (
        <BentoEmptyState
          title="Calendrier vide"
          description="Aucune visite enregistrée."
        />
      ) : (
        <div className="grid gap-4">
          {grouped.map(([day, items]) => (
            <CommercialPanel key={day} className="p-4">
              <h2 className="font-bold">
                {new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <div className="mt-3 grid gap-2">
                {items.map((row) => (
                  <Link
                    key={row.id}
                    href={`/commercial/visites/${row.id}`}
                    className="flex flex-col gap-2 rounded-lg border bg-white p-3 sm:flex-row sm:items-center"
                  >
                    <span className="font-bold">
                      {new Date(row.startsAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="flex-1">
                      {row.propertyTitle} · {row.contactName}
                    </span>
                    <CommercialBadge tone="info">
                      {row.visitStatus}
                    </CommercialBadge>
                  </Link>
                ))}
              </div>
            </CommercialPanel>
          ))}
        </div>
      )}
    </div>
  );
}

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
  data,
}: {
  data: CommercialVisitPayload;
}) {
  const router = useRouter();
  const detail = data.detail!;
  const [feedback, setFeedback] = useState<Feedback>(null);
  async function act(body: Record<string, unknown>, message: string) {
    setFeedback({ type: "loading", message });
    try {
      await api(body);
      setFeedback({ type: "success", message: "Visite mise à jour." });
      router.refresh();
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
            <DataSourceNotice demo={false} />
            {detail.visitStatus === "TO_CONFIRM" ? (
              <button
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
      <div className="grid gap-4 lg:grid-cols-3">
        <CommercialPanel className="p-5 lg:col-span-2">
          <h2 className="font-bold">Relations</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[#69736e]">Bien</dt>
              <dd className="font-semibold">
                {detail.propertyReference} · {detail.propertyTitle}
              </dd>
              {detail.propertyId ? (
                <Link
                  className="text-sm underline"
                  href={`/admin?tab=properties&property=${detail.propertyId}`}
                >
                  Ouvrir le bien
                </Link>
              ) : null}
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Acquéreur</dt>
              <dd className="font-semibold">{detail.contactName}</dd>
              <dd>
                {detail.contactEmail}
                <br />
                {detail.contactPhone}
              </dd>
              {detail.contactId ? (
                <Link
                  className="text-sm underline"
                  href={`/admin?tab=contacts&contact=${detail.contactId}`}
                >
                  Ouvrir le contact
                </Link>
              ) : null}
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Conseiller</dt>
              <dd>{detail.assignedToName ?? "Non assigné"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Statut</dt>
              <dd>
                <CommercialBadge tone="info">
                  {detail.visitStatus}
                </CommercialBadge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Compte rendu</dt>
              <dd>
                {detail.reportSubmittedAt
                  ? new Date(detail.reportSubmittedAt).toLocaleString("fr-FR")
                  : "Non soumis"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#69736e]">Prochaine action</dt>
              <dd>{detail.reportNextAction ?? "Non définie"}</dd>
            </div>
          </dl>
          {detail.offerId ? (
            <Link
              href={`/commercial/offres/${detail.offerId}`}
              className={`${commercialPrimaryButton} mt-5`}
            >
              Ouvrir l&apos;offre liée
            </Link>
          ) : null}
        </CommercialPanel>
        <CommercialPanel className="p-5">
          <h2 className="font-bold">Historique</h2>
          <div className="mt-3 grid gap-3">
            {detail.history.length ? (
              detail.history.map((row) => (
                <div key={row.id} className="border-l-2 border-[#2f493a] pl-3">
                  <p className="text-sm font-semibold">{row.action}</p>
                  <p className="text-xs text-[#69736e]">
                    {new Date(row.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#69736e]">Aucun événement.</p>
            )}
          </div>
        </CommercialPanel>
      </div>
      <CommercialPanel className="p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <RotateCcw className="size-4" />
          Replanifier
        </h2>
        <form action={reschedule} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            required
            name="startsAt"
            type="datetime-local"
            defaultValue={local(detail.startsAt)}
            className={fieldClass}
          />
          <input
            name="endsAt"
            type="datetime-local"
            defaultValue={local(detail.endsAt)}
            className={fieldClass}
          />
          <button className={commercialPrimaryButton}>
            <Clock3 className="size-4" />
            Enregistrer
          </button>
        </form>
      </CommercialPanel>
      <CommercialFeedback state={feedback} />
    </div>
  );
}

export function VisitReportConnected({
  data,
}: {
  data: CommercialVisitPayload;
}) {
  const router = useRouter();
  const detail = data.detail!;
  const [feedback, setFeedback] = useState<Feedback>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ReportInput, unknown, ReportValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      interestLevel: 3,
      nextAction: "CREATE_OFFER",
      positivePoints: "",
      blockingPoints: "",
      comments: "",
    },
  });
  const nextAction = useWatch({ control, name: "nextAction" });
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
        title="Compte rendu de visite"
        description={`${detail.propertyTitle} · ${detail.contactName}`}
        action={<DataSourceNotice demo={false} />}
      />
      <CommercialPanel className="p-5">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            Impression
            <select {...register("generalImpression")} className={fieldClass}>
              <option value="POSITIVE">Positive</option>
              <option value="MIXED">Mitigée</option>
              <option value="NEGATIVE">Négative</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Intérêt (1 à 5)
            <input
              {...register("interestLevel")}
              type="number"
              min="1"
              max="5"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Points positifs (un par ligne)
            <textarea
              {...register("positivePoints")}
              className={`${fieldClass} min-h-28`}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Freins (un par ligne)
            <textarea
              {...register("blockingPoints")}
              className={`${fieldClass} min-h-28`}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Commentaires
            <textarea
              {...register("comments")}
              className={`${fieldClass} min-h-28`}
            />
            {errors.comments ? (
              <span className="text-xs text-red-700">Commentaire requis.</span>
            ) : null}
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Suite
            <select {...register("nextAction")} className={fieldClass}>
              <option value="CREATE_OFFER">Créer une offre</option>
              <option value="PLAN_SECOND_VISIT">
                Planifier une deuxième visite
              </option>
              <option value="FOLLOW_UP_LATER">Relancer plus tard</option>
              <option value="NO_FOLLOW_UP">Aucune suite</option>
            </select>
          </label>
          {nextAction === "FOLLOW_UP_LATER" ? (
            <label className="grid gap-1 text-sm font-semibold">
              Date de relance
              <input
                {...register("followUpAt")}
                type="datetime-local"
                className={fieldClass}
              />
              {errors.followUpAt ? (
                <span className="text-xs text-red-700">
                  {errors.followUpAt.message}
                </span>
              ) : null}
            </label>
          ) : (
            <div />
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Link
              href={`/commercial/visites/${detail.id}`}
              className={commercialSecondaryButton}
            >
              Annuler
            </Link>
            <button disabled={isSubmitting} className={commercialPrimaryButton}>
              <Save className="size-4" />
              Enregistrer et continuer
            </button>
          </div>
        </form>
      </CommercialPanel>
      <CommercialFeedback state={feedback} />
    </div>
  );
}

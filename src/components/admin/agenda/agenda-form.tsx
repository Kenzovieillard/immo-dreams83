"use client";

import { useRef, useState, type ReactNode } from "react";
import { CalendarPlus } from "lucide-react";
import { CommercialDialog } from "@/components/commercial/commercial-design-ui";
import {
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import {
  agendaChecklist,
  agendaEntryInput,
  agendaPriorities,
  agendaTaskTypes,
  agendaTypes,
  type AgendaDetails,
  type AgendaEntry,
  type AgendaEntryInput,
  type AgendaOption,
  type AgendaReference,
  type AgendaType,
} from "@/lib/agenda";
import { parisClock, parisInput, parisInstant } from "@/lib/agenda-time";
import { AgendaLookup } from "./agenda-lookup";
import { AgendaRequestError, mutateAgenda } from "./agenda-request";

const secondary = `${commercialSecondaryButton} min-h-11`;
const primary = `${commercialPrimaryButton} min-h-11`;
const field = `${fieldClass} w-full`;
const reminders = [
  [0, "À l’heure prévue"],
  [10, "10 minutes avant"],
  [15, "15 minutes avant"],
  [30, "30 minutes avant"],
  [60, "1 heure avant"],
  [1440, "1 jour avant"],
  [10080, "7 jours avant"],
] as const;
export { reminders };

export function AgendaField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 content-start gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-[#943f37]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export type AgendaEditor = {
  type?: AgendaType;
  time: string;
  existing?: AgendaEntry;
  copy?: AgendaEntry;
  reference?: AgendaReference;
  appointmentId?: string;
  contact?: AgendaOption | null;
  property?: AgendaOption | null;
};
function endFromStart(start: string, duration: number) {
  const instant = parisInstant(start);
  return instant
    ? parisInput(
        new Date(Date.parse(instant) + duration * 60_000).toISOString(),
      )
    : "";
}
const durations: Record<AgendaType, number> = {
  CALL: 15,
  MEETING: 60,
  ESTIMATION: 60,
  VISIT: 60,
  FOLLOW_UP: 15,
  SIGNATURE: 60,
  TASK: 30,
};

export function AgendaForm({
  initial,
  team,
  assignee,
  viewerId,
  now,
  onClose,
  onSaved,
}: {
  initial: AgendaEditor;
  team: AgendaOption[];
  assignee: string;
  viewerId: string;
  now: Date;
  onClose: () => void;
  onSaved: (
    entry: Pick<AgendaEntry, "id" | "source">,
    date: string | null,
  ) => void;
}) {
  const previous = initial.existing ?? initial.copy;
  const [type, setType] = useState<AgendaType | "">(
    initial.type ?? previous?.type ?? "",
  );
  const [title, setTitle] = useState(previous?.title ?? "");
  const [notes, setNotes] = useState(previous?.notes ?? "");
  const [location, setLocation] = useState(previous?.location ?? "");
  const [contact, setContact] = useState<AgendaOption | null>(
    initial.contact ?? initial.reference?.contact ?? null,
  );
  const [property, setProperty] = useState<AgendaOption | null>(
    initial.property ?? initial.reference?.property ?? null,
  );
  const [seller, setSeller] = useState<AgendaOption | null>(
    initial.reference?.seller ?? null,
  );
  const [estimate, setEstimate] = useState<AgendaOption | null>(null);
  const [member, setMember] = useState(
    previous?.assigneeId ?? assignee ?? viewerId,
  );
  const [start, setStart] = useState(
    initial.existing?.startsAt
      ? parisInput(initial.existing.startsAt)
      : initial.time,
  );
  const [end, setEnd] = useState(
    initial.existing?.endsAt
      ? parisInput(initial.existing.endsAt)
      : endFromStart(start, durations[type || "MEETING"]),
  );
  const [due, setDue] = useState(
    initial.existing?.dueAt ? parisInput(initial.existing.dueAt) : "",
  );
  const [priority, setPriority] = useState<AgendaEntry["priority"]>(
    previous?.priority ?? "normal",
  );
  const [taskType, setTaskType] = useState<AgendaEntry["taskType"]>(
    previous?.taskType ?? "ADMIN",
  );
  const [reminder, setReminder] = useState<number | null>(
    initial.existing?.reminderMinutes ?? null,
  );
  const [details, setDetails] = useState<AgendaDetails>(() => {
    const data = { ...previous?.details };
    delete data.cancelReason;
    return data;
  });
  const [dirty, setDirty] = useState(false);
  const [abandon, setAbandon] = useState(false);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<{
    startsAt: string;
    endsAt: string;
  } | null>(null);
  const lock = useRef(false);
  const requestId = useRef<string | null>(null);

  function change() {
    requestId.current = null;
    setDirty(true);
    setConflict(null);
    setFields({});
  }
  function setDetail<K extends keyof AgendaDetails>(
    key: K,
    value: AgendaDetails[K],
  ) {
    change();
    setDetails((previous) => ({ ...previous, [key]: value }));
  }
  function chooseType(value: AgendaType) {
    change();
    setType(value);
    setEnd(endFromStart(start, durations[value]));
  }
  function chooseEstimate(value: AgendaOption | null) {
    change();
    setEstimate(value);
    if (!value) return;
    const effective = value.startsAt ? parisInput(value.startsAt) : start;
    setStart(effective);
    setEnd(endFromStart(effective, value.duration ?? 60));
    if (value.assigneeId && team.some(({ id }) => id === value.assigneeId))
      setMember(value.assigneeId);
    if (value.location) setLocation(value.location);
  }
  function chooseContact(value: AgendaOption | null) {
    change();
    setContact(value);
    if (type === "CALL")
      setDetails((previous) => ({ ...previous, phone: value?.phone ?? "" }));
  }
  function reschedule(nextStart: string) {
    change();
    const currentStart = parisInstant(start, initial.existing?.startsAt);
    const currentEnd = parisInstant(end, initial.existing?.endsAt);
    const duration =
      currentStart && currentEnd
        ? Math.max(
            5,
            (Date.parse(currentEnd) - Date.parse(currentStart)) / 60_000,
          )
        : durations[type || "MEETING"];
    setStart(nextStart);
    setEnd(endFromStart(nextStart, duration));
  }
  function requestClose() {
    if (lock.current) return;
    if (dirty) setAbandon(true);
    else onClose();
  }

  async function submit(acceptConflict = false) {
    if (!type || lock.current) return;
    const isTask = type === "TASK";
    const startsAt = isTask
      ? null
      : parisInstant(start, initial.existing?.startsAt);
    const endsAt = isTask ? null : parisInstant(end, initial.existing?.endsAt);
    const dueAt =
      isTask && due ? parisInstant(due, initial.existing?.dueAt) : null;
    if (isTask ? due && !dueAt : !startsAt || !endsAt) {
      setFields({
        [isTask ? "dueAt" : !startsAt ? "startsAt" : "endsAt"]:
          "Indiquez une date et une heure existantes à Paris.",
      });
      return;
    }
    const entry: AgendaEntryInput = {
      id:
        initial.existing?.id ??
        (type === "ESTIMATION" ? estimate?.id : undefined),
      source:
        initial.existing?.source ??
        (isTask
          ? "task"
          : type === "ESTIMATION"
            ? "estimation"
            : "appointment"),
      type,
      title,
      notes,
      location,
      assigneeId: member || viewerId,
      contactId: contact?.id ?? null,
      propertyId: property?.id ?? null,
      appointmentId:
        initial.appointmentId ?? initial.existing?.appointmentId ?? null,
      startsAt,
      endsAt,
      dueAt,
      priority,
      taskType,
      reminderMinutes: reminder,
      details: {
        ...details,
        sellerId: seller?.id ?? null,
        ...(type === "FOLLOW_UP" ? { priority } : {}),
      },
    };
    const valid = agendaEntryInput.safeParse(entry);
    if (!valid.success) {
      setFields(
        Object.fromEntries(
          valid.error.issues.map((issue) => [
            issue.path.at(-1) ?? "form",
            issue.message,
          ]),
        ),
      );
      setFeedback("Vérifiez les champs indiqués.");
      return;
    }
    lock.current = true;
    setWorking(true);
    setFeedback("");
    setFields({});
    try {
      requestId.current ??= crypto.randomUUID();
      const response = await mutateAgenda({
        operation: "save",
        requestId: requestId.current,
        acceptConflict,
        expectedUpdatedAt: initial.existing?.updatedAt ?? estimate?.revision,
        entry: valid.data,
      });
      onSaved(response.result, (isTask ? due : start).slice(0, 10) || null);
    } catch (error) {
      if (error instanceof AgendaRequestError) {
        setFields(error.data.fields ?? {});
        setConflict(error.data.conflict ?? null);
      }
      setFeedback(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }

  const isTask = type === "TASK";
  const isEstimate = type === "ESTIMATION";
  const estimateInfo = estimate?.estimation ?? initial.existing?.estimation;
  const visit = type === "VISIT";
  const signature = type === "SIGNATURE";
  const call = type === "CALL";
  const followUp = type === "FOLLOW_UP";
  const checklist = isEstimate
    ? agendaChecklist.ESTIMATION
    : signature
      ? agendaChecklist.SIGNATURE
      : [];
  const startInstant = parisInstant(start);
  const past =
    !isTask && type && startInstant && Date.parse(startInstant) < +now;
  const dialogTitle = abandon
    ? "Abandonner la saisie ?"
    : initial.existing
      ? `Modifier · ${agendaTypes[initial.existing.type]}`
      : initial.copy
        ? "Dupliquer l’activité"
        : isTask
          ? "Nouvelle tâche"
          : type
            ? `Créer · ${agendaTypes[type]}`
            : "Nouvel événement";

  return (
    <CommercialDialog
      title={dialogTitle}
      dismissible={!working}
      onClose={abandon ? () => setAbandon(false) : requestClose}
    >
      {abandon ? (
        <div className="grid gap-3">
          <p>
            Les modifications depuis le dernier enregistrement seront perdues.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primary}
              onClick={() => setAbandon(false)}
            >
              Continuer la saisie
            </button>
            <button type="button" className={secondary} onClick={onClose}>
              Quitter sans enregistrer
            </button>
          </div>
        </div>
      ) : !type ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(agendaTypes)
            .filter(([key]) => key !== "TASK")
            .map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={secondary}
                onClick={() => chooseType(key as AgendaType)}
              >
                <CalendarPlus className="size-4" />
                {label}
              </button>
            ))}
        </div>
      ) : (
        <form
          className="grid min-w-0 gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          <fieldset disabled={working} className="grid min-w-0 gap-4">
            {!initial.existing && !initial.copy && !isTask ? (
              <AgendaField label="Type d’événement">
                <select
                  className={field}
                  value={type}
                  onChange={(event) =>
                    chooseType(event.target.value as AgendaType)
                  }
                >
                  {Object.entries(agendaTypes)
                    .filter(([key]) => key !== "TASK")
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </AgendaField>
            ) : null}
            {isEstimate && !initial.existing ? (
              <AgendaLookup
                label="Estimation existante"
                kind="estimation"
                value={estimate}
                onChange={chooseEstimate}
                required
                error={fields.estimation}
              />
            ) : null}
            {isEstimate && estimateInfo ? (
              <p className="rounded-lg bg-[#ebece5] p-3 text-sm">
                {estimateInfo.propertyType}
                {estimateInfo.surface
                  ? ` · ${estimateInfo.surface} m²`
                  : " · Surface non renseignée"}
              </p>
            ) : null}
            {!isEstimate ? (
              <AgendaField
                label={
                  call
                    ? "Objet de l’appel *"
                    : followUp
                      ? "Motif de la relance *"
                      : visit
                        ? "Intitulé de la visite"
                        : "Intitulé *"
                }
                error={fields.title}
              >
                <input
                  className={field}
                  value={title}
                  maxLength={180}
                  onChange={(e) => {
                    change();
                    setTitle(e.target.value);
                  }}
                />
              </AgendaField>
            ) : null}
            <AgendaField label="Responsable *" error={fields.assigneeId}>
              <select
                className={field}
                value={member || viewerId}
                onChange={(e) => {
                  change();
                  setMember(e.target.value);
                }}
              >
                {team.some(({ id }) => id === viewerId) ? null : (
                  <option value={viewerId}>Moi</option>
                )}
                {team.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </AgendaField>
            {!isEstimate ? (
              <AgendaLookup
                label={
                  signature
                    ? "Acquéreur"
                    : visit
                      ? "Contact acquéreur"
                      : "Contact"
                }
                kind="contact"
                value={contact}
                onChange={chooseContact}
                required={call || visit || followUp || signature}
                error={fields.contactId}
              />
            ) : null}
            {signature ? (
              <AgendaLookup
                label="Vendeur"
                kind="contact"
                value={seller}
                onChange={(value) => {
                  change();
                  setSeller(value);
                }}
                required
                error={fields.sellerId}
              />
            ) : null}
            {call ? (
              <AgendaField label="Téléphone pour cet appel">
                <input
                  type="tel"
                  className={field}
                  value={details.phone ?? contact?.phone ?? ""}
                  onChange={(e) => setDetail("phone", e.target.value)}
                />
                {contact && !contact.phone && !details.phone ? (
                  <span className="text-xs text-[#835719]">
                    Ce contact n’a pas de téléphone renseigné.
                  </span>
                ) : null}
              </AgendaField>
            ) : null}
            {(!isEstimate && !followUp) || property ? (
              <AgendaLookup
                label="Bien associé"
                kind="property"
                value={property}
                onChange={(value) => {
                  change();
                  setProperty(value);
                  if (value?.location && !location) setLocation(value.location);
                }}
                required={visit || signature}
                error={fields.propertyId}
              />
            ) : null}
            {type === "MEETING" ? (
              <AgendaField label="Type de rendez-vous">
                <select
                  className={field}
                  value={details.meetingType ?? ""}
                  onChange={(event) =>
                    setDetail(
                      "meetingType",
                      (event.target.value ||
                        undefined) as AgendaDetails["meetingType"],
                    )
                  }
                >
                  <option value="">Sélectionner</option>
                  {[
                    "Découverte",
                    "Suivi de dossier",
                    "Rendez-vous agence",
                    "Autre",
                  ].map((label) => (
                    <option key={label}>{label}</option>
                  ))}
                </select>
              </AgendaField>
            ) : null}
            {signature ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <AgendaField label="Type d’acte *" error={fields.act}>
                  <select
                    className={field}
                    value={details.act ?? ""}
                    onChange={(e) =>
                      setDetail(
                        "act",
                        (e.target.value || undefined) as AgendaDetails["act"],
                      )
                    }
                  >
                    <option value="">Sélectionner</option>
                    {[
                      "Compromis",
                      "Promesse de vente",
                      "Acte authentique",
                      "Autre",
                    ].map((label) => (
                      <option key={label}>{label}</option>
                    ))}
                  </select>
                </AgendaField>
                <AgendaField label="Notaire">
                  <input
                    className={field}
                    value={details.notary ?? ""}
                    maxLength={160}
                    onChange={(e) => setDetail("notary", e.target.value)}
                  />
                </AgendaField>
              </div>
            ) : null}
            {!isTask && !call && !followUp ? (
              <AgendaField
                label={isEstimate ? "Adresse du rendez-vous" : "Lieu"}
                error={fields.location}
              >
                <input
                  className={field}
                  value={location}
                  maxLength={300}
                  onChange={(e) => {
                    change();
                    setLocation(e.target.value);
                  }}
                />
              </AgendaField>
            ) : null}
            {isTask ? (
              <AgendaField label="Échéance" error={fields.dueAt}>
                <input
                  type="datetime-local"
                  className={field}
                  value={due}
                  onChange={(e) => {
                    change();
                    setDue(e.target.value);
                  }}
                />
              </AgendaField>
            ) : (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <AgendaField label="Début *" error={fields.startsAt}>
                  <input
                    type="datetime-local"
                    className={field}
                    value={start}
                    onChange={(e) => reschedule(e.target.value)}
                  />
                </AgendaField>
                <AgendaField label="Fin *" error={fields.endsAt}>
                  <input
                    type="datetime-local"
                    className={field}
                    value={end}
                    onChange={(e) => {
                      change();
                      setEnd(e.target.value);
                    }}
                  />
                </AgendaField>
              </div>
            )}
            {past ? (
              <p className="rounded-lg bg-[#fff3d9] p-2 text-xs text-[#604412]">
                Cette date est passée. L’activité pourra être enregistrée puis
                marquée terminée.
              </p>
            ) : null}
            {isTask ? (
              <AgendaField label="Catégorie">
                <select
                  value={taskType}
                  className={field}
                  onChange={(e) => {
                    change();
                    setTaskType(e.target.value as AgendaEntry["taskType"]);
                  }}
                >
                  {Object.entries(agendaTaskTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </AgendaField>
            ) : null}
            {isTask || followUp ? (
              <AgendaField label="Priorité">
                <select
                  value={priority}
                  className={field}
                  onChange={(e) => {
                    change();
                    setPriority(e.target.value as AgendaEntry["priority"]);
                  }}
                >
                  {Object.entries(agendaPriorities).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </AgendaField>
            ) : null}
            {followUp ? (
              <>
                <AgendaField
                  label="Canal de relance manuelle *"
                  error={fields.channel}
                >
                  <select
                    className={field}
                    value={details.channel ?? ""}
                    onChange={(e) =>
                      setDetail(
                        "channel",
                        (e.target.value ||
                          undefined) as AgendaDetails["channel"],
                      )
                    }
                  >
                    <option value="">Sélectionner</option>
                    <option value="phone">Téléphone</option>
                    <option value="email">E-mail</option>
                    <option value="sms">SMS</option>
                  </select>
                </AgendaField>
                <AgendaField label="Message préparé">
                  <textarea
                    className={`${field} min-h-20 py-2`}
                    value={details.message ?? ""}
                    maxLength={3000}
                    onChange={(e) => setDetail("message", e.target.value)}
                  />
                </AgendaField>
                <p className="text-xs text-[#59645f]">
                  Le message est conservé dans l’activité. L’envoi se fait
                  manuellement.
                </p>
              </>
            ) : null}
            <AgendaField
              label={isTask ? "Description" : "Notes"}
              error={fields.notes}
            >
              <textarea
                className={`${field} min-h-24 py-2`}
                value={notes}
                maxLength={5000}
                onChange={(e) => {
                  change();
                  setNotes(e.target.value);
                }}
              />
            </AgendaField>
            {checklist.length ? (
              <fieldset className="grid gap-2 rounded-xl border border-[#dfddd4] p-3">
                <legend className="px-1 text-sm font-semibold">
                  {signature ? "Documents reçus" : "Documents à préparer"}
                </legend>
                {checklist.map((label) => (
                  <label
                    key={label}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={details.checklist?.includes(label) ?? false}
                      onChange={(e) =>
                        setDetail(
                          "checklist",
                          e.target.checked
                            ? [...(details.checklist ?? []), label]
                            : (details.checklist ?? []).filter(
                                (value) => value !== label,
                              ),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {visit ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={details.nextDayFollowup ?? false}
                  onChange={(e) =>
                    setDetail("nextDayFollowup", e.target.checked)
                  }
                />
                Créer une tâche de relance le lendemain à 9 h
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={reminder !== null}
                onChange={(e) => {
                  change();
                  setReminder(e.target.checked ? 15 : null);
                }}
              />
              Rappel interne au responsable
            </label>
            {reminder !== null ? (
              <AgendaField label="Délai du rappel">
                <select
                  value={reminder}
                  className={field}
                  onChange={(e) => {
                    change();
                    setReminder(Number(e.target.value));
                  }}
                >
                  {reminders.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </AgendaField>
            ) : null}
          </fieldset>
          {feedback ? (
            <div
              role="alert"
              className="rounded-lg border border-[#e3b69a] bg-[#fff3e5] p-3 text-sm"
            >
              <p>{feedback}</p>
              {conflict ? (
                <p className="mt-1">
                  Créneau déjà occupé de {parisClock(conflict.startsAt)} à{" "}
                  {parisClock(conflict.endsAt)}.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-[#dfddd4] pt-4">
            <button
              type="button"
              className={secondary}
              onClick={requestClose}
              disabled={working}
            >
              Annuler
            </button>
            {conflict ? (
              <button
                type="button"
                className={secondary}
                disabled={working}
                onClick={() => void submit(true)}
              >
                Enregistrer malgré le conflit
              </button>
            ) : null}
            <button type="submit" className={primary} disabled={working}>
              {working ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}
    </CommercialDialog>
  );
}

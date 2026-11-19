"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  CalendarRange,
  Check,
  Copy,
  ExternalLink,
  Mail,
  X,
} from "lucide-react";
import { CommercialDialog } from "@/components/commercial/commercial-design-ui";
import {
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import {
  agendaIsClosed,
  agendaPriorities,
  agendaStatuses,
  agendaTaskTypes,
  agendaTypes,
  type AgendaData,
  type AgendaEntry,
  type AgendaReference,
} from "@/lib/agenda";
import { agendaReminderAt, parisDay } from "@/lib/agenda-time";
import { AgendaField, reminders } from "./agenda-form";

export const agendaDrawerTabs = [
  "Informations",
  "Contact",
  "Bien",
  "Responsable",
  "Rappels",
  "Actions",
] as const;
export type AgendaDrawerTab = (typeof agendaDrawerTabs)[number];

export type AgendaQuickAction = {
  operation: "complete" | "reopen" | "cancel" | "delete" | "reminder";
  reason?: string;
  confirm?: boolean;
  reminderMinutes?: number | null;
};
const fmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const secondary = `${commercialSecondaryButton} min-h-11 justify-start`;
const primary = `${commercialPrimaryButton} min-h-11 justify-start`;

function Value({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid gap-1 text-sm">
      <span className="text-xs font-semibold text-[#59645f]">{label}</span>
      <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        {value || "Non renseigné"}
      </span>
    </div>
  );
}
function mailLink(email: string, message?: string) {
  const address = encodeURIComponent(email).replace(/%40/g, "@");
  return `mailto:${address}${message ? `?body=${encodeURIComponent(message)}` : ""}`;
}

export function AgendaDrawer({
  item,
  reference,
  viewer,
  initialTab,
  loading,
  error,
  busy,
  now,
  onClose,
  onRetry,
  onEdit,
  onCopy,
  onTask,
  onAction,
}: {
  item: AgendaEntry;
  reference: AgendaReference | null;
  viewer: AgendaData["viewer"];
  initialTab: AgendaDrawerTab;
  loading: boolean;
  error: string;
  busy: boolean;
  now: Date;
  onClose: () => void;
  onRetry: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onTask: () => void;
  onAction: (action: AgendaQuickAction) => Promise<boolean>;
}) {
  const [tab, setTab] = useState(initialTab);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const closed = agendaIsClosed(item);
  const contact = reference?.contact;
  const property = reference?.property;
  const assignee = reference?.assignee;
  const reminder = agendaReminderAt(item);
  const isTask = item.source === "task";
  const start = item.startsAt ?? item.dueAt;
  const duration =
    item.startsAt && item.endsAt
      ? Math.round(
          (Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60000,
        )
      : null;
  const email =
    contact?.email && /^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(contact.email)
      ? contact.email
      : null;
  const writable = viewer.canWrite;
  const canFinish =
    isTask || Boolean(item.startsAt && Date.parse(item.startsAt) <= +now);
  const canLinkTask = item.source === "appointment" && !closed;

  return (
    <CommercialDialog
      title={
        confirm === "delete"
          ? "Supprimer cette activité ?"
          : confirm === "cancel"
            ? "Annuler cette activité ?"
            : item.title
      }
      drawer
      onClose={onClose}
      dismissible={!busy}
    >
      {error ? (
        <div
          role="alert"
          className="mb-3 grid gap-2 rounded-xl bg-[#f8e6e2] p-3 text-sm text-[#943f37]"
        >
          {error}
          <button type="button" className="w-fit underline" onClick={onRetry}>
            Recharger l’activité
          </button>
        </div>
      ) : null}
      {loading ? (
        <p role="status" className="mb-3 text-sm text-[#59645f]">
          Chargement des informations liées…
        </p>
      ) : null}
      {busy ? (
        <p role="status" className="mb-3 text-sm text-[#59645f]">
          Enregistrement…
        </p>
      ) : null}
      {confirm ? (
        <div className="grid gap-4">
          <strong className="[overflow-wrap:anywhere]">{item.title}</strong>
          <p className="text-sm">
            {confirm === "delete"
              ? "La suppression est définitive. Les activités liées à un dossier commercial doivent être annulées depuis le parcours prévu."
              : "L’activité restera dans l’historique et ses rappels futurs seront désactivés."}
          </p>
          {confirm === "cancel" ? (
            <AgendaField label="Motif (facultatif)">
              <textarea
                className={fieldClass}
                maxLength={400}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </AgendaField>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondary}
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Retour
            </button>
            <button
              type="button"
              className={`${primary} bg-[#943f37]`}
              disabled={busy}
              onClick={() =>
                void onAction({
                  operation: confirm,
                  reason,
                  confirm: true,
                }).then((ok) => {
                  if (ok) setConfirm(null);
                })
              }
            >
              {confirm === "delete"
                ? "Supprimer définitivement"
                : "Confirmer l’annulation"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-[#59645f]">
            Réf. {item.id.slice(0, 8).toUpperCase()} ·{" "}
            {agendaStatuses[item.status]}
          </p>
          <nav
            aria-label="Rubriques de l’activité"
            className="mb-5 flex flex-wrap gap-1 border-b border-[#dfddd4] pb-2"
          >
            {agendaDrawerTabs.map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={label === tab}
                className={`min-h-10 rounded-lg px-2 text-sm ${tab === label ? "bg-[#dce5d7] font-semibold" : "text-[#59645f]"}`}
                onClick={() => setTab(label)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="grid min-w-0 gap-4">
            {tab === "Informations" ? (
              <>
                <Value label="Type" value={agendaTypes[item.type]} />
                <Value label="Statut" value={agendaStatuses[item.status]} />
                <Value
                  label={isTask ? "Échéance" : "Date et heure"}
                  value={start ? fmt.format(new Date(start)) : null}
                />
                {duration !== null ? (
                  <Value label="Durée" value={`${duration} min`} />
                ) : null}
                {item.location ? (
                  <Value label="Lieu" value={item.location} />
                ) : null}
                <Value
                  label={isTask ? "Description" : "Notes"}
                  value={item.notes}
                />
                {item.details.cancelReason ? (
                  <Value
                    label="Motif d’annulation"
                    value={item.details.cancelReason}
                  />
                ) : null}
                {isTask ? (
                  <>
                    <Value
                      label="Priorité"
                      value={agendaPriorities[item.priority]}
                    />
                    <Value
                      label="Catégorie"
                      value={agendaTaskTypes[item.taskType]}
                    />
                  </>
                ) : null}
                {item.type === "FOLLOW_UP" ? (
                  <Value
                    label="Priorité"
                    value={agendaPriorities[item.priority]}
                  />
                ) : null}
                {item.details.act ? (
                  <Value label="Acte" value={item.details.act} />
                ) : null}
                {item.details.notary ? (
                  <Value label="Notaire" value={item.details.notary} />
                ) : null}
                {item.details.meetingType ? (
                  <Value
                    label="Type de rendez-vous"
                    value={item.details.meetingType}
                  />
                ) : null}
                {item.details.channel ? (
                  <Value
                    label="Canal de relance"
                    value={
                      { phone: "Téléphone", email: "E-mail", sms: "SMS" }[
                        item.details.channel
                      ]
                    }
                  />
                ) : null}
                {item.details.message ? (
                  <Value label="Message préparé" value={item.details.message} />
                ) : null}
                {item.details.checklist?.length ? (
                  <Value
                    label="Pièces cochées"
                    value={item.details.checklist.join("\n")}
                  />
                ) : null}
                {item.type === "VISIT" ? (
                  <Link
                    className={secondary}
                    href={`/commercial/visites/${item.id}`}
                  >
                    Voir la visite <ExternalLink className="size-4" />
                  </Link>
                ) : null}
                {item.type === "VISIT" &&
                item.status === "completed" &&
                writable ? (
                  <Link
                    className={secondary}
                    href={`/commercial/visites/${item.id}/compte-rendu`}
                  >
                    Ouvrir le compte rendu
                  </Link>
                ) : null}
                {item.source === "estimation" ? (
                  <Link
                    className={secondary}
                    href={`/commercial/estimations/${item.id}`}
                  >
                    Voir l’estimation <ExternalLink className="size-4" />
                  </Link>
                ) : null}
                {item.appointmentId ? (
                  <Link
                    className={secondary}
                    href={`/admin?tab=agenda&source=appointment&entry=${item.appointmentId}&date=${start ? parisDay(start) : parisDay()}`}
                  >
                    Voir l’événement lié
                  </Link>
                ) : null}
                {writable && !closed ? (
                  <button
                    type="button"
                    className={secondary}
                    onClick={onEdit}
                    disabled={busy}
                  >
                    Modifier
                  </button>
                ) : null}
              </>
            ) : null}
            {tab === "Contact" ? (
              contact ? (
                <>
                  <Value
                    label={item.type === "SIGNATURE" ? "Acquéreur" : "Contact"}
                    value={contact.label}
                  />
                  {contact.city ? (
                    <Value label="Localisation" value={contact.city} />
                  ) : null}
                  {contact.phone || item.details.phone ? (
                    <a
                      className="w-fit text-sm underline"
                      href={`tel:${(item.details.phone || contact.phone || "").replace(/[^\d+]/g, "")}`}
                    >
                      {item.details.phone || contact.phone}
                    </a>
                  ) : null}
                  {email ? (
                    <a
                      className="w-fit text-sm underline"
                      href={mailLink(email, item.details.message)}
                    >
                      {email}
                    </a>
                  ) : null}
                  {reference?.seller ? (
                    <Value label="Vendeur" value={reference.seller.label} />
                  ) : null}
                  <Link
                    className={secondary}
                    href={`/admin?tab=contacts&contact=${contact.id}`}
                  >
                    Ouvrir la fiche contact
                  </Link>
                  <section
                    aria-label="Historique du contact"
                    className="grid gap-2 border-t border-[#dfddd4] pt-3"
                  >
                    <h3 className="text-sm font-semibold">
                      Interactions récentes
                    </h3>
                    {contact.timeline.length ? (
                      contact.timeline.map((entry) => (
                        <div key={entry.id} className="text-sm">
                          {entry.label}
                          <span className="block text-xs text-[#59645f]">
                            {fmt.format(new Date(entry.date))}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#59645f]">
                        Aucune interaction dans votre périmètre.
                      </p>
                    )}
                  </section>
                </>
              ) : (
                <p className="text-sm text-[#59645f]">
                  Aucun contact accessible pour cette activité.
                </p>
              )
            ) : null}
            {tab === "Bien" ? (
              property ? (
                <>
                  {property.photo ? (
                    <div className="relative h-40 overflow-hidden rounded-xl bg-[#ebece5]">
                      <Image
                        src={property.photo}
                        unoptimized
                        fill
                        sizes="390px"
                        alt={property.label}
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <Value label="Bien" value={property.label} />
                  <Value label="Localisation" value={property.note} />
                  <Value label="Prix" value={euros.format(property.price)} />
                  <Value label="Surface" value={`${property.surface} m²`} />
                  {property.rooms !== null ? (
                    <Value label="Pièces" value={String(property.rooms)} />
                  ) : null}
                  {property.land !== null ? (
                    <Value label="Terrain" value={`${property.land} m²`} />
                  ) : null}
                  {property.archived ? (
                    <p className="text-sm text-[#59645f]">Bien archivé</p>
                  ) : null}
                  <Link
                    className={secondary}
                    href={`/admin?tab=properties&property=${property.id}`}
                  >
                    Ouvrir la fiche bien
                  </Link>
                </>
              ) : (
                <p className="text-sm text-[#59645f]">
                  Aucun bien accessible pour cette activité.
                </p>
              )
            ) : null}
            {tab === "Responsable" ? (
              assignee ? (
                <>
                  <Value label="Responsable" value={assignee.label} />
                  <Value
                    label="Fonction"
                    value={
                      {
                        ADMIN: "Administration",
                        DIRECTOR: "Direction",
                        AGENT: "Conseiller",
                        ASSISTANT: "Assistance",
                      }[assignee.role] ?? assignee.role
                    }
                  />
                  <Value label="E-mail" value={assignee.email} />
                  <Value
                    label="Événements cette semaine"
                    value={String(assignee.weekEvents)}
                  />
                  <Value
                    label="Tâches terminées cette semaine"
                    value={String(assignee.weekCompletedTasks)}
                  />
                  {viewer.canAssign && !closed ? (
                    <button
                      type="button"
                      className={secondary}
                      onClick={onEdit}
                      disabled={busy}
                    >
                      Changer de responsable
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-[#59645f]">
                  Activité sans responsable actif.
                </p>
              )
            ) : null}
            {tab === "Rappels" ? (
              <>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Bell className="size-4" />
                  Notification dans l’Agenda
                </h3>
                <Value
                  label="Destinataire"
                  value={assignee?.label ?? item.assignee}
                />
                <Value
                  label="Rappel"
                  value={
                    reminder ? fmt.format(new Date(reminder)) : "Désactivé"
                  }
                />
                {writable && !closed && start ? (
                  <AgendaField label="Programmer un rappel au responsable">
                    <select
                      value={item.reminderMinutes ?? ""}
                      className={fieldClass}
                      disabled={busy}
                      onChange={(event) =>
                        void onAction({
                          operation: "reminder",
                          reminderMinutes:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                    >
                      <option value="">Désactivé</option>
                      {reminders.map(([minutes, label]) => (
                        <option key={minutes} value={minutes}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </AgendaField>
                ) : null}
                <p className="text-sm text-[#59645f]">
                  Notifications mobiles, e-mails et SMS automatiques
                  indisponibles. Canal externe à configurer.
                </p>
              </>
            ) : null}
            {tab === "Actions" ? (
              writable ? (
                <>
                  {!closed ? (
                    <>
                      <button
                        type="button"
                        className={primary}
                        disabled={busy || !canFinish}
                        onClick={() => void onAction({ operation: "complete" })}
                      >
                        <Check className="size-4" />
                        Marquer comme terminé
                      </button>
                      {!canFinish ? (
                        <p className="text-xs text-[#59645f]">
                          L’activité peut être terminée à partir de son heure de
                          début.
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className={secondary}
                        disabled={busy}
                        onClick={onEdit}
                      >
                        <CalendarRange className="size-4" />
                        {isTask
                          ? "Modifier ou reporter l’échéance"
                          : "Modifier ou reporter l’événement"}
                      </button>
                      <button
                        type="button"
                        className={secondary}
                        disabled={busy}
                        onClick={() => setConfirm("cancel")}
                      >
                        <X className="size-4" />
                        Annuler l’activité
                      </button>
                    </>
                  ) : isTask && item.status === "completed" ? (
                    <button
                      type="button"
                      className={primary}
                      disabled={busy}
                      onClick={() => void onAction({ operation: "reopen" })}
                    >
                      Rouvrir la tâche
                    </button>
                  ) : null}
                  {item.source !== "estimation" ? (
                    <button
                      type="button"
                      className={secondary}
                      disabled={busy}
                      onClick={onCopy}
                    >
                      <Copy className="size-4" />
                      Dupliquer l’activité
                    </button>
                  ) : null}
                  {email ? (
                    <a
                      className={secondary}
                      href={mailLink(email, item.details.message)}
                    >
                      <Mail className="size-4" />
                      Préparer un e-mail à {contact?.label}
                    </a>
                  ) : null}
                  {canLinkTask ? (
                    <button
                      type="button"
                      className={secondary}
                      disabled={busy}
                      onClick={onTask}
                    >
                      <Bell className="size-4" />
                      Créer une tâche liée
                    </button>
                  ) : null}
                  {viewer.canDelete ? (
                    <button
                      type="button"
                      className={`${secondary} border-[#cf9e96] text-[#943f37]`}
                      disabled={busy}
                      onClick={() => setConfirm("delete")}
                    >
                      Supprimer cette activité
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-[#59645f]">
                  Vous disposez d’un accès en lecture seule.
                </p>
              )
            ) : null}
          </div>
        </>
      )}
    </CommercialDialog>
  );
}

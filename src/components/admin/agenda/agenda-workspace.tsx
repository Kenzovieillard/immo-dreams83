"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarPlus,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { BentoCardSkeleton } from "@/components/admin/bento/bento-states";
import { CommercialDialog } from "@/components/commercial/commercial-design-ui";
import {
  CommercialPanel,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import {
  agendaIsClosed,
  agendaViews,
  type AgendaData,
  type AgendaEntry,
  type AgendaOption,
  type AgendaReference,
  type AgendaSource,
  type AgendaView,
} from "@/lib/agenda";
import {
  agendaRange,
  agendaReminderAt,
  dayDate,
  dayLabel,
  monthLabel,
  parisDay,
  shiftAgendaDay,
  shiftAgendaMonth,
  validAgendaDay,
} from "@/lib/agenda-time";
import { cn } from "@/lib/utils";
import { AgendaDayList, AgendaMonth, AgendaTimeline } from "./agenda-calendar";
import {
  AgendaDrawer,
  type AgendaDrawerTab,
  type AgendaQuickAction,
} from "./agenda-drawer";
import { AgendaForm, type AgendaEditor } from "./agenda-form";
import {
  agendaRequest,
  AgendaRequestError,
  mutateAgenda,
} from "./agenda-request";
import { AgendaSideTasks, AgendaTasks } from "./agenda-tasks";
import styles from "./agenda.module.css";

const labels: Record<AgendaView, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
  tasks: "Tâches",
};
const primary = `${commercialPrimaryButton} min-h-11`;
const secondary = `${commercialSecondaryButton} min-h-11`;
const asDate = (value: string | null) =>
  value && validAgendaDay(value) ? value : parisDay();
const asView = (value: string | null) =>
  agendaViews.includes(value as AgendaView) ? (value as AgendaView) : "day";
const isSource = (value: string | null): value is AgendaSource =>
  value === "appointment" || value === "estimation" || value === "task";
const dateShort = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const noticeTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
  timeStyle: "short",
});

function changeQuery(values: Record<string, string | null>, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "agenda");
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (url.href === window.location.href) return;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

export function AgendaWorkspace({ onChanged }: { onChanged: () => void }) {
  const search = useSearchParams();
  const date = asDate(search.get("date"));
  const view = asView(search.get("view"));
  const assignee = search.get("assignee") ?? "";
  const selectedId = search.get("entry");
  const source = search.get("source");
  const selectedKey =
    selectedId && isSource(source) ? `${source}:${selectedId}` : "";
  const initialPane: AgendaDrawerTab =
    search.get("section") === "actions" ? "Actions" : "Informations";
  const context = `${date}:${view}:${assignee}`;
  const [data, setData] = useState<{
    context: string;
    value: AgendaData;
    revision: number;
  } | null>(null);
  const [detail, setDetail] = useState<{
    key: string;
    item: AgendaEntry;
    reference: AgendaReference;
  } | null>(null);
  const [failed, setFailed] = useState<{
    context: string;
    message: string;
  } | null>(null);
  const [detailFailed, setDetailFailed] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [actionError, setActionError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<AgendaEditor | null>(null);
  const remembered = useRef<{ key: string; requestId: string } | null>(null);
  const lock = useRef(false);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
      refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    const query = { view, date, ...(assignee ? { assignee } : {}) };
    void agendaRequest<AgendaData>(query, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) {
          setData({ context, value, revision });
          setFailed(null);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setFailed({
            context,
            message:
              error instanceof Error
                ? error.message
                : "Charger l’agenda est impossible.",
          });
      });
    return () => controller.abort();
  }, [context, view, date, assignee, revision]);

  useEffect(() => {
    if (!selectedKey || !selectedId || !isSource(source)) return;
    const controller = new AbortController();
    void agendaRequest<{ item: AgendaEntry; reference: AgendaReference }>(
      { source, entry: selectedId },
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setDetail({ key: selectedKey, ...value });
          setDetailFailed(null);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setDetailFailed({
            key: selectedKey,
            message:
              error instanceof Error
                ? error.message
                : "Charger cette activité est impossible.",
          });
      });
    return () => controller.abort();
  }, [selectedKey, selectedId, source, revision]);

  const current = data?.context === context ? data.value : null;
  const viewer = data?.value.viewer;
  const pending = !current && failed?.context !== context;
  const team = data?.value.assignees ?? [];
  const events = current?.events ?? [];
  const tasks = current?.tasks ?? [];
  const taskCount = tasks.filter((item) => !agendaIsClosed(item)).length;
  const reminders = current?.reminders ?? [];
  const item =
    detail?.key === selectedKey
      ? detail.item
      : [...events, ...tasks, ...reminders].find(
          (item) => `${item.source}:${item.id}` === selectedKey,
        );
  const refs = detail?.key === selectedKey ? detail.reference : null;
  const { first, length } = agendaRange(date, view);
  const title =
    view === "tasks"
      ? "Registre des tâches"
      : view === "month"
        ? monthLabel.format(dayDate(date))
        : view === "week"
          ? `Du ${dateShort.format(dayDate(first))} au ${dateShort.format(dayDate(shiftAgendaDay(first, length - 1)))}`
          : dayLabel.format(dayDate(date));
  const next = (direction: number) =>
    changeQuery({
      date:
        view === "month"
          ? shiftAgendaMonth(date, direction)
          : shiftAgendaDay(date, direction * (view === "week" ? 7 : 1)),
    });
  function begin(input: AgendaEditor) {
    setEditor(input);
    setFeedback("");
  }
  const onAdd = viewer?.canWrite
    ? (time: string) => begin({ time })
    : undefined;
  const closeDetails = () =>
    changeQuery({ entry: null, source: null, section: null });
  function open(item: AgendaEntry, actions = false) {
    setActionError(null);
    changeQuery({
      entry: item.id,
      source: item.source,
      section: actions ? "actions" : null,
    });
  }
  function saved(
    result: Pick<AgendaEntry, "id" | "source">,
    day: string | null,
  ) {
    setEditor(null);
    setFeedback(
      result.source === "task" ? "Tâche enregistrée." : "Événement enregistré.",
    );
    refresh();
    onChanged();
    changeQuery(
      {
        date: day ?? date,
        entry: result.id,
        source: result.source,
        section: null,
        view: result.source !== "task" && view === "tasks" ? "day" : view,
      },
      true,
    );
  }
  async function action(item: AgendaEntry, input: AgendaQuickAction) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setActionError(null);
    setFeedback("");
    const payload = {
      ...input,
      id: item.id,
      source: item.source,
      expectedUpdatedAt: item.updatedAt,
    };
    const key = JSON.stringify(payload);
    if (remembered.current?.key !== key)
      remembered.current = { key, requestId: crypto.randomUUID() };
    try {
      await mutateAgenda({
        ...payload,
        requestId: remembered.current.requestId,
      });
      remembered.current = null;
      if (input.operation === "delete" && selectedId === item.id)
        closeDetails();
      const messages = {
        delete: "Activité supprimée.",
        complete: "Activité terminée.",
        cancel: "Activité annulée.",
        reopen: "Tâche rouverte.",
        reminder: "Rappel mis à jour.",
      };
      setFeedback(messages[input.operation]);
      refresh();
      onChanged();
      return true;
    } catch (error) {
      setActionError({
        id: item.id,
        message:
          error instanceof Error ? error.message : "Cette action a échoué.",
      });
      if (error instanceof AgendaRequestError && error.status === 404)
        refresh();
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function choosePrefill(kind: "contact" | "property", id: string | null) {
    return id
      ? agendaRequest<{ options: AgendaOption[] }>({ lookup: kind, id }).then(
          ({ options }) => options[0] ?? null,
        )
      : Promise.resolve(null);
  }
  const [seeded, setSeeded] = useState<string | null>(null);
  const requested = search.get("create");
  const requestedContact = search.get("agendaContact");
  const requestedProperty = search.get("agendaProperty");
  useEffect(() => {
    if (
      !viewer?.canWrite ||
      (requested !== "VISIT" && requested !== "TASK") ||
      seeded === requested
    )
      return;
    const controller = new AbortController();
    const query = (lookup: "contact" | "property", id: string | null) =>
      id
        ? agendaRequest<{ options: AgendaOption[] }>(
            { lookup, id },
            { signal: controller.signal },
          )
            .then(({ options }) => options[0] ?? null)
            .catch(() => null)
        : Promise.resolve(null);
    void Promise.all([
      query("contact", requestedContact),
      query("property", requestedProperty),
    ]).then(([contact, property]) => {
      if (controller.signal.aborted) return;
      setSeeded(requested);
      setEditor({ type: requested, time: `${date}T09:00`, contact, property });
      changeQuery(
        { create: null, agendaContact: null, agendaProperty: null },
        true,
      );
    });
    return () => controller.abort();
  }, [
    viewer?.canWrite,
    requested,
    requestedContact,
    requestedProperty,
    date,
    seeded,
  ]);

  const toggle = (item: AgendaEntry) =>
    void action(item, {
      operation: item.status === "completed" ? "reopen" : "complete",
    });
  const detailIssue =
    detailFailed?.key === selectedKey ? detailFailed.message : "";
  const issue =
    actionError?.id === item?.id ? actionError?.message : detailIssue;
  const taskProps = {
    tasks,
    day: date,
    now,
    writable: Boolean(viewer?.canWrite),
    busy,
    onOpen: open,
    onToggle: toggle,
  };
  function editItem(currentItem: AgendaEntry, copy = false) {
    if (!refs && (currentItem.contactId || currentItem.propertyId)) {
      void Promise.all([
        choosePrefill("contact", currentItem.contactId),
        choosePrefill("property", currentItem.propertyId),
      ])
        .then(([contact, property]) =>
          begin({
            type: currentItem.type,
            time: `${date}T09:00`,
            ...(copy ? { copy: currentItem } : { existing: currentItem }),
            contact,
            property,
          }),
        )
        .catch(() =>
          setFeedback(
            "Les références du formulaire n’ont pas pu être chargées.",
          ),
        );
      return;
    }
    begin({
      type: currentItem.type,
      time: `${date}T09:00`,
      ...(copy ? { copy: currentItem } : { existing: currentItem }),
      reference: refs ?? undefined,
    });
  }

  return (
    <section
      className="grid min-w-0 gap-4 text-[#18211f]"
      aria-label="Agenda et tâches"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Agenda &amp; Tâches
          </h2>
          <p className="capitalize text-sm text-[#59645f]">
            {title} · Europe/Paris
          </p>
        </div>
        {viewer?.canWrite ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondary}
              onClick={() => begin({ type: "TASK", time: `${date}T09:00` })}
            >
              <CheckSquare className="size-4" />
              Nouvelle tâche
            </button>
            <button
              type="button"
              className={primary}
              onClick={() => begin({ time: `${date}T09:00` })}
            >
              <CalendarPlus className="size-4" />
              Nouvel événement
            </button>
          </div>
        ) : null}
      </header>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#dfddd4] pb-2">
        <nav aria-label="Vues de l’agenda" className="flex flex-wrap gap-1">
          {agendaViews.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={item === view}
              onClick={() => changeQuery({ view: item })}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#2f493a]",
                item === view
                  ? "bg-[#dce5d7] font-semibold text-[#18211f]"
                  : "text-[#59645f] hover:bg-[#ebece5]",
              )}
            >
              {labels[item]}
              {item === "tasks" && current ? (
                <span className="rounded-full bg-[#ebece5] px-2 py-0.5 text-xs">
                  {taskCount}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        {viewer?.canAssign ? (
          <label className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            Responsable
            <select
              className={fieldClass}
              value={assignee}
              onChange={(event) =>
                changeQuery({ assignee: event.target.value || null })
              }
            >
              <option value="">Tous les responsables</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          </label>
        ) : viewer ? (
          <span className="pb-2 text-xs text-[#59645f]">Mon agenda</span>
        ) : null}
      </div>
      {view !== "tasks" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondary}
            onClick={() => next(-1)}
            aria-label="Période précédente"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            className={secondary}
            onClick={() => next(1)}
            aria-label="Période suivante"
          >
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            className={secondary}
            onClick={() => changeQuery({ date: parisDay(), view: "day" })}
          >
            Aujourd’hui
          </button>
          <label className="min-w-0">
            <span className="sr-only">Date affichée</span>
            <input
              type="date"
              className={fieldClass}
              value={date}
              onChange={(event) => {
                if (validAgendaDay(event.target.value))
                  changeQuery({ date: event.target.value });
              }}
            />
          </label>
        </div>
      ) : null}
      {feedback ? (
        <p role="status" className="rounded-lg bg-[#dce5d7] p-3 text-sm">
          {feedback}
        </p>
      ) : null}
      {actionError && !selectedKey ? (
        <p
          role="alert"
          className="rounded-lg bg-[#f8e6e2] p-3 text-sm text-[#943f37]"
        >
          {actionError.message}{" "}
          <button type="button" className="underline" onClick={refresh}>
            Actualiser l’agenda
          </button>
        </p>
      ) : null}
      {failed?.context === context ? (
        <div
          role="alert"
          className="flex flex-wrap gap-3 rounded-lg bg-[#f8e6e2] p-3 text-sm text-[#943f37]"
        >
          {failed.message}
          <button type="button" className="underline" onClick={refresh}>
            Réessayer
          </button>
          {assignee ? (
            <button
              type="button"
              className="underline"
              onClick={() => changeQuery({ assignee: null })}
            >
              Réinitialiser le responsable
            </button>
          ) : null}
        </div>
      ) : null}
      {pending ? <BentoCardSkeleton /> : null}
      {reminders.length ? (
        <CommercialPanel className="grid gap-2 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="size-4" />
            Rappels internes dus{" "}
            <span className="rounded-full bg-[#dce5d7] px-2 py-0.5">
              {reminders.length}
            </span>
          </h3>
          <ul className="grid gap-1">
            {reminders.slice(0, 6).map((entry) => (
              <li key={`${entry.source}:${entry.id}`}>
                <button
                  type="button"
                  className="text-left text-sm underline"
                  onClick={() => open(entry)}
                >
                  {entry.title} ·{" "}
                  {noticeTime.format(new Date(agendaReminderAt(entry)!))}
                  {entry.assignee ? ` · ${entry.assignee}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </CommercialPanel>
      ) : null}
      {current ? (
        view === "tasks" ? (
          <AgendaTasks {...taskProps} />
        ) : (
          <div className={styles.body}>
            <div className="grid min-w-0 gap-4">
              {view === "month" ? (
                <AgendaMonth
                  date={date}
                  events={events}
                  onDay={(date) => changeQuery({ date })}
                  onOpen={open}
                />
              ) : (
                <>
                  <AgendaTimeline
                    date={date}
                    view={view}
                    events={events}
                    now={now}
                    onDay={(date) => changeQuery({ date })}
                    onOpen={open}
                    onAdd={onAdd}
                  />
                  <AgendaMonth
                    date={date}
                    events={events}
                    onDay={(date) => changeQuery({ date })}
                    onOpen={open}
                    dayCounts={current.monthCounts}
                    compact
                  />
                </>
              )}
            </div>
            <aside
              aria-label="Activités et tâches"
              className="grid min-w-0 gap-4"
            >
              {view === "month" ? (
                <AgendaDayList
                  date={date}
                  events={events}
                  onDay={(date) => changeQuery({ date })}
                  onOpen={open}
                  onAdd={onAdd}
                />
              ) : null}
              <AgendaSideTasks
                {...taskProps}
                showAll={() => changeQuery({ view: "tasks" })}
              />
            </aside>
          </div>
        )
      ) : null}
      {selectedKey && viewer && item ? (
        <AgendaDrawer
          key={`${selectedKey}:${initialPane}`}
          item={item}
          reference={refs}
          viewer={viewer}
          initialTab={initialPane}
          loading={!refs && !detailIssue}
          error={issue ?? ""}
          busy={busy}
          now={now}
          onClose={closeDetails}
          onRetry={refresh}
          onEdit={() => editItem(item)}
          onCopy={() => editItem(item, true)}
          onTask={() =>
            begin({
              type: "TASK",
              time: `${date}T09:00`,
              appointmentId: item.id,
              contact: refs?.contact,
              property: refs?.property,
            })
          }
          onAction={(input) => action(item, input)}
        />
      ) : selectedKey ? (
        <CommercialDialog title="Activité" drawer onClose={closeDetails}>
          {detailIssue ? (
            <div role="alert" className="grid gap-2">
              <p>{detailIssue}</p>
              <button type="button" className={secondary} onClick={refresh}>
                Réessayer
              </button>
            </div>
          ) : (
            <p role="status">Chargement de l’activité…</p>
          )}
        </CommercialDialog>
      ) : null}
      {editor && viewer ? (
        <AgendaForm
          initial={editor}
          assignee={assignee || viewer.id}
          team={team}
          viewerId={viewer.id}
          now={now}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      ) : null}
    </section>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowDownUp, SlidersHorizontal } from "lucide-react";
import { CommercialDialog } from "@/components/commercial/commercial-design-ui";
import {
  CommercialPanel,
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "@/components/commercial/commercial-ui";
import {
  agendaIsClosed,
  agendaPriorities,
  agendaStatuses,
  agendaTaskTypes,
  type AgendaEntry,
  type AgendaOption,
} from "@/lib/agenda";
import {
  parisClock,
  parisDay,
  taskGroup,
  taskGroupLabels,
} from "@/lib/agenda-time";
import { AgendaField } from "./agenda-form";
import { AgendaLookup } from "./agenda-lookup";

type TaskProps = {
  tasks: AgendaEntry[];
  day: string;
  now: Date;
  writable: boolean;
  busy: boolean;
  onOpen: (item: AgendaEntry, actions?: boolean) => void;
  onToggle: (item: AgendaEntry) => void;
};
type Filters = {
  state: string;
  priority: string;
  category: string;
  from: string;
  to: string;
  query: string;
  contact: AgendaOption | null;
  property: AgendaOption | null;
};
const empty: Filters = {
  state: "",
  priority: "",
  category: "",
  from: "",
  to: "",
  query: "",
  contact: null,
  property: null,
};
const sorts = {
  due: "Échéance croissante",
  recent: "Échéance décroissante",
  priority: "Priorité",
  title: "Nom",
  owner: "Responsable",
} as const;
const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
const date = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const btn = `${commercialSecondaryButton} min-h-11`;

function Toggle({
  item,
  disabled,
  onToggle,
}: {
  item: AgendaEntry;
  disabled: boolean;
  onToggle: (item: AgendaEntry) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={item.status === "completed"}
      disabled={disabled || item.status === "cancelled"}
      aria-label={`${item.status === "completed" ? "Rouvrir" : "Terminer"} la tâche ${item.title}`}
      onChange={() => onToggle(item)}
      className="size-4 shrink-0 accent-[#2f493a]"
    />
  );
}
function dueLabel(item: AgendaEntry) {
  return item.dueAt
    ? `${date.format(new Date(item.dueAt))} · ${parisClock(item.dueAt)}`
    : "Sans échéance";
}
function Priority({ item }: { item: AgendaEntry }) {
  return (
    <span
      className={`w-fit rounded-full px-2 py-1 text-xs ${item.priority === "high" || item.priority === "urgent" ? "bg-[#f8e6e2] text-[#943f37]" : "bg-[#ebece5] text-[#37473e]"}`}
    >
      {agendaPriorities[item.priority]}
    </span>
  );
}

export function AgendaSideTasks({
  tasks,
  day,
  now,
  writable,
  busy,
  onOpen,
  onToggle,
  showAll,
}: TaskProps & { showAll: () => void }) {
  const groups = ["today", "overdue", "week"] as const;
  return (
    <CommercialPanel className="grid min-w-0 gap-4 p-4">
      <h3 className="font-semibold">Échéances et priorités</h3>
      {groups.map((key) => {
        const matching = tasks
          .filter((task) => taskGroup(task, now, day) === key)
          .slice(0, 5);
        return (
          <section
            key={key}
            className="grid gap-2 border-t border-[#dfddd4] pt-3"
          >
            <h4
              className={`text-sm font-semibold ${key === "overdue" ? "text-[#943f37]" : ""}`}
            >
              {key === "today" && day !== parisDay(now)
                ? "Jour sélectionné"
                : taskGroupLabels[key]}
            </h4>
            {matching.length ? (
              matching.map((item) => (
                <article
                  key={item.id}
                  className="flex min-w-0 items-start gap-3 py-1"
                >
                  <Toggle
                    item={item}
                    disabled={!writable || busy}
                    onToggle={onToggle}
                  />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      className="w-fit text-left text-sm font-medium [overflow-wrap:anywhere] hover:underline"
                    >
                      {item.title}
                    </button>
                    <span className="text-xs text-[#59645f]">
                      {item.assignee ?? "Sans responsable"} · {dueLabel(item)}
                    </span>
                    <Priority item={item} />
                  </div>
                </article>
              ))
            ) : (
              <p className="text-xs text-[#59645f]">Aucune tâche.</p>
            )}
          </section>
        );
      })}
      <button type="button" className={btn} onClick={showAll}>
        Voir toutes les tâches
      </button>
    </CommercialPanel>
  );
}

export function AgendaTasks({
  tasks,
  now,
  writable,
  busy,
  onOpen,
  onToggle,
}: TaskProps) {
  const [filters, setFilters] = useState<Filters>(empty);
  const [draft, setDraft] = useState<Filters | null>(null);
  const [sort, setSort] = useState<keyof typeof sorts>("due");
  const [visible, setVisible] = useState(30);
  const filtered = tasks
    .filter((item) => {
      const dueDay = item.dueAt ? parisDay(item.dueAt) : null;
      return (
        (!filters.state ||
          (filters.state === "overdue"
            ? taskGroup(item, now) === "overdue"
            : item.status === filters.state)) &&
        (!filters.priority || item.priority === filters.priority) &&
        (!filters.category || item.taskType === filters.category) &&
        (!filters.query ||
          item.title
            .toLocaleLowerCase("fr-FR")
            .includes(filters.query.trim().toLocaleLowerCase("fr-FR"))) &&
        (!filters.contact || item.contactId === filters.contact.id) &&
        (!filters.property || item.propertyId === filters.property.id) &&
        (!filters.from || (dueDay && dueDay >= filters.from)) &&
        (!filters.to || (dueDay && dueDay <= filters.to))
      );
    })
    .sort((a, b) => {
      if (sort === "priority")
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      if (sort === "title") return a.title.localeCompare(b.title, "fr");
      if (sort === "owner")
        return (a.assignee ?? "").localeCompare(b.assignee ?? "", "fr");
      return (
        (!a.dueAt ? 1 : 0) - (!b.dueAt ? 1 : 0) ||
        (a.dueAt ?? "").localeCompare(b.dueAt ?? "") *
          (sort === "recent" ? -1 : 1)
      );
    });
  const filtersCount = Object.values(filters).filter(Boolean).length;
  function edit<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((prior) => (prior ? { ...prior, [key]: value } : null));
  }
  const isRangeInvalid = Boolean(
    draft?.from && draft.to && draft.from > draft.to,
  );
  const groups = Object.keys(
    taskGroupLabels,
  ) as (keyof typeof taskGroupLabels)[];
  const page = groups
    .flatMap((group) =>
      filtered.filter((item) => taskGroup(item, now) === group),
    )
    .slice(0, visible);
  return (
    <CommercialPanel className="grid min-w-0 gap-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">
          Registre des tâches{" "}
          <span className="ml-2 rounded-full bg-[#ebece5] px-2 py-1 text-xs">
            {filtered.length}
          </span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btn}
            onClick={() => setDraft(filters)}
          >
            <SlidersHorizontal className="size-4" />
            Filtrer{filtersCount ? ` (${filtersCount})` : ""}
          </button>
          <label className="flex items-center gap-1 text-xs">
            <ArrowDownUp className="size-4" aria-hidden="true" />
            <span className="sr-only">Trier</span>
            <select
              className={fieldClass}
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as keyof typeof sorts);
                setVisible(30);
              }}
            >
              {Object.entries(sorts).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {filtersCount ? (
        <div className="flex flex-wrap gap-2 text-xs text-[#59645f]">
          {[
            filters.query,
            filters.state === "overdue"
              ? "En retard"
              : agendaStatuses[filters.state as keyof typeof agendaStatuses],
            agendaPriorities[filters.priority as keyof typeof agendaPriorities],
            agendaTaskTypes[filters.category as keyof typeof agendaTaskTypes],
            filters.contact?.label,
            filters.property?.label,
            filters.from,
            filters.to,
          ]
            .filter(Boolean)
            .map((value, index) => (
              <span key={index} className="rounded-full bg-[#ebece5] px-2 py-1">
                {value}
              </span>
            ))}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setFilters(empty);
              setVisible(30);
            }}
          >
            Réinitialiser
          </button>
        </div>
      ) : null}
      {filtered.length ? (
        groups.map((key) => {
          const rows = page.filter((item) => taskGroup(item, now) === key);
          if (!rows.length) return null;
          return (
            <section key={key} className="grid min-w-0 gap-2">
              <h4 className="border-b border-[#dfddd4] pb-2 text-sm font-semibold">
                {taskGroupLabels[key]}
              </h4>
              {rows.map((item) => (
                <article
                  key={item.id}
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-b border-[#ece8de] py-2 lg:grid-cols-[auto_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,.7fr)_minmax(0,.75fr)_auto] lg:items-center"
                >
                  <Toggle
                    item={item}
                    disabled={!writable || busy}
                    onToggle={onToggle}
                  />
                  <button
                    type="button"
                    className={`w-fit text-left text-sm font-semibold [overflow-wrap:anywhere] hover:underline ${agendaIsClosed(item) ? "text-[#59645f]" : ""}`}
                    onClick={() => onOpen(item)}
                  >
                    {item.title}
                  </button>
                  <div className="col-start-2 grid gap-1 text-xs text-[#59645f] lg:col-auto">
                    <span>{item.assignee ?? "Sans responsable"}</span>
                    {item.contact && item.contactId ? (
                      <Link
                        href={`/admin?tab=contacts&contact=${item.contactId}`}
                        className="w-fit underline"
                      >
                        {item.contact}
                      </Link>
                    ) : null}
                  </div>
                  <p className="col-start-2 text-xs lg:col-auto">
                    {dueLabel(item)}
                  </p>
                  <div className="col-start-2 lg:col-auto">
                    <Priority item={item} />
                  </div>
                  <span className="col-start-2 text-xs lg:col-auto">
                    {agendaStatuses[item.status]}
                  </span>
                  <button
                    type="button"
                    className={`${btn} col-start-2 w-fit lg:col-auto`}
                    aria-label={`Actions · ${item.title}`}
                    onClick={() => onOpen(item, true)}
                  >
                    Actions
                  </button>
                </article>
              ))}
            </section>
          );
        })
      ) : (
        <p className="py-5 text-sm text-[#59645f]">
          {filtersCount
            ? "Aucune tâche ne correspond aux filtres."
            : "Aucune tâche dans ce périmètre."}
        </p>
      )}
      {page.length < filtered.length ? (
        <button
          type="button"
          className={btn}
          onClick={() => setVisible((n) => n + 30)}
        >
          Afficher la suite
        </button>
      ) : null}
      {draft ? (
        <CommercialDialog
          title="Filtrer les tâches"
          onClose={() => setDraft(null)}
        >
          <div className="grid gap-4">
            <AgendaField label="Nom de la tâche">
              <input
                className={fieldClass}
                value={draft.query}
                onChange={(e) => edit("query", e.target.value)}
              />
            </AgendaField>
            <div className="grid gap-3 sm:grid-cols-2">
              <AgendaField label="État">
                <select
                  aria-label="État"
                  className={fieldClass}
                  value={draft.state}
                  onChange={(e) => edit("state", e.target.value)}
                >
                  <option value="">Tous</option>
                  <option value="todo">À faire</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminée</option>
                  <option value="cancelled">Annulée</option>
                  <option value="overdue">En retard uniquement</option>
                </select>
              </AgendaField>
              <AgendaField label="Priorité">
                <select
                  className={fieldClass}
                  value={draft.priority}
                  onChange={(e) => edit("priority", e.target.value)}
                >
                  <option value="">Toutes</option>
                  {Object.entries(agendaPriorities).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </AgendaField>
              <AgendaField label="Catégorie">
                <select
                  className={fieldClass}
                  value={draft.category}
                  onChange={(e) => edit("category", e.target.value)}
                >
                  <option value="">Toutes</option>
                  {Object.entries(agendaTaskTypes).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </AgendaField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AgendaField label="Échéance à partir du">
                <input
                  type="date"
                  className={fieldClass}
                  value={draft.from}
                  onChange={(e) => edit("from", e.target.value)}
                />
              </AgendaField>
              <AgendaField
                label="Échéance jusqu’au"
                error={
                  isRangeInvalid
                    ? "La fin doit être après le début."
                    : undefined
                }
              >
                <input
                  type="date"
                  className={fieldClass}
                  value={draft.to}
                  onChange={(e) => edit("to", e.target.value)}
                />
              </AgendaField>
            </div>
            <AgendaLookup
              kind="contact"
              label="Contact"
              value={draft.contact}
              onChange={(value) => edit("contact", value)}
            />
            <AgendaLookup
              kind="property"
              label="Bien"
              value={draft.property}
              onChange={(value) => edit("property", value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                className={btn}
                type="button"
                onClick={() => setDraft(empty)}
              >
                Réinitialiser
              </button>
              <button
                className={btn}
                type="button"
                onClick={() => setDraft(null)}
              >
                Annuler
              </button>
              <button
                className={`${commercialPrimaryButton} min-h-11`}
                type="button"
                disabled={isRangeInvalid}
                onClick={() => {
                  setFilters(draft);
                  setDraft(null);
                  setVisible(30);
                }}
              >
                Appliquer
              </button>
            </div>
          </div>
        </CommercialDialog>
      ) : null}
    </CommercialPanel>
  );
}

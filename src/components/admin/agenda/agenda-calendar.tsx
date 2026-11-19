"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  CommercialPanel,
  commercialSecondaryButton,
} from "@/components/commercial/commercial-ui";
import {
  agendaIsClosed,
  agendaStatuses,
  agendaTypes,
  type AgendaEntry,
  type AgendaView,
} from "@/lib/agenda";
import {
  agendaDayItems,
  agendaMinute,
  agendaRange,
  dayDate,
  dayLabel,
  monthLabel,
  parisClock,
  parisDay,
  shiftAgendaDay,
  shiftAgendaMonth,
  shortDayLabel,
} from "@/lib/agenda-time";
import { cn } from "@/lib/utils";
import styles from "./agenda.module.css";

type CalendarProps = {
  date: string;
  events: AgendaEntry[];
  onDay: (date: string) => void;
  onOpen: (item: AgendaEntry) => void;
  onAdd?: (localTime: string) => void;
};
const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const agendaButton = cn(commercialSecondaryButton, "min-h-11");
const eventTones: Partial<Record<AgendaEntry["type"], string>> = {
  CALL: styles.green,
  VISIT: styles.green,
  ESTIMATION: styles.amber,
  FOLLOW_UP: styles.rust,
  SIGNATURE: styles.violet,
};

function times(item: AgendaEntry) {
  return item.startsAt
    ? `${parisClock(item.startsAt)}${item.endsAt ? ` – ${parisClock(item.endsAt)}` : ""}`
    : "";
}

export function AgendaEventButton({
  item,
  onOpen,
}: {
  item: AgendaEntry;
  onOpen: (item: AgendaEntry) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        styles.event,
        eventTones[item.type],
        agendaIsClosed(item) && styles.closed,
      )}
      onClick={() => onOpen(item)}
      aria-label={`${item.title}, ${times(item)}, ${agendaStatuses[item.status]}`}
    >
      <span className="flex flex-wrap items-baseline gap-x-2 text-xs font-medium">
        <span>{times(item)}</span>
        <span>{agendaTypes[item.type]}</span>
      </span>
      <span className="block truncate text-sm font-semibold" title={item.title}>
        {item.title}
      </span>
      <span className="block truncate text-xs">
        {item.assignee ?? "Sans responsable"}
        {agendaIsClosed(item) ? ` · ${agendaStatuses[item.status]}` : ""}
      </span>
    </button>
  );
}

export function AgendaMonth({
  date,
  events,
  onDay,
  onOpen,
  compact = false,
  dayCounts,
}: CalendarProps & { compact?: boolean; dayCounts?: Record<string, number> }) {
  const { first, length } = agendaRange(date, "month");
  const today = parisDay();
  return (
    <CommercialPanel className="grid min-w-0 gap-3 p-3 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold capitalize">
          {monthLabel.format(dayDate(date))}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            className={agendaButton}
            onClick={() => onDay(shiftAgendaMonth(date, -1))}
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className={agendaButton}
            onClick={() => onDay(shiftAgendaMonth(date, 1))}
            aria-label="Mois suivant"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>
      <div className={styles.month} aria-label="Calendrier mensuel">
        {weekdays.map((label) => (
          <span key={label} className="pb-2 text-center text-xs text-[#59645f]">
            {label}
          </span>
        ))}
        {Array.from({ length }, (_, index) => {
          const day = shiftAgendaDay(first, index);
          const items = agendaDayItems(events, day);
          const count = dayCounts?.[day] ?? items.length;
          return (
            <div
              key={day}
              className={cn(
                styles.monthDay,
                !compact && styles.fullMonthDay,
                !day.startsWith(date.slice(0, 7)) && styles.adjacentMonth,
              )}
            >
              <button
                type="button"
                aria-current={day === today ? "date" : undefined}
                aria-pressed={day === date}
                aria-label={`${dayLabel.format(dayDate(day))}, ${count} événement(s)`}
                className={styles.dayNumber}
                onClick={() => onDay(day)}
              >
                {Number(day.slice(8))}
                {count ? (
                  <span aria-hidden="true" className={styles.monthCount}>
                    {count}
                  </span>
                ) : null}
              </button>
              {!compact ? (
                <div className={styles.monthPreviews}>
                  {items.slice(0, 2).map((item) => (
                    <button
                      key={`${item.source}:${item.id}`}
                      type="button"
                      onClick={() => onOpen(item)}
                      title={item.title}
                      className={cn(styles.monthPreview, eventTones[item.type])}
                    >
                      {item.startsAt ? parisClock(item.startsAt) : ""}{" "}
                      {item.title}
                    </button>
                  ))}
                  {items.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => onDay(day)}
                      aria-label={`Voir les ${items.length} événements du ${dayLabel.format(dayDate(day))}`}
                      className="px-1 text-left text-xs underline"
                    >
                      +{items.length - 2}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </CommercialPanel>
  );
}

type Positioned = {
  item: AgendaEntry;
  start: number;
  end: number;
  lane: number;
  columns: number;
};
function position(items: AgendaEntry[], day: string): Positioned[] {
  const slots = items
    .flatMap((item) => {
      if (!item.startsAt || !item.endsAt) return [];
      const start =
        parisDay(item.startsAt) < day ? 0 : agendaMinute(item.startsAt);
      const end =
        parisDay(item.endsAt) > day ? 1440 : agendaMinute(item.endsAt);
      return [
        {
          item,
          start,
          end: Math.min(1440, Math.max(end, start + 44)),
          lane: 0,
          columns: 1,
        },
      ];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  let group: Positioned[] = [];
  let lanes: number[] = [];
  function finish() {
    for (const entry of group) entry.columns = lanes.length;
  }
  for (const slot of slots) {
    const nextLane = lanes.findIndex((ends) => ends <= slot.start);
    if (!lanes.length || lanes.every((ends) => ends <= slot.start)) {
      finish();
      lanes = [slot.end];
      group = [slot];
    } else {
      slot.lane = nextLane === -1 ? lanes.length : nextLane;
      lanes[slot.lane] = slot.end;
      group.push(slot);
    }
  }
  finish();
  return slots;
}
function slotTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function AgendaDayList({ date, events, onOpen, onAdd }: CalendarProps) {
  const items = agendaDayItems(events, date);
  return (
    <CommercialPanel className="grid min-w-0 gap-3 p-4">
      <h3 className="font-semibold capitalize">
        {dayLabel.format(dayDate(date))}
      </h3>
      {items.length ? (
        items.map((item) => (
          <AgendaEventButton
            key={`${item.source}:${item.id}`}
            item={item}
            onOpen={onOpen}
          />
        ))
      ) : (
        <p className="text-sm text-[#59645f]">Aucun événement ce jour.</p>
      )}
      {onAdd ? (
        <button
          type="button"
          className={`${agendaButton} w-fit`}
          onClick={() => onAdd(`${date}T09:00`)}
        >
          <Plus className="size-4" />
          Ajouter un événement
        </button>
      ) : null}
    </CommercialPanel>
  );
}

export function AgendaTimeline({
  date,
  view,
  events,
  onOpen,
  onDay,
  onAdd,
  now,
}: CalendarProps & { view: Extract<AgendaView, "day" | "week">; now: Date }) {
  const { first, length } = agendaRange(date, view);
  const days = Array.from({ length }, (_, index) =>
    shiftAgendaDay(first, index),
  );
  const ranges = days.map((day) => position(agendaDayItems(events, day), day));
  const positions = ranges.flat();
  const min = Math.min(
    480,
    ...positions.map((slot) => Math.floor(slot.start / 60) * 60),
  );
  const max = Math.max(
    1200,
    ...positions.map((slot) => Math.ceil(slot.end / 60) * 60),
  );
  const today = parisDay(now);
  const minutesNow = agendaMinute(now.toISOString());
  return (
    <>
      <CommercialPanel
        className={cn("min-w-0 p-3 sm:p-4", styles.timelineDesktop)}
      >
        {positions.length === 0 ? (
          <p className="mb-3 text-sm text-[#59645f]">
            <CalendarDays className="mr-1 inline size-4" />
            Aucun événement sur cette période.
          </p>
        ) : null}
        <div
          className={styles.timelineGrid}
          style={{
            gridTemplateColumns: `3.1rem repeat(${length}, minmax(0, 1fr))`,
          }}
        >
          <span aria-hidden="true" />
          {days.map((day) => (
            <button
              key={day}
              type="button"
              className={styles.timelineDay}
              aria-current={day === today ? "date" : undefined}
              aria-pressed={day === date}
              onClick={() => onDay(day)}
            >
              {view === "day"
                ? dayLabel.format(dayDate(day))
                : shortDayLabel.format(dayDate(day))}
            </button>
          ))}
          <div className={styles.hours} aria-hidden="true">
            {Array.from({ length: (max - min) / 60 }, (_, index) => (
              <span key={index}>{slotTime(min + index * 60)}</span>
            ))}
          </div>
          {days.map((day, index) => (
            <div
              key={day}
              className={styles.timelineColumn}
              style={{ height: max - min }}
            >
              {Array.from({ length: (max - min) / 30 }, (_, index) => {
                const time = slotTime(min + index * 30);
                return onAdd ? (
                  <button
                    key={time}
                    type="button"
                    className={styles.slot}
                    onClick={() => onAdd(`${day}T${time}`)}
                    aria-label={`Créer le ${dayLabel.format(dayDate(day))} à ${time}`}
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                ) : (
                  <div key={time} className={styles.slot} aria-hidden="true" />
                );
              })}
              {day === today && minutesNow >= min && minutesNow < max ? (
                <span
                  className={styles.currentLine}
                  style={{ top: minutesNow - min }}
                  title="Heure actuelle"
                  aria-hidden="true"
                />
              ) : null}
              {ranges[index].map(({ item, start, end, lane, columns }) => (
                <div
                  key={`${item.source}:${item.id}`}
                  className={styles.positioned}
                  style={{
                    top: start - min,
                    height: Math.max(26, end - start - 2),
                    left: `${(lane / columns) * 100}%`,
                    width: `${100 / columns}%`,
                  }}
                >
                  <AgendaEventButton item={item} onOpen={onOpen} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </CommercialPanel>
      <div className={styles.timelineMobile}>
        {days.map((day) => (
          <AgendaDayList
            key={day}
            date={day}
            events={events}
            onDay={onDay}
            onOpen={onOpen}
            onAdd={onAdd}
          />
        ))}
      </div>
    </>
  );
}

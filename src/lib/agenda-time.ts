import {
  agendaIsClosed,
  agendaTimeZone,
  type AgendaEntry,
  type AgendaView,
} from "./agenda";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: agendaTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const clock = new Intl.DateTimeFormat("fr-FR", {
  timeZone: agendaTimeZone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const noZoneClock = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const dayLabel = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  dateStyle: "full",
});
export const monthLabel = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
});
export const shortDayLabel = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
});

export const dayDate = (day: string) => new Date(`${day}T12:00:00.000Z`);
export const parisDay = (date: Date | string = new Date()) =>
  dayFormat.format(new Date(date));
export const parisClock = (value: Date | string) =>
  clock.format(new Date(value));
export const parisInput = (value: string) =>
  `${parisDay(value)}T${parisClock(value)}`;
export function validAgendaDay(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(+dayDate(value)) &&
    dayDate(value).toISOString().slice(0, 10) === value
  );
}
export function shiftAgendaDay(day: string, amount: number) {
  const date = dayDate(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function shiftAgendaMonth(day: string, amount: number) {
  const base = dayDate(day);
  const current = base.getUTCDate();
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + amount);
  const next = new Date(base);
  next.setUTCMonth(next.getUTCMonth() + 1, 0);
  base.setUTCDate(Math.min(current, next.getUTCDate()));
  return base.toISOString().slice(0, 10);
}
export function weekStart(day: string) {
  return shiftAgendaDay(day, -((dayDate(day).getUTCDay() + 6) % 7));
}
export function parisInstant(wall: string, existing?: string | null) {
  if (!noZoneClock.test(wall)) return null;
  if (
    existing &&
    Number.isFinite(Date.parse(existing)) &&
    parisInput(existing) === wall
  )
    return new Date(existing).toISOString();
  const parsed = Date.parse(`${wall}:00Z`);
  if (!Number.isFinite(parsed)) return null;
  // The earlier of the two valid instants is used during the autumn clock change.
  for (const offset of [2, 1]) {
    const instant = new Date(parsed - offset * 3600000).toISOString();
    if (parisInput(instant) === wall) return instant;
  }
  return null;
}
export function agendaRange(day: string, view: AgendaView) {
  const first =
    view === "week"
      ? weekStart(day)
      : view === "month"
        ? weekStart(`${day.slice(0, 7)}-01`)
        : day;
  const length = view === "week" ? 7 : view === "month" ? 42 : 1;
  return {
    first,
    length,
    from: parisInstant(`${first}T00:00`)!,
    to: parisInstant(`${shiftAgendaDay(first, length)}T00:00`)!,
  };
}
export function agendaDayItems(events: AgendaEntry[], day: string) {
  const { from, to } = agendaRange(day, "day");
  return events.filter(
    ({ startsAt, endsAt }) =>
      startsAt &&
      Date.parse(startsAt) < Date.parse(to) &&
      (endsAt
        ? Date.parse(endsAt) > Date.parse(from)
        : Date.parse(startsAt) >= Date.parse(from)),
  );
}
export function agendaMinute(value: string) {
  const [hour, minute] = parisClock(value).split(":").map(Number);
  return hour * 60 + minute;
}
export const taskGroupLabels = {
  overdue: "En retard",
  today: "Aujourd’hui",
  week: "Cette semaine",
  later: "Plus tard",
  unscheduled: "Sans échéance",
  closed: "Clôturées",
};
export function taskGroup(
  task: AgendaEntry,
  now: Date,
  selectedDay = parisDay(now),
): keyof typeof taskGroupLabels {
  if (agendaIsClosed(task)) return "closed";
  if (!task.dueAt) return "unscheduled";
  if (Date.parse(task.dueAt) < +now && parisDay(task.dueAt) !== selectedDay)
    return "overdue";
  const due = parisDay(task.dueAt);
  if (due === selectedDay)
    return Date.parse(task.dueAt) < +now ? "overdue" : "today";
  if (
    due >= weekStart(selectedDay) &&
    due < shiftAgendaDay(weekStart(selectedDay), 7)
  )
    return "week";
  return "later";
}
export function agendaReminderAt(item: AgendaEntry) {
  const value = item.source === "task" ? item.dueAt : item.startsAt;
  return value && item.reminderMinutes !== null && !agendaIsClosed(item)
    ? new Date(Date.parse(value) - item.reminderMinutes * 60000).toISOString()
    : null;
}

export function agendaEntryHref(
  source: AgendaEntry["source"],
  id: string,
  date?: string | null,
) {
  return `/admin?${new URLSearchParams({ tab: "agenda", source, entry: id, ...(date ? { date: parisDay(date) } : {}) })}`;
}

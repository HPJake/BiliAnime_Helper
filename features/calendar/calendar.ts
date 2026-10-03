import type { AiringEvent } from "../../domain/airing";
import type { Anime } from "../../domain/anime";

export type CalendarItem = {
  event: AiringEvent;
  anime?: Anime;
};

export type CalendarDay = {
  key: string;
  date: Date;
  label: string;
  shortLabel: string;
  isToday: boolean;
  items: CalendarItem[];
};

export type CalendarRange = {
  from: number;
  to: number;
};

export function includeNextAiringEvents(
  events: AiringEvent[],
  animeById: ReadonlyMap<number, Anime>,
  range: CalendarRange
): AiringEvent[] {
  const merged = new Map(events.map((event) => [eventKey(event), event]));
  for (const anime of animeById.values()) {
    const event = anime.nextAiringEpisode;
    if (event && event.airingAt > range.from && event.airingAt < range.to) {
      merged.set(eventKey(event), event);
    }
  }
  return [...merged.values()].sort((left, right) => left.airingAt - right.airingAt);
}

export function getLocalCalendarRange(now = new Date(), dayCount = 7): CalendarRange {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + dayCount);

  return {
    from: Math.floor(start.getTime() / 1000) - 1,
    to: Math.floor(end.getTime() / 1000)
  };
}

export function getLocalDateKey(timestampSeconds: number, timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    ...(timeZone ? { timeZone } : {}),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(new Date(timestampSeconds * 1000));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function formatLocalAiringTime(timestampSeconds: number, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    ...(timeZone ? { timeZone } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date(timestampSeconds * 1000));
}

export function groupAiringEventsByDay(
  events: AiringEvent[],
  timeZone?: string
): Map<string, AiringEvent[]> {
  const grouped = new Map<string, AiringEvent[]>();
  for (const event of [...events].sort((left, right) => left.airingAt - right.airingAt)) {
    const key = getLocalDateKey(event.airingAt, timeZone);
    const items = grouped.get(key) ?? [];
    items.push(event);
    grouped.set(key, items);
  }
  return grouped;
}

export function buildWeeklyCalendar(
  events: AiringEvent[],
  animeById: ReadonlyMap<number, Anime>,
  now = new Date(),
  dayCount = 7
): CalendarDay[] {
  const grouped = groupAiringEventsByDay(events);
  const todayKey = getLocalDateKey(Math.floor(now.getTime() / 1000));
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = getLocalDateKey(Math.floor(date.getTime() / 1000));
    const dayEvents = grouped.get(key) ?? [];
    return {
      key,
      date,
      label: index === 0 ? "今天" : formatDayLabel(date),
      shortLabel: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date),
      isToday: key === todayKey,
      items: dayEvents.map((event) => ({ event, anime: animeById.get(event.animeId) }))
    };
  });
}

export function getNextUp(events: AiringEvent[], nowSeconds: number): AiringEvent | null {
  return (
    events
      .filter((event) => event.airingAt >= nowSeconds)
      .sort((left, right) => left.airingAt - right.airingAt)[0] ?? null
  );
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(date);
}

function eventKey(event: AiringEvent): string {
  return `${event.animeId}:${event.episode}:${event.airingAt}`;
}

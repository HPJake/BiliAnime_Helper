import { describe, expect, it } from "vitest";
import type { AiringEvent } from "../domain/airing";
import {
  buildWeeklyCalendar,
  includeNextAiringEvents,
  formatLocalAiringTime,
  getLocalDateKey,
  getNextUp,
  groupAiringEventsByDay
} from "../features/calendar/calendar";

describe("calendar time conversion", () => {
  it("converts UTC timestamps into the requested local timezone", () => {
    const timestamp = Date.parse("2024-01-01T16:30:00Z") / 1000;
    expect(getLocalDateKey(timestamp, "Asia/Shanghai")).toBe("2024-01-02");
    expect(formatLocalAiringTime(timestamp, "Asia/Shanghai")).toBe("00:30");
  });

  it("groups events across a local midnight boundary", () => {
    const beforeMidnight = Date.parse("2024-01-01T15:59:00Z") / 1000;
    const afterMidnight = Date.parse("2024-01-01T16:00:00Z") / 1000;
    const events: AiringEvent[] = [
      { animeId: 1, episode: 1, airingAt: beforeMidnight },
      { animeId: 2, episode: 1, airingAt: afterMidnight }
    ];

    const grouped = groupAiringEventsByDay(events, "Asia/Shanghai");

    expect(grouped.get("2024-01-01")?.map((event) => event.animeId)).toEqual([1]);
    expect(grouped.get("2024-01-02")?.map((event) => event.animeId)).toEqual([2]);
  });
});

describe("weekly calendar", () => {
  it("uses nextAiringEpisode when the schedule response omits it", () => {
    const anime = {
      id: 195516,
      title: { romaji: "Kusuriya no Hitorigoto 3rd Season" },
      synonyms: [],
      nextAiringEpisode: { animeId: 195516, episode: 2, airingAt: 150 }
    };

    expect(includeNextAiringEvents([], new Map([[anime.id, anime]]), { from: 100, to: 200 }))
      .toEqual([{ animeId: 195516, episode: 2, airingAt: 150 }]);
  });

  it("always creates seven local calendar days", () => {
    const days = buildWeeklyCalendar([], new Map(), new Date(2024, 0, 1, 12));
    expect(days).toHaveLength(7);
    expect(new Set(days.map((day) => day.key)).size).toBe(7);
    expect(days[0].isToday).toBe(true);
  });

  it("orders same-day events chronologically", () => {
    const now = new Date(2024, 0, 1, 12);
    const early = Math.floor(new Date(2024, 0, 1, 10).getTime() / 1000);
    const late = Math.floor(new Date(2024, 0, 1, 20).getTime() / 1000);
    const days = buildWeeklyCalendar(
      [
        { animeId: 2, episode: 1, airingAt: late },
        { animeId: 1, episode: 1, airingAt: early }
      ],
      new Map(),
      now
    );

    expect(days[0].items.map((item) => item.event.animeId)).toEqual([1, 2]);
  });

  it("handles a missing next episode", () => {
    expect(getNextUp([], 100)).toBeNull();
    expect(getNextUp([{ animeId: 1, episode: 1, airingAt: 99 }], 100)).toBeNull();
  });
});

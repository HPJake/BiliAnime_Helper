import { describe, expect, it, vi } from "vitest";
import type { AnimeProvider } from "../services/anime/AnimeProvider";
import type { ChineseTitleProvider } from "../services/anime/BangumiTitleProvider";
import { LocalizedAnimeProvider } from "../services/anime/LocalizedAnimeProvider";

describe("LocalizedAnimeProvider", () => {
  it("expands a Chinese query through Bangumi and enriches every matching season", async () => {
    const aniList: AnimeProvider = {
      searchAnime: vi.fn(async (query: string) => query === "薬屋のひとりごと"
        ? [
            { id: 161645, title: { native: "薬屋のひとりごと" }, synonyms: [] },
            { id: 176301, title: { native: "薬屋のひとりごと 第2期" }, synonyms: [] },
            { id: 195516, title: { native: "薬屋のひとりごと 第3期" }, synonyms: [] }
          ]
        : [{ id: 161645, title: { native: "薬屋のひとりごと" }, synonyms: [] }]),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => [])
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async () => [
        { native: "薬屋のひとりごと", chinese: "药屋少女的呢喃" },
        { native: "薬屋のひとりごと 第2期", chinese: "药屋少女的呢喃 第二季" },
        { native: "薬屋のひとりごと 第3期", chinese: "药屋少女的呢喃 第三季" }
      ]),
      getCalendarTitles: vi.fn(async () => [])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    const results = await provider.searchAnime("药屋少女的呢喃", 10);

    expect(results.map((anime) => [anime.id, anime.title.chinese])).toEqual([
      [161645, "药屋少女的呢喃"],
      [176301, "药屋少女的呢喃 第二季"],
      [195516, "药屋少女的呢喃 第三季"]
    ]);
    expect(aniList.searchAnime).toHaveBeenCalledWith("薬屋のひとりごと", 20);
  });

  it("enriches the global weekly schedule from the Bangumi calendar", async () => {
    const aniList: AnimeProvider = {
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({
        anime: [{ id: 189123, title: { native: "アオのハコ Season２" }, synonyms: [] }],
        events: [{ animeId: 189123, episode: 1, airingAt: 100 }]
      })),
      getTrending: vi.fn(async () => [])
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async () => []),
      getCalendarTitles: vi.fn(async () => [
        { native: "アオのハコ Season2", chinese: "青春之箱 第二季" }
      ])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    const schedule = await provider.getUpcomingAnimeSchedule(0, 200, "FALL", 2026);

    expect(schedule.anime[0]?.title.chinese).toBe("青春之箱 第二季");
    expect(schedule.events).toEqual([{ animeId: 189123, episode: 1, airingAt: 100 }]);
  });
});

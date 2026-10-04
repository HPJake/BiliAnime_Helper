import { describe, expect, it, vi } from "vitest";
import type { AnimeProvider } from "../services/anime/AnimeProvider";
import type { ChineseTitleProvider } from "../services/anime/BangumiTitleProvider";
import {
  LocalizedAnimeProvider,
  sortAnimeByNewestSeason
} from "../services/anime/LocalizedAnimeProvider";

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
        anime: [
          { id: 189123, title: { native: "アオのハコ Season２" }, synonyms: [] },
          { id: 200000, title: { native: "ダンダダン" }, synonyms: [] }
        ],
        events: [
          { animeId: 189123, episode: 1, airingAt: 100 },
          { animeId: 200000, episode: 2, airingAt: 150 }
        ]
      })),
      getTrending: vi.fn(async () => [])
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async (query: string) => query === "ダンダダン"
        ? [{ native: "ダンダダン", chinese: "胆大党" }]
        : []),
      getCalendarTitles: vi.fn(async () => [
        { native: "アオのハコ Season2", chinese: "青春之箱 第二季" }
      ])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    const schedule = await provider.getUpcomingAnimeSchedule(0, 200, "FALL", 2026);

    expect(schedule.anime.map((anime) => anime.title.chinese)).toEqual([
      "青春之箱 第二季",
      "胆大党"
    ]);
    expect(schedule.events).toHaveLength(2);
    expect(chineseTitles.searchTitles).toHaveBeenCalledOnce();
    expect(chineseTitles.searchTitles).toHaveBeenCalledWith("ダンダダン", 5);
  });

  it("enriches trending titles without changing AniList rank order", async () => {
    const aniList: AnimeProvider = {
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => [
        { id: 1, title: { native: "薬屋のひとりごと" }, synonyms: [] },
        { id: 2, title: { native: "葬送のフリーレン" }, synonyms: [] },
        { id: 3, title: { native: "ダンダダン" }, synonyms: [] }
      ])
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async (query: string) => query === "ダンダダン"
        ? [{ native: "ダンダダン", chinese: "胆大党" }]
        : []),
      getCalendarTitles: vi.fn(async () => [
        { native: "薬屋のひとりごと", chinese: "药屋少女的呢喃" },
        { native: "葬送のフリーレン", chinese: "葬送的芙莉莲" }
      ])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    const trending = await provider.getTrending(20);

    expect(trending.map((anime) => [anime.id, anime.title.chinese])).toEqual([
      [1, "药屋少女的呢喃"],
      [2, "葬送的芙莉莲"],
      [3, "胆大党"]
    ]);
    expect(chineseTitles.searchTitles).toHaveBeenCalledTimes(1);
    expect(chineseTitles.searchTitles).toHaveBeenCalledWith("ダンダダン", 5);
  });

  it("sorts search results by newest year and season while preserving relevance ties", () => {
    const sorted = sortAnimeByNewestSeason([
      { id: 1, title: {}, synonyms: [], season: "FALL", seasonYear: 2024 },
      { id: 2, title: {}, synonyms: [], season: "SPRING", seasonYear: 2026 },
      { id: 3, title: {}, synonyms: [], season: "FALL", seasonYear: 2026 },
      { id: 4, title: {}, synonyms: [], season: "FALL", seasonYear: 2026 },
      { id: 5, title: {}, synonyms: [] }
    ]);

    expect(sorted.map((anime) => anime.id)).toEqual([3, 4, 2, 1, 5]);
  });
});

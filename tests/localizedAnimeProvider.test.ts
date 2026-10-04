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
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
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
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => null)
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
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
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
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => null)
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
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => [
        { id: 1, title: { native: "薬屋のひとりごと" }, synonyms: [] },
        { id: 2, title: { native: "葬送のフリーレン" }, synonyms: [] },
        { id: 3, title: { native: "ダンダダン" }, synonyms: [] }
      ]),
      getRandomAnime: vi.fn(async () => null)
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

  it("enriches a random anime with Chinese details and forwards the excluded id", async () => {
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => ({
        id: 154587,
        title: { native: "葬送のフリーレン" },
        synonyms: [],
        description: "AniList description",
        averageScore: 91,
        scoreSource: "AniList" as const
      }))
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async () => [{
        native: "葬送のフリーレン",
        chinese: "葬送的芙莉莲",
        summary: "勇者一行击败魔王之后的故事。",
        score: 8.9
      }]),
      getCalendarTitles: vi.fn(async () => [])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    await expect(provider.getRandomAnime(7)).resolves.toMatchObject({
      id: 154587,
      title: { chinese: "葬送的芙莉莲" },
      description: "勇者一行击败魔王之后的故事。",
      averageScore: 89,
      scoreSource: "Bangumi"
    });
    expect(aniList.getRandomAnime).toHaveBeenCalledWith(7, undefined);
  });

  it("enriches category results without changing pagination", async () => {
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({
        anime: [{ id: 10, title: { native: "ダンダダン" }, synonyms: [] }],
        hasNextPage: true,
        page,
        total: 25
      })),
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => null)
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async () => [{ native: "ダンダダン", chinese: "胆大党" }]),
      getCalendarTitles: vi.fn(async () => [])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    await expect(provider.browseAnime({
      era: "ALL", format: "ALL", genres: [], sort: "POPULARITY"
    }, 2, 10)).resolves.toMatchObject({
      anime: [{ id: 10, title: { chinese: "胆大党" } }],
      hasNextPage: true,
      page: 2,
      total: 25
    });
  });

  it("keeps a relevant Bangumi match when punctuation and season notation differ", async () => {
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => ({
        id: 104578,
        title: {
          native: "進撃の巨人 Season 3 Part.2",
          romaji: "Shingeki no Kyojin Season 3 Part 2"
        },
        synonyms: ["Attack on Titan Season 3 Part 2"],
        description: "The battle for Shiganshina begins."
      }))
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async () => [{
        native: "進撃の巨人 Season 3 Part 2",
        chinese: "进击的巨人 第三季 Part.2",
        summary: "调查兵团为夺回玛利亚之墙再次出征。"
      }]),
      getCalendarTitles: vi.fn(async () => [])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    await expect(provider.getRandomAnime()).resolves.toMatchObject({
      title: { chinese: "进击的巨人 第三季 Part.2" },
      description: "调查兵团为夺回玛利亚之墙再次出征。"
    });
  });

  it("does not present an AniList foreign-language description as a Chinese summary", async () => {
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => ({
        id: 1,
        title: { native: "作品名" },
        synonyms: [],
        description: "An English synopsis from AniList."
      }))
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async () => []),
      getCalendarTitles: vi.fn(async () => [])
    };

    const anime = await new LocalizedAnimeProvider(aniList, chineseTitles).getRandomAnime();

    expect(anime?.description).toBeUndefined();
  });

  it("falls back to alternate titles when the native title has no Bangumi result", async () => {
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => ({
        id: 2,
        title: { native: "検索できない原題", romaji: "Searchable Alternate Title" },
        synonyms: ["Another Alias"],
        description: "Foreign synopsis"
      }))
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async (query: string) => query === "Searchable Alternate Title"
        ? [{ native: "別表記", chinese: "可搜索的中文标题", summary: "中文剧情简介。" }]
        : []),
      getCalendarTitles: vi.fn(async () => [])
    };

    const anime = await new LocalizedAnimeProvider(aniList, chineseTitles).getRandomAnime();

    expect(anime).toMatchObject({
      title: { chinese: "可搜索的中文标题" },
      description: "中文剧情简介。"
    });
    expect(chineseTitles.searchTitles).toHaveBeenNthCalledWith(1, "検索できない原題", 5);
    expect(chineseTitles.searchTitles).toHaveBeenNthCalledWith(2, "Searchable Alternate Title", 5);
  });
});

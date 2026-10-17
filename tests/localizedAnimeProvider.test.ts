import { describe, expect, it, vi } from "vitest";
import type { UpcomingAnimeSchedule } from "../domain/airing";
import type { AnimeProvider } from "../services/anime/AnimeProvider";
import type {
  ChineseTitleMatch,
  ChineseTitleProvider
} from "../services/anime/BangumiTitleProvider";
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

  it("finds a recent anime through either its primary Chinese title or an alternate translation", async () => {
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async (query: string) => query === "生徒会にも穴はある！"
        ? [{
            id: 190000,
            title: { native: "生徒会にも穴はある！" },
            synonyms: ["Even the Student Council Has Its Holes!"],
            season: "FALL",
            seasonYear: 2026
          }]
        : []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => null)
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async () => [
        {
          native: "生徒会にも穴はある！アニメCM",
          chinese: "学生会也有洞！动画CM",
          aliases: ["脑洞学生会 动画CM"],
          releaseDate: "2024-07-10"
        },
        {
          native: "生徒会にも穴はある！",
          chinese: "学生会也有洞！",
          aliases: ["脑洞学生会！"],
          releaseDate: "2026-10-03"
        }
      ]),
      getCalendarTitles: vi.fn(async () => [])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    for (const query of ["学生会也有洞", "脑洞学生会", "学生会"]) {
      await expect(provider.searchAnime(query, 10)).resolves.toMatchObject([
        {
          id: 190000,
          title: { chinese: "学生会也有洞！" },
          season: "FALL",
          seasonYear: 2026
        }
      ]);
    }
    expect(aniList.searchAnime).toHaveBeenCalledWith("生徒会にも穴はある！", 20);
    expect(aniList.searchAnime).toHaveBeenCalledTimes(6);
  });

  it("merges Chinese and Japanese search records that resolve to the same title match", async () => {
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async (query: string) => query === "学生会也有洞"
        ? [{
            id: 100,
            title: { native: "生徒会にも穴はある！" },
            synonyms: [],
            season: "FALL",
            seasonYear: 2026
          }]
        : [{
            id: 200,
            title: { romaji: "Seitokai ni mo Ana wa Aru!" },
            synonyms: ["生徒会にも穴はある！"],
            season: "FALL",
            seasonYear: 2026
          }]),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => null)
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async () => [{
        native: "生徒会にも穴はある！",
        chinese: "学生会也有洞！",
        aliases: ["脑洞学生会！", "Seitokai ni mo Ana wa Aru!"],
        releaseDate: "2026-10-03"
      }]),
      getCalendarTitles: vi.fn(async () => [])
    };

    const results = await new LocalizedAnimeProvider(aniList, chineseTitles)
      .searchAnime("学生会也有洞", 10);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 100,
      title: { chinese: "学生会也有洞！" },
      season: "FALL",
      seasonYear: 2026
    });
  });

  it("localizes related special entries from the closest Chinese season title without merging them", async () => {
    const animeEntries = [
      {
        id: 104462,
        title: {
          native: "とある科学の超電磁砲T",
          romaji: "Toaru Kagaku no Railgun T"
        },
        synonyms: [],
        format: "TV",
        season: "WINTER",
        seasonYear: 2020
      },
      {
        id: 122041,
        title: {
          native: "とある科学の超電磁砲T もっとまるっと超電磁砲",
          romaji: "Toaru Kagaku no Railgun T: Motto Marutto Railgun"
        },
        synonyms: ["Motto Marutto Railgun V", "Motto Marutto Railgun VI"],
        format: "SPECIAL",
        season: "SPRING",
        seasonYear: 2020
      },
      {
        id: 9047,
        title: {
          native: "とある科学の超電磁砲 御坂さんはいま注目の的ですから",
          romaji: "Toaru Kagaku no Railgun: Misaka-san wa Ima Chuumoku no Mato Desukara"
        },
        synonyms: ["Toaru Kagaku no Railgun OVA"],
        format: "OVA",
        season: "FALL",
        seasonYear: 2010
      }
    ];
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async () => animeEntries),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => null)
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async () => [
        {
          native: "とある科学の超電磁砲T",
          chinese: "某科学的超电磁炮T",
          aliases: ["Toaru Kagaku no Railgun T"]
        },
        {
          native: "とある科学の超電磁砲",
          chinese: "某科学的超电磁炮",
          aliases: ["Toaru Kagaku no Railgun"]
        }
      ]),
      getCalendarTitles: vi.fn(async () => [])
    };

    const results = await new LocalizedAnimeProvider(aniList, chineseTitles)
      .searchAnime("某科学的超电磁炮", 10);

    expect(results).toHaveLength(3);
    expect(results.map((anime) => anime.title.chinese)).toEqual([
      "某科学的超电磁炮T 特别篇",
      "某科学的超电磁炮T",
      "某科学的超电磁炮 OVA"
    ]);
    expect(results.map((anime) => anime.id)).toEqual([122041, 104462, 9047]);
  });

  it("starts direct search immediately and limits translated-title fan-out", async () => {
    let resolveTitles: ((matches: ChineseTitleMatch[]) => void) | undefined;
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => null)
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(() => new Promise<ChineseTitleMatch[]>((resolve) => {
        resolveTitles = resolve;
      })),
      getCalendarTitles: vi.fn(async () => [])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    const request = provider.searchAnime("学生会", 10);
    await vi.waitFor(() => expect(aniList.searchAnime).toHaveBeenCalledWith("学生会", 10));
    resolveTitles?.(Array.from({ length: 8 }, (_, index) => ({
      native: `候选${index + 1}`,
      chinese: `候选中文${index + 1}`,
      releaseDate: `${2026 - index}-10-01`
    })));
    await request;

    expect(aniList.searchAnime).toHaveBeenCalledTimes(3);
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

  it("localizes only anime airing inside the requested upcoming window", async () => {
    const anime = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      title: { native: `作品${index + 1}` },
      synonyms: []
    }));
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(async () => ({
        anime,
        events: [
          { animeId: 1, episode: 1, airingAt: 100 },
          { animeId: 2, episode: 2, airingAt: 150 }
        ]
      })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => null)
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async (query: string) => query === "作品2"
        ? [{ native: "作品2", chinese: "作品二" }]
        : []),
      getCalendarTitles: vi.fn(async () => [
        { native: "作品1", chinese: "作品一" }
      ])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    const schedule = await provider.getUpcomingAnimeSchedule(0, 200, "FALL", 2026);

    expect(schedule.anime.map((item) => item.id)).toEqual([1, 2]);
    expect(schedule.anime.map((item) => item.title.chinese)).toEqual(["作品一", "作品二"]);
    expect(chineseTitles.searchTitles).toHaveBeenCalledOnce();
    expect(chineseTitles.searchTitles).toHaveBeenCalledWith("作品2", 5);
  });

  it("starts the Bangumi calendar request while the upcoming AniList schedule is loading", async () => {
    let resolveSchedule: ((schedule: UpcomingAnimeSchedule) => void) | undefined;
    const aniList: AnimeProvider = {
      browseAnime: vi.fn(async (_filters, page: number) => ({ anime: [], hasNextPage: false, page, total: 0 })),
      searchAnime: vi.fn(async () => []),
      getAnime: vi.fn(async () => null),
      getAnimeSeries: vi.fn(async () => []),
      getAiringSchedule: vi.fn(async () => []),
      getUpcomingAnimeSchedule: vi.fn(() => new Promise<UpcomingAnimeSchedule>((resolve) => {
        resolveSchedule = resolve;
      })),
      getTrending: vi.fn(async () => []),
      getRandomAnime: vi.fn(async () => null)
    };
    const chineseTitles: ChineseTitleProvider = {
      searchTitles: vi.fn(async () => []),
      getCalendarTitles: vi.fn(async () => [])
    };
    const provider = new LocalizedAnimeProvider(aniList, chineseTitles);

    const request = provider.getUpcomingAnimeSchedule(0, 200, "FALL", 2026);
    await vi.waitFor(() => expect(aniList.getUpcomingAnimeSchedule).toHaveBeenCalledOnce());

    expect(chineseTitles.getCalendarTitles).toHaveBeenCalledOnce();
    resolveSchedule?.({
      anime: [{ id: 1, title: { native: "作品1" }, synonyms: [] }],
      events: [{ animeId: 1, episode: 1, airingAt: 100 }]
    });
    await request;
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

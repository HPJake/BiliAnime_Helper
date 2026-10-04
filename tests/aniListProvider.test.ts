import { describe, expect, it, vi } from "vitest";
import { AniListProvider } from "../services/anime/AniListProvider";
import { AnimeApiError } from "../services/anime/errors";

describe("AniListProvider", () => {
  it("calls browser fetch with the global object as its receiver", async () => {
    const browserLikeFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(
        Response.json({ data: { Page: { media: [{ id: 1, title: { romaji: "Browser" } }] } } })
      );
    });
    const provider = new AniListProvider(browserLikeFetch);

    await expect(provider.searchAnime("Browser")).resolves.toHaveLength(1);
  });

  it("searches anime and maps results without exposing raw data", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
      void _input;
      void _init;
      return Response.json({
        data: {
          Page: {
            media: [
              {
                id: 1,
                title: { romaji: "Test Anime" },
                synonyms: [],
                coverImage: { large: "cover.jpg" },
                isAdult: false
              },
              { id: 2, title: { romaji: "Adult" }, isAdult: true }
            ]
          }
        }
      });
    });
    const provider = new AniListProvider(fetcher);

    const result = await provider.searchAnime("Test", 5);

    expect(result).toEqual([
      { id: 1, title: { romaji: "Test Anime" }, synonyms: [], coverImage: "cover.jpg" }
    ]);
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as {
      variables: Record<string, unknown>;
    };
    expect(body.variables).toEqual({ search: "Test", perPage: 5 });
  });

  it("retrieves and sorts airing schedules", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
      void _input;
      void _init;
      return Response.json({
        data: {
          Page: {
            airingSchedules: [
              { mediaId: 1, episode: 2, airingAt: 200 },
              { mediaId: 1, episode: 1, airingAt: 100 },
              { mediaId: null, episode: 3, airingAt: 300 }
            ]
          }
        }
      });
    });
    const provider = new AniListProvider(fetcher);

    expect(await provider.getAiringSchedule(1, 0, 1_000)).toEqual([
      { animeId: 1, episode: 1, airingAt: 100 },
      { animeId: 1, episode: 2, airingAt: 200 }
    ]);
  });

  it("retrieves every upcoming schedule page for the current anime season", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: { page: number; mediaIds?: number[] };
      };
      if (body.query.includes("SeasonAnime")) {
        return Response.json({ data: { Page: {
          pageInfo: { hasNextPage: false },
          media: [
            { id: 10, title: { romaji: "Season A" }, isAdult: false },
            { id: 20, title: { romaji: "Season B" }, isAdult: false }
          ]
        } } });
      }
      return Response.json({ data: { Page: {
        pageInfo: { hasNextPage: body.variables.page === 1 },
        airingSchedules: body.variables.page === 1
          ? [{ mediaId: 20, episode: 2, airingAt: 200 }]
          : [{ mediaId: 10, episode: 1, airingAt: 100 }]
      } } });
    });
    const provider = new AniListProvider(fetcher);

    const schedule = await provider.getUpcomingAnimeSchedule(50, 250, "FALL", 2026);

    expect(schedule.anime.map((anime) => anime.id)).toEqual([10, 20]);
    expect(schedule.events).toEqual([
      { animeId: 10, episode: 1, airingAt: 100 },
      { animeId: 20, episode: 2, airingAt: 200 }
    ]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("walks sequel relations so following an older season includes the airing season", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { variables: { ids: number[] } };
      const id = body.variables.ids[0];
      const media = id === 161645
        ? [{
            id,
            title: { romaji: "Kusuriya no Hitorigoto" },
            relations: { edges: [{ relationType: "SEQUEL", node: { id: 176301, title: { romaji: "Kusuriya no Hitorigoto 2nd Season" } } }] }
          }]
        : id === 176301
          ? [{
              id,
              title: { romaji: "Kusuriya no Hitorigoto 2nd Season" },
              relations: { edges: [
                { relationType: "PREQUEL", node: { id: 161645, title: { romaji: "Kusuriya no Hitorigoto" } } },
                { relationType: "SEQUEL", node: { id: 195516, status: "RELEASING", title: { romaji: "Kusuriya no Hitorigoto 3rd Season" }, nextAiringEpisode: { episode: 2, airingAt: 1791554400 } } }
              ] }
            }]
          : [{ id, status: "RELEASING", title: { romaji: "Kusuriya no Hitorigoto 3rd Season" }, relations: { edges: [] } }];
      return Response.json({ data: { Page: { media } } });
    });
    const provider = new AniListProvider(fetcher);

    const series = await provider.getAnimeSeries(161645);

    expect(series.map((anime) => anime.id)).toEqual([161645, 176301, 195516]);
    expect(series[2]?.nextAiringEpisode).toEqual({
      animeId: 195516,
      episode: 2,
      airingAt: 1791554400
    });
  });

  it("normalizes rate limits without retrying", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response("rate limited", {
        status: 429,
        headers: { "Retry-After": "45" }
      });
    });
    const provider = new AniListProvider(fetcher);

    await expect(provider.getTrending()).rejects.toMatchObject({
      code: "rate_limited",
      options: { status: 429, retryAfterSeconds: 45 }
    } satisfies Partial<AnimeApiError>);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns the AniList trending order and filters adult results", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      expect(body.query).toContain("sort: TRENDING_DESC");
      expect(body.query).toContain("isAdult: false");
      expect(body.variables).toEqual({ perPage: 20 });
      return Response.json({ data: { Page: { media: [
        { id: 10, title: { romaji: "First" }, trending: 900, isAdult: false },
        { id: 20, title: { romaji: "Adult" }, trending: 800, isAdult: true },
        { id: 30, title: { romaji: "Second" }, trending: 700, isAdult: false }
      ] } } });
    });
    const provider = new AniListProvider(fetcher);

    expect((await provider.getTrending(20)).map((anime) => anime.id)).toEqual([10, 30]);
  });

  it("draws from a random year and prefers candidates with complete details", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      expect(body.query).toContain("startDate_like: $year");
      expect(body.query).toContain("isAdult: false");
      expect(body.query).toContain("format_in:");
      expect(body.variables).toEqual({ year: "1960%", excludedId: 7 });
      return Response.json({ data: { Page: { media: [
        { id: 1, title: { romaji: "Sparse" }, isAdult: false },
        {
          id: 2,
          title: { romaji: "Detailed" },
          coverImage: { large: "cover.jpg" },
          description: "Story",
          averageScore: 80,
          isAdult: false
        },
        {
          id: 3,
          title: { romaji: "Also detailed" },
          coverImage: { large: "cover-2.jpg" },
          description: "Story 2",
          isAdult: false
        }
      ] } } });
    });
    const randomValues = [0, 0.9];
    const provider = new AniListProvider(
      fetcher,
      () => true,
      () => randomValues.shift() ?? 0,
      () => 2026
    );

    await expect(provider.getRandomAnime(7)).resolves.toMatchObject({
      id: 3,
      description: "Story 2"
    });
  });

  it("normalizes GraphQL errors", async () => {
    const provider = new AniListProvider(async () =>
      Response.json({ errors: [{ message: "Invalid query" }] })
    );

    await expect(provider.getAnime(1)).rejects.toMatchObject({
      code: "graphql",
      message: "Invalid query"
    });
  });
});

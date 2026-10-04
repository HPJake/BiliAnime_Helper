import { describe, expect, it, vi } from "vitest";
import type { AnimeProvider } from "../services/anime/AnimeProvider";
import { AnimeService, CACHE_TTL } from "../services/anime/AnimeService";
import { CacheRepository } from "../utils/cache";
import { MemoryStorage } from "./helpers/memoryStorage";

function createProvider(): AnimeProvider {
  return {
    searchAnime: vi.fn(async () => []),
    getAnime: vi.fn(async (id: number) => ({ id, title: { romaji: "Fresh" }, synonyms: [] })),
    getAnimeSeries: vi.fn(async (id: number) => [{ id, title: { romaji: "Fresh" }, synonyms: [] }]),
    getAiringSchedule: vi.fn(async () => []),
    getUpcomingAnimeSchedule: vi.fn(async () => ({ anime: [], events: [] })),
    getTrending: vi.fn(async () => [])
  };
}

describe("AnimeService", () => {
  it("loads fresh metadata from cache", async () => {
    const storage = new MemoryStorage();
    const cache = new CacheRepository(storage, () => 1_000);
    await cache.set("metadata:v2:1", { id: 1, title: { romaji: "Cached" }, synonyms: [] }, 500);
    const provider = createProvider();
    const service = new AnimeService(provider, cache, () => 1_200);

    expect(await service.getAnime(1)).toEqual({
      data: { id: 1, title: { romaji: "Cached" }, synonyms: [] },
      source: "cache",
      stale: false
    });
    expect(provider.getAnime).not.toHaveBeenCalled();
  });

  it("falls back to stale metadata when the API fails", async () => {
    let time = 1_000;
    const storage = new MemoryStorage();
    const cache = new CacheRepository(storage, () => time);
    await cache.set("metadata:v2:1", { id: 1, title: { romaji: "Stale" }, synonyms: [] }, 100);
    time = 2_000;
    const provider = createProvider();
    vi.mocked(provider.getAnime).mockRejectedValueOnce(new Error("offline"));
    const service = new AnimeService(provider, cache, () => time);

    expect(await service.getAnime(1)).toEqual({
      data: { id: 1, title: { romaji: "Stale" }, synonyms: [] },
      source: "cache",
      stale: true
    });
  });

  it("caches a network search using the search TTL", async () => {
    let time = 10_000;
    const storage = new MemoryStorage();
    const cache = new CacheRepository(storage, () => time);
    const provider = createProvider();
    vi.mocked(provider.searchAnime).mockResolvedValueOnce([
      { id: 1, title: { romaji: "Result" }, synonyms: [] }
    ]);
    const service = new AnimeService(provider, cache, () => time);

    expect((await service.searchAnime(" Result ")).source).toBe("network");
    expect((await cache.get("search:v2:result:10"))?.expiresAt).toBe(time + CACHE_TTL.search);

    time += 100;
    expect((await service.searchAnime("result")).source).toBe("cache");
    expect(provider.searchAnime).toHaveBeenCalledTimes(1);
  });

  it("peeks cached schedules without triggering a network request", async () => {
    const storage = new MemoryStorage();
    const cache = new CacheRepository(storage, () => 1_000);
    await cache.set(
      "airing:1:100:200",
      [{ animeId: 1, episode: 3, airingAt: 150 }],
      500
    );
    const provider = createProvider();
    const service = new AnimeService(provider, cache, () => 1_200);

    expect(await service.getCachedAiringSchedule(1, 100, 200)).toEqual({
      data: [{ animeId: 1, episode: 3, airingAt: 150 }],
      source: "cache",
      stale: false
    });
    expect(provider.getAiringSchedule).not.toHaveBeenCalled();
  });

  it("caches the seasonal upcoming schedule", async () => {
    const storage = new MemoryStorage();
    const cache = new CacheRepository(storage, () => 1_000);
    const provider = createProvider();
    vi.mocked(provider.getUpcomingAnimeSchedule).mockResolvedValueOnce({
      anime: [{ id: 1, title: { romaji: "Season" }, synonyms: [] }],
      events: [{ animeId: 1, episode: 1, airingAt: 150 }]
    });
    const service = new AnimeService(provider, cache, () => 1_000);

    expect((await service.getUpcomingAnimeSchedule(100, 200, "FALL", 2026)).source).toBe("network");
    expect((await service.getUpcomingAnimeSchedule(100, 200, "FALL", 2026)).source).toBe("cache");
    expect(provider.getUpcomingAnimeSchedule).toHaveBeenCalledTimes(1);
  });

  it("uses the 30-minute trending cache and falls back to stale rankings", async () => {
    let time = 1_000;
    const storage = new MemoryStorage();
    const cache = new CacheRepository(storage, () => time);
    const provider = createProvider();
    vi.mocked(provider.getTrending).mockResolvedValueOnce([
      { id: 1, title: { romaji: "Trending" }, synonyms: [] }
    ]);
    const service = new AnimeService(provider, cache, () => time);

    expect((await service.getTrending(20)).source).toBe("network");
    expect((await cache.get("trending:v2:20"))?.expiresAt).toBe(time + CACHE_TTL.trending);
    expect((await service.getCachedTrending(20))?.data).toHaveLength(1);

    time += CACHE_TTL.trending + 1;
    vi.mocked(provider.getTrending).mockRejectedValueOnce(new Error("offline"));
    expect(await service.getTrending(20)).toMatchObject({ source: "cache", stale: true });
  });

  it("shares concurrent requests for the same cache key", async () => {
    const storage = new MemoryStorage();
    const provider = createProvider();
    let resolveRequest: ((anime: Awaited<ReturnType<AnimeProvider["getTrending"]>>) => void) | undefined;
    vi.mocked(provider.getTrending).mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const service = new AnimeService(provider, new CacheRepository(storage));

    const first = service.getTrending(20);
    const second = service.getTrending(20);
    await vi.waitFor(() => expect(provider.getTrending).toHaveBeenCalledTimes(1));
    resolveRequest?.([{ id: 1, title: {}, synonyms: [] }]);

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(provider.getTrending).toHaveBeenCalledTimes(1);
  });
});

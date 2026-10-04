import type { AiringEvent, AnimeSeason, UpcomingAnimeSchedule } from "../../domain/airing";
import type { Anime } from "../../domain/anime";
import { CacheRepository, isCacheFresh } from "../../utils/cache";
import type { AnimeProvider } from "./AnimeProvider";

export const CACHE_TTL = {
  metadata: 6 * 60 * 60 * 1000,
  airing: 30 * 60 * 1000,
  trending: 30 * 60 * 1000,
  search: 5 * 60 * 1000
} as const;

export type AnimeDataResult<T> = {
  data: T;
  source: "cache" | "network";
  stale: boolean;
};

export class AnimeService {
  private readonly inFlight = new Map<string, Promise<AnimeDataResult<unknown>>>();

  constructor(
    private readonly provider: AnimeProvider,
    private readonly cache: CacheRepository,
    private readonly now: () => number = Date.now
  ) {}

  searchAnime(query: string, limit = 10): Promise<AnimeDataResult<Anime[]>> {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return Promise.resolve({ data: [], source: "cache", stale: false });
    return this.load(`search:v2:${normalized}:${limit}`, CACHE_TTL.search, () =>
      this.provider.searchAnime(query.trim(), limit)
    );
  }

  getAnime(id: number): Promise<AnimeDataResult<Anime | null>> {
    return this.load(`metadata:v2:${id}`, CACHE_TTL.metadata, () => this.provider.getAnime(id));
  }

  getCachedAnime(id: number): Promise<AnimeDataResult<Anime | null> | null> {
    return this.peek(`metadata:v2:${id}`);
  }

  getAnimeSeries(id: number): Promise<AnimeDataResult<Anime[]>> {
    return this.load(`series:v1:${id}`, CACHE_TTL.airing, () => this.provider.getAnimeSeries(id));
  }

  getAiringSchedule(
    animeId: number,
    from: number,
    to: number
  ): Promise<AnimeDataResult<AiringEvent[]>> {
    return this.load(`airing:${animeId}:${from}:${to}`, CACHE_TTL.airing, () =>
      this.provider.getAiringSchedule(animeId, from, to)
    );
  }

  getCachedAiringSchedule(
    animeId: number,
    from: number,
    to: number
  ): Promise<AnimeDataResult<AiringEvent[]> | null> {
    return this.peek(`airing:${animeId}:${from}:${to}`);
  }

  getUpcomingAnimeSchedule(
    from: number,
    to: number,
    season: AnimeSeason,
    seasonYear: number
  ): Promise<AnimeDataResult<UpcomingAnimeSchedule>> {
    return this.load(
      `upcoming:v2:${season}:${seasonYear}:${from}:${to}`,
      CACHE_TTL.airing,
      () => this.provider.getUpcomingAnimeSchedule(from, to, season, seasonYear)
    );
  }

  getCachedUpcomingAnimeSchedule(
    from: number,
    to: number,
    season: AnimeSeason,
    seasonYear: number
  ): Promise<AnimeDataResult<UpcomingAnimeSchedule> | null> {
    return this.peek(`upcoming:v2:${season}:${seasonYear}:${from}:${to}`);
  }

  getTrending(limit = 20): Promise<AnimeDataResult<Anime[]>> {
    return this.load(`trending:v2:${limit}`, CACHE_TTL.trending, () =>
      this.provider.getTrending(limit)
    );
  }

  getCachedTrending(limit = 20): Promise<AnimeDataResult<Anime[]> | null> {
    return this.peek(`trending:v2:${limit}`);
  }

  private async peek<T>(key: string): Promise<AnimeDataResult<T> | null> {
    const cached = await this.cache.get<T>(key);
    if (!cached) return null;
    return {
      data: cached.value,
      source: "cache",
      stale: !isCacheFresh(cached, this.now())
    };
  }

  private async load<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>
  ): Promise<AnimeDataResult<T>> {
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<AnimeDataResult<T>>;

    const request = this.loadUnshared(key, ttlMs, loader);
    this.inFlight.set(key, request as Promise<AnimeDataResult<unknown>>);
    try {
      return await request;
    } finally {
      if (this.inFlight.get(key) === request) this.inFlight.delete(key);
    }
  }

  private async loadUnshared<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>
  ): Promise<AnimeDataResult<T>> {
    const cached = await this.cache.get<T>(key);
    if (cached && isCacheFresh(cached, this.now())) {
      return { data: cached.value, source: "cache", stale: false };
    }

    try {
      const data = await loader();
      await this.cache.set(key, data, ttlMs);
      return { data, source: "network", stale: false };
    } catch (error) {
      if (cached) return { data: cached.value, source: "cache", stale: true };
      throw error;
    }
  }
}

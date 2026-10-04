import type { AiringEvent, AnimeSeason, UpcomingAnimeSchedule } from "../../domain/airing";
import type { Anime, AnimeTitle } from "../../domain/anime";
import {
  DEFAULT_DISCOVERY_FILTERS,
  getDiscoveryYearRange,
  type DiscoveryFilters,
  type DiscoveryPage,
  type DiscoverySort
} from "../../domain/discovery";
import type { AnimeProvider } from "./AnimeProvider";
import { AnimeApiError, normalizeApiError, parseRetryAfter } from "./errors";
import {
  AIRING_SCHEDULE_QUERY,
  ANIME_BY_ID_QUERY,
  ANIME_SERIES_QUERY,
  DISCOVER_ANIME_QUERY,
  RANDOM_ANIME_QUERY,
  SEARCH_ANIME_QUERY,
  SEASON_ANIME_QUERY,
  UPCOMING_AIRING_QUERY,
  TRENDING_ANIME_QUERY
} from "./queries";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const DISCOVERY_FORMATS = ["TV", "TV_SHORT", "ONA", "OVA", "MOVIE"] as const;
const DEFAULT_RETRY_AFTER_SECONDS = 2;
const MAX_RETRY_AFTER_SECONDS = 45;

type AniListAiring = {
  mediaId?: number | null;
  episode?: number | null;
  airingAt?: number | null;
};

type AniListMedia = {
  id?: number | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
  synonyms?: Array<string | null> | null;
  coverImage?: { extraLarge?: string | null; large?: string | null; medium?: string | null } | null;
  description?: string | null;
  episodes?: number | null;
  format?: string | null;
  genres?: Array<string | null> | null;
  averageScore?: number | null;
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  popularity?: number | null;
  trending?: number | null;
  isAdult?: boolean | null;
  nextAiringEpisode?: AniListAiring | null;
  relations?: {
    edges?: Array<{
      relationType?: string | null;
      node?: AniListMedia | null;
    } | null> | null;
  } | null;
};

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class AniListProvider implements AnimeProvider {
  private requestTail: Promise<void> = Promise.resolve();
  private blockedUntil = 0;

  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly isOnline: () => boolean = () =>
      typeof navigator === "undefined" || navigator.onLine,
    private readonly random: () => number = Math.random,
    private readonly currentYear: () => number = () => new Date().getFullYear(),
    private readonly sleep: (milliseconds: number) => Promise<void> = wait,
    private readonly now: () => number = Date.now,
    private readonly requestIntervalMs = typeof window === "undefined" ? 0 : 700
  ) {}

  async searchAnime(query: string, limit = 10): Promise<Anime[]> {
    const search = query.trim();
    if (!search) return [];
    const data = await this.request<{ Page?: { media?: AniListMedia[] | null } | null }>(
      SEARCH_ANIME_QUERY,
      { search, perPage: clampLimit(limit) }
    );
    return mapAnimeList(data.Page?.media);
  }

  async getAnime(id: number): Promise<Anime | null> {
    const data = await this.request<{ Media?: AniListMedia | null }>(ANIME_BY_ID_QUERY, { id });
    return data.Media ? mapAniListMedia(data.Media) : null;
  }

  async browseAnime(
    filters: DiscoveryFilters,
    page: number,
    perPage = 10
  ): Promise<DiscoveryPage> {
    const range = getDiscoveryYearRange(filters.era, this.currentYear());
    const data = await this.request<{
      Page?: {
        pageInfo?: { hasNextPage?: boolean | null; total?: number | null } | null;
        media?: AniListMedia[] | null;
      } | null;
    }>(DISCOVER_ANIME_QUERY, {
      page: Math.max(1, Math.trunc(page)),
      perPage: clampLimit(perPage),
      formats: filters.format === "ALL" ? DISCOVERY_FORMATS : [filters.format],
      genres: filters.genres.length > 0 ? filters.genres : null,
      startDate: range.from * 10_000,
      endDate: range.to * 10_000 + 1231,
      sort: mapDiscoverySort(filters.sort)
    });
    return {
      anime: mapAnimeList(data.Page?.media),
      hasNextPage: data.Page?.pageInfo?.hasNextPage === true,
      page: Math.max(1, Math.trunc(page)),
      total: isFiniteNumber(data.Page?.pageInfo?.total) ? data.Page.pageInfo.total : 0
    };
  }

  async getRandomAnime(excludeId?: number, filters?: DiscoveryFilters): Promise<Anime | null> {
    const range = getDiscoveryYearRange(filters?.era ?? "ALL", this.currentYear());
    const firstYear = range.from;
    const lastYear = range.to;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const year = firstYear + randomIndex(lastYear - firstYear + 1, this.random);
      const data = await this.request<{ Page?: { media?: AniListMedia[] | null } | null }>(
        RANDOM_ANIME_QUERY,
        {
          year: `${year}%`,
          excludedId: excludeId ?? null,
          formats: filters && filters.format !== "ALL"
            ? [filters.format]
            : DISCOVERY_FORMATS,
          genres: filters && filters.genres.length > 0 ? filters.genres : null
        }
      );
      const candidates = mapAnimeList(data.Page?.media);
      if (candidates.length === 0) continue;
      const detailed = candidates.filter((anime) => anime.coverImage && anime.description);
      const pool = detailed.length > 0 ? detailed : candidates;
      return pool[randomIndex(pool.length, this.random)] ?? null;
    }
    const fallback = await this.browseAnime(filters ?? DEFAULT_DISCOVERY_FILTERS, 1, 50);
    const candidates = fallback.anime.filter((anime) => anime.id !== excludeId);
    return candidates[randomIndex(candidates.length, this.random)] ?? null;
  }

  async getAnimeSeries(id: number): Promise<Anime[]> {
    const discovered = new Map<number, Anime>();
    const visited = new Set<number>();
    let frontier = [id];

    for (let depth = 0; depth < 8 && frontier.length > 0; depth += 1) {
      const ids = frontier.filter((candidate) => !visited.has(candidate));
      if (ids.length === 0) break;
      ids.forEach((candidate) => visited.add(candidate));

      const data = await this.request<{ Page?: { media?: AniListMedia[] | null } | null }>(
        ANIME_SERIES_QUERY,
        { ids }
      );
      const nextIds = new Set<number>();
      for (const media of data.Page?.media ?? []) {
        const anime = mapAniListMedia(media);
        if (anime) discovered.set(anime.id, mergeAnime(discovered.get(anime.id), anime));

        for (const edge of media.relations?.edges ?? []) {
          if (!edge || (edge.relationType !== "PREQUEL" && edge.relationType !== "SEQUEL") || !edge.node) continue;
          const related = mapAniListMedia(edge.node);
          if (!related) continue;
          discovered.set(related.id, mergeAnime(discovered.get(related.id), related));
          if (!visited.has(related.id)) nextIds.add(related.id);
        }
      }
      frontier = [...nextIds];
    }

    return [...discovered.values()];
  }

  async getAiringSchedule(animeId: number, from: number, to: number): Promise<AiringEvent[]> {
    const data = await this.request<{
      Page?: { airingSchedules?: AniListAiring[] | null } | null;
    }>(AIRING_SCHEDULE_QUERY, { mediaId: animeId, from, to });
    return (data.Page?.airingSchedules ?? [])
      .map(mapAniListAiring)
      .filter((event): event is AiringEvent => event !== null)
      .sort((left, right) => left.airingAt - right.airingAt);
  }

  async getUpcomingAnimeSchedule(
    from: number,
    to: number,
    season: AnimeSeason,
    seasonYear: number
  ): Promise<UpcomingAnimeSchedule> {
    const anime: Anime[] = [];
    for (let page = 1; page <= 100; page += 1) {
      const data = await this.request<{
        Page?: {
          pageInfo?: { hasNextPage?: boolean | null } | null;
          media?: AniListMedia[] | null;
        } | null;
      }>(SEASON_ANIME_QUERY, { page, season, seasonYear });
      anime.push(...mapAnimeList(data.Page?.media));
      if (data.Page?.pageInfo?.hasNextPage !== true) break;
    }

    const mediaIds = [...new Set(anime.map((item) => item.id))];
    if (mediaIds.length === 0) return { anime: [], events: [] };

    const events: AiringEvent[] = [];
    for (let page = 1; page <= 100; page += 1) {
      const data = await this.request<{
        Page?: {
          pageInfo?: { hasNextPage?: boolean | null } | null;
          airingSchedules?: AniListAiring[] | null;
        } | null;
      }>(UPCOMING_AIRING_QUERY, { page, from, to, mediaIds });
      events.push(
        ...(data.Page?.airingSchedules ?? [])
          .map(mapAniListAiring)
          .filter((event): event is AiringEvent => event !== null)
      );
      if (data.Page?.pageInfo?.hasNextPage !== true) break;
    }

    return {
      anime,
      events: dedupeAiringEvents(events)
    };
  }

  async getTrending(limit = 20): Promise<Anime[]> {
    const data = await this.request<{ Page?: { media?: AniListMedia[] | null } | null }>(
      TRENDING_ANIME_QUERY,
      { perPage: clampLimit(limit) }
    );
    return mapAnimeList(data.Page?.media);
  }

  private async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    let response = await this.fetch(query, variables);
    if (response.status === 429) {
      response = await this.fetch(query, variables);
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new AnimeApiError("rate_limited", "AniList rate limit reached", {
          status: 429,
          retryAfterSeconds: retryAfter(response)
        });
      }
      throw new AnimeApiError("http", `AniList request failed with HTTP ${response.status}`, {
        status: response.status
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new AnimeApiError("invalid_response", "AniList returned invalid JSON", { cause: error });
    }

    if (!isRecord(payload)) {
      throw new AnimeApiError("invalid_response", "AniList returned an invalid response");
    }
    const errors = payload.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const message = errors
        .map((item) => (isRecord(item) && typeof item.message === "string" ? item.message : null))
        .filter((item): item is string => item !== null)
        .join("; ");
      throw new AnimeApiError("graphql", message || "AniList GraphQL request failed");
    }
    if (!("data" in payload) || !isRecord(payload.data)) {
      throw new AnimeApiError("invalid_response", "AniList response did not contain data");
    }
    return payload.data as T;
  }

  private async fetch(query: string, variables: Record<string, unknown>): Promise<Response> {
    const previous = this.requestTail;
    let release: (() => void) | undefined;
    this.requestTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const waitFor = this.blockedUntil - this.now();
      if (waitFor > 0) await this.sleep(waitFor);
      let response: Response;
      try {
        response = await this.fetcher.call(globalThis, ANILIST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query, variables })
        });
      } catch (error) {
        throw normalizeApiError(error, { offline: !this.isOnline() });
      }
      const cooldown = response.status === 429
        ? retryAfter(response) * 1000
        : this.requestIntervalMs;
      this.blockedUntil = Math.max(this.blockedUntil, this.now() + cooldown);
      return response;
    } finally {
      release?.();
    }
  }
}

export function mapAniListMedia(media: AniListMedia): Anime | null {
  if (!Number.isInteger(media.id) || Number(media.id) <= 0 || media.isAdult === true) return null;
  const animeId = Number(media.id);
  const title: AnimeTitle = compactTitle(media.title);
  const nextAiringEpisode = media.nextAiringEpisode
    ? mapAniListAiring({ ...media.nextAiringEpisode, mediaId: animeId })
    : null;

  return {
    id: animeId,
    title,
    synonyms: (media.synonyms ?? []).filter((item): item is string => typeof item === "string"),
    ...(isFiniteNumber(media.averageScore)
      ? { averageScore: media.averageScore, scoreSource: "AniList" as const }
      : {}),
    ...(firstString(
      media.coverImage?.extraLarge,
      media.coverImage?.large,
      media.coverImage?.medium
    )
      ? {
          coverImage: firstString(
            media.coverImage?.extraLarge,
            media.coverImage?.large,
            media.coverImage?.medium
          )
        }
      : {}),
    ...(typeof media.description === "string" && cleanDescription(media.description)
      ? { description: cleanDescription(media.description) }
      : {}),
    ...(isFiniteNumber(media.episodes) ? { episodes: media.episodes } : {}),
    ...(typeof media.format === "string" ? { format: media.format } : {}),
    ...(Array.isArray(media.genres)
      ? { genres: media.genres.filter((genre): genre is string => typeof genre === "string") }
      : {}),
    ...(typeof media.status === "string" ? { status: media.status } : {}),
    ...(typeof media.season === "string" ? { season: media.season } : {}),
    ...(isFiniteNumber(media.seasonYear) ? { seasonYear: media.seasonYear } : {}),
    ...(isFiniteNumber(media.popularity) ? { popularity: media.popularity } : {}),
    ...(isFiniteNumber(media.trending) ? { trending: media.trending } : {}),
    ...(nextAiringEpisode ? { nextAiringEpisode } : {})
  };
}

function mapAnimeList(media: AniListMedia[] | null | undefined): Anime[] {
  return (media ?? [])
    .map(mapAniListMedia)
    .filter((anime): anime is Anime => anime !== null);
}

function mapAniListAiring(event: AniListAiring): AiringEvent | null {
  if (
    !Number.isInteger(event.mediaId) ||
    Number(event.mediaId) <= 0 ||
    !Number.isInteger(event.episode) ||
    Number(event.episode) <= 0 ||
    !Number.isInteger(event.airingAt) ||
    Number(event.airingAt) <= 0
  ) {
    return null;
  }
  return {
    animeId: Number(event.mediaId),
    episode: Number(event.episode),
    airingAt: Number(event.airingAt)
  };
}

function dedupeAiringEvents(events: AiringEvent[]): AiringEvent[] {
  return [...new Map(events.map((event) => [
    `${event.animeId}:${event.episode}:${event.airingAt}`,
    event
  ])).values()].sort((left, right) => left.airingAt - right.airingAt);
}

function compactTitle(title: AniListMedia["title"]): AnimeTitle {
  return {
    ...(typeof title?.romaji === "string" ? { romaji: title.romaji } : {}),
    ...(typeof title?.english === "string" ? { english: title.english } : {}),
    ...(typeof title?.native === "string" ? { native: title.native } : {})
  };
}

function mergeAnime(existing: Anime | undefined, incoming: Anime): Anime {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    title: { ...existing.title, ...incoming.title },
    synonyms: incoming.synonyms.length > 0 ? incoming.synonyms : existing.synonyms,
    ...(existing.nextAiringEpisode && !incoming.nextAiringEpisode
      ? { nextAiringEpisode: existing.nextAiringEpisode }
      : {})
  };
}

function firstString(...values: Array<string | null | undefined>): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampLimit(limit: number): number {
  return Math.min(50, Math.max(1, Math.trunc(limit)));
}

function mapDiscoverySort(sort: DiscoverySort): string[] {
  if (sort === "SCORE") return ["SCORE_DESC", "POPULARITY_DESC"];
  if (sort === "NEWEST") return ["START_DATE_DESC", "POPULARITY_DESC"];
  if (sort === "TRENDING") return ["TRENDING_DESC", "POPULARITY_DESC"];
  return ["POPULARITY_DESC", "SCORE_DESC"];
}

function randomIndex(length: number, random: () => number): number {
  if (length <= 1) return 0;
  const value = Math.min(0.999999999, Math.max(0, random()));
  return Math.floor(value * length);
}

function retryAfter(response: Response): number {
  const parsed = parseRetryAfter(response.headers.get("Retry-After"));
  if (parsed === undefined) return DEFAULT_RETRY_AFTER_SECONDS;
  return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(0, parsed));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cleanDescription(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

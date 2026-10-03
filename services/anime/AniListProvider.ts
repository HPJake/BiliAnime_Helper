import type { AiringEvent } from "../../domain/airing";
import type { Anime, AnimeTitle } from "../../domain/anime";
import type { AnimeProvider } from "./AnimeProvider";
import { AnimeApiError, normalizeApiError, parseRetryAfter } from "./errors";
import {
  AIRING_SCHEDULE_QUERY,
  ANIME_BY_ID_QUERY,
  ANIME_SERIES_QUERY,
  SEARCH_ANIME_QUERY,
  TRENDING_ANIME_QUERY
} from "./queries";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

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
  episodes?: number | null;
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
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly isOnline: () => boolean = () =>
      typeof navigator === "undefined" || navigator.onLine
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

  async getTrending(limit = 20): Promise<Anime[]> {
    const data = await this.request<{ Page?: { media?: AniListMedia[] | null } | null }>(
      TRENDING_ANIME_QUERY,
      { perPage: clampLimit(limit) }
    );
    return mapAnimeList(data.Page?.media);
  }

  private async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
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

    if (!response.ok) {
      if (response.status === 429) {
        throw new AnimeApiError("rate_limited", "AniList rate limit reached", {
          status: 429,
          retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After"))
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
    ...(isFiniteNumber(media.episodes) ? { episodes: media.episodes } : {}),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

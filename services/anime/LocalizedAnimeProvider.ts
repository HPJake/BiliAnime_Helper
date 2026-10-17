import type { AiringEvent, AnimeSeason, UpcomingAnimeSchedule } from "../../domain/airing";
import type { Anime } from "../../domain/anime";
import type { DiscoveryFilters, DiscoveryPage } from "../../domain/discovery";
import type { AnimeProvider } from "./AnimeProvider";
import type { ChineseTitleMatch, ChineseTitleProvider } from "./BangumiTitleProvider";

const TITLE_LOOKUP_CONCURRENCY = 4;
const SEARCH_EXPANSION_LIMIT = 2;

export class LocalizedAnimeProvider implements AnimeProvider {
  private readonly chineseTitleLookups = new Map<string, Promise<ChineseTitleMatch | null>>();

  constructor(
    private readonly animeProvider: AnimeProvider,
    private readonly chineseTitles: ChineseTitleProvider
  ) {}

  async searchAnime(query: string, limit = 10): Promise<Anime[]> {
    const directRequest = settle(this.animeProvider.searchAnime(query, limit));
    const matches = await this.safeSearchTitles(query, Math.max(limit, 10));
    const expandedQueries = rankChineseTitleMatches(query, matches)
      .map((match) => match.native)
      .filter((expandedQuery, index, queries) =>
        normalize(expandedQuery) !== normalize(query) &&
        queries.findIndex((candidate) => normalize(candidate) === normalize(expandedQuery)) === index
      )
      .slice(0, SEARCH_EXPANSION_LIMIT);
    const settledRequests: Array<PromiseSettledResult<Anime[]>> = [];
    const primaryExpandedQuery = expandedQueries[0];
    if (primaryExpandedQuery) {
      const [directResult, expandedResult] = await Promise.all([
        directRequest,
        settle(this.animeProvider.searchAnime(primaryExpandedQuery, Math.max(limit, 20)))
      ]);
      settledRequests.push(directResult, expandedResult);
      const fallbackExpandedQuery = expandedQueries[1];
      if (!hasAnimeResults(expandedResult) && fallbackExpandedQuery) {
        settledRequests.push(await settle(
          this.animeProvider.searchAnime(fallbackExpandedQuery, Math.max(limit, 20))
        ));
      }
    } else {
      settledRequests.push(await directRequest);
    }
    const fulfilled = settledRequests
      .filter((result): result is PromiseFulfilledResult<Anime[]> => result.status === "fulfilled");
    if (fulfilled.length === 0) {
      const failure = settledRequests
        .find((result): result is PromiseRejectedResult => result.status === "rejected");
      throw failure?.reason ?? new Error("动画搜索失败");
    }
    const successful = fulfilled.flatMap((result) => result.value);
    return sortAnimeByNewestSeason(enrichAndDedupe(successful, matches))
      .slice(0, Math.max(limit, 20));
  }

  async getAnime(id: number): Promise<Anime | null> {
    const anime = await this.animeProvider.getAnime(id);
    if (!anime) return null;
    const match = await this.lookupChineseTitleForAnime(anime);
    return match ? applyChineseMatch(anime, match) : anime;
  }

  async browseAnime(
    filters: DiscoveryFilters,
    page: number,
    perPage?: number
  ): Promise<DiscoveryPage> {
    const result = await this.animeProvider.browseAnime(filters, page, perPage);
    return {
      ...result,
      anime: await this.enrichMissingChineseTitles(result.anime, [])
    };
  }

  async getRandomAnime(excludeId?: number, filters?: DiscoveryFilters): Promise<Anime | null> {
    const anime = await this.animeProvider.getRandomAnime(excludeId, filters);
    if (!anime) return null;
    const match = await this.lookupChineseTitleForAnime(anime);
    const localized = removeDescription(anime);
    return match ? applyChineseMatch(localized, match) : localized;
  }

  async getAnimeSeries(id: number): Promise<Anime[]> {
    const series = await this.animeProvider.getAnimeSeries(id);
    const earliest = [...series].sort((left, right) =>
      (left.seasonYear ?? Number.MAX_SAFE_INTEGER) - (right.seasonYear ?? Number.MAX_SAFE_INTEGER)
    )[0];
    const query = earliest?.title.native || earliest?.title.romaji || earliest?.title.english;
    const matches = query ? await this.safeSearchTitles(query, 20) : [];
    return enrichAndDedupe(series, matches);
  }

  getAiringSchedule(animeId: number, from: number, to: number): Promise<AiringEvent[]> {
    return this.animeProvider.getAiringSchedule(animeId, from, to);
  }

  async getUpcomingAnimeSchedule(
    from: number,
    to: number,
    season: AnimeSeason,
    seasonYear: number
  ): Promise<UpcomingAnimeSchedule> {
    const scheduleRequest = this.animeProvider.getUpcomingAnimeSchedule(
      from,
      to,
      season,
      seasonYear
    );
    const calendarTitlesRequest = this.safeCalendarTitles();
    const schedule = await scheduleRequest;
    const scheduledAnimeIds = new Set(schedule.events.map((event) => event.animeId));
    const scheduledAnime = schedule.anime.filter((anime) => scheduledAnimeIds.has(anime.id));
    if (scheduledAnime.length === 0) {
      return { ...schedule, anime: [] };
    }

    const matches = await calendarTitlesRequest;
    return {
      ...schedule,
      anime: await this.enrichMissingChineseTitles(scheduledAnime, matches)
    };
  }

  async getTrending(limit?: number): Promise<Anime[]> {
    const [anime, matches] = await Promise.all([
      this.animeProvider.getTrending(limit),
      this.safeCalendarTitles()
    ]);
    return this.enrichMissingChineseTitles(anime, matches);
  }

  private async enrichMissingChineseTitles(
    anime: Anime[],
    matches: ChineseTitleMatch[]
  ): Promise<Anime[]> {
    const localized = enrichAndDedupe(anime, matches);
    const missing = localized.filter((item) => !item.title.chinese);
    const resolved = await mapWithConcurrency(
      missing,
      TITLE_LOOKUP_CONCURRENCY,
      async (item) => {
        const match = await this.lookupChineseTitleForAnime(item);
        return match ? { animeId: item.id, match } : null;
      }
    );
    const matchByAnimeId = new Map(
      resolved
        .filter((item): item is { animeId: number; match: ChineseTitleMatch } => item !== null)
        .map((item) => [item.animeId, item.match])
    );
    return localized.map((item) => {
      const match = matchByAnimeId.get(item.id);
      return match ? applyChineseMatch(item, match) : item;
    });
  }

  private async lookupChineseTitleForAnime(anime: Anime): Promise<ChineseTitleMatch | null> {
    const queries = [
      anime.title.native,
      anime.title.romaji,
      anime.title.english,
      ...anime.synonyms
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    const seen = new Set<string>();
    for (const query of queries) {
      const key = normalize(query);
      if (seen.has(key)) continue;
      seen.add(key);
      const match = await this.lookupChineseTitle(query);
      if (match) return match;
    }
    return null;
  }

  private lookupChineseTitle(query: string): Promise<ChineseTitleMatch | null> {
    const key = normalize(query);
    const existing = this.chineseTitleLookups.get(key);
    if (existing) return existing;
    const lookup = this.safeSearchTitles(query, 5).then((candidates) => {
      return rankChineseTitleMatches(query, candidates)[0] ?? null;
    });
    this.chineseTitleLookups.set(key, lookup);
    return lookup;
  }

  private async safeSearchTitles(query: string, limit: number): Promise<ChineseTitleMatch[]> {
    try {
      return await this.chineseTitles.searchTitles(query, limit);
    } catch {
      return [];
    }
  }


  private async safeCalendarTitles(): Promise<ChineseTitleMatch[]> {
    try {
      return await this.chineseTitles.getCalendarTitles();
    } catch {
      return [];
    }
  }
}

function settle<T>(request: Promise<T>): Promise<PromiseSettledResult<T>> {
  return request.then(
    (value) => ({ status: "fulfilled", value }),
    (reason: unknown) => ({ status: "rejected", reason })
  );
}

function hasAnimeResults(result: PromiseSettledResult<Anime[]>): boolean {
  return result.status === "fulfilled" && result.value.length > 0;
}

function rankChineseTitleMatches(
  query: string,
  matches: ChineseTitleMatch[]
): ChineseTitleMatch[] {
  const normalizedQuery = normalize(query);
  return matches
    .map((match, index) => ({ match, index }))
    .sort((left, right) => {
      const exactDifference = Number(matchesQuery(right.match, normalizedQuery))
        - Number(matchesQuery(left.match, normalizedQuery));
      if (exactDifference !== 0) return exactDifference;
      const dateDifference = releaseTime(right.match.releaseDate) - releaseTime(left.match.releaseDate);
      return dateDifference || left.index - right.index;
    })
    .map(({ match }) => match);
}

function matchesQuery(match: ChineseTitleMatch, normalizedQuery: string): boolean {
  return [match.native, match.chinese, ...(match.aliases ?? [])]
    .some((title) => normalize(title) === normalizedQuery);
}

function releaseTime(value: string | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function enrichAndDedupe(anime: Anime[], matches: ChineseTitleMatch[]): Anime[] {
  const unique = new Map<string, Anime>();
  for (const item of anime) {
    const match = findChineseMatch(item, matches);
    const localized = match ? applyChineseMatch(item, match) : item;
    const key = match && isExactChineseMatch(item, match)
      ? `title:${normalize(match.native)}`
      : `id:${item.id}`;
    const existing = unique.get(key);
    unique.set(key, existing ? mergeAnimeRecords(existing, localized) : localized);
  }
  return [...unique.values()];
}

function findChineseMatch(
  anime: Anime,
  matches: ChineseTitleMatch[]
): ChineseTitleMatch | undefined {
  const animeTitles = [
    anime.title.native,
    anime.title.romaji,
    anime.title.english,
    anime.title.chinese,
    ...anime.synonyms
  ]
    .filter((title): title is string => typeof title === "string" && title.trim().length > 0)
    .map(normalize);
  const exact = matches.find((match) => isExactChineseMatch(anime, match));
  if (exact) return exact;

  return matches
    .flatMap((match, index) => [match.native, match.chinese, ...(match.aliases ?? [])]
      .map(normalize)
      .filter((matchTitle) => matchTitle.length >= 8 &&
        animeTitles.some((animeTitle) => animeTitle.startsWith(matchTitle)))
      .map((matchedTitle) => ({ match, index, matchedTitle })))
    .sort((left, right) => right.matchedTitle.length - left.matchedTitle.length || left.index - right.index)[0]
    ?.match;
}

function isExactChineseMatch(anime: Anime, match: ChineseTitleMatch): boolean {
  const matchTitles = new Set([match.native, match.chinese, ...(match.aliases ?? [])].map(normalize));
  return [anime.title.native, anime.title.romaji, anime.title.english, anime.title.chinese, ...anime.synonyms]
    .some((title) => typeof title === "string" && matchTitles.has(normalize(title)));
}

function mergeAnimeRecords(existing: Anime, incoming: Anime): Anime {
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    title: { ...incoming.title, ...existing.title },
    synonyms: [...new Set([...existing.synonyms, ...incoming.synonyms])]
  };
}

function applyChineseMatch(anime: Anime, match: ChineseTitleMatch): Anime {
  const inheritedSuffix = isExactChineseMatch(anime, match)
    ? ""
    : anime.format === "SPECIAL"
      ? " 特别篇"
      : anime.format === "OVA"
        ? " OVA"
        : "";
  return {
    ...anime,
    title: { ...anime.title, chinese: `${match.chinese}${inheritedSuffix}` },
    synonyms: [...new Set([...anime.synonyms, ...(match.aliases ?? [])])],
    ...(match.summary ? { description: match.summary } : {}),
    ...(match.score !== undefined
      ? { averageScore: match.score * 10, scoreSource: "Bangumi" as const }
      : {})
  };
}

function removeDescription(anime: Anime): Anime {
  const result = { ...anime };
  delete result.description;
  return result;
}

export function sortAnimeByNewestSeason(anime: Anime[]): Anime[] {
  const seasonOrder: Record<string, number> = {
    WINTER: 1,
    SPRING: 2,
    SUMMER: 3,
    FALL: 4
  };
  return anime
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const yearDifference = (right.item.seasonYear ?? -1) - (left.item.seasonYear ?? -1);
      if (yearDifference !== 0) return yearDifference;
      const seasonDifference = (seasonOrder[right.item.season ?? ""] ?? -1)
        - (seasonOrder[left.item.season ?? ""] ?? -1);
      return seasonDifference || left.index - right.index;
    })
    .map(({ item }) => item);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

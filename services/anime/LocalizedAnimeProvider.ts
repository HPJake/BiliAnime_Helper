import type { AiringEvent, AnimeSeason, UpcomingAnimeSchedule } from "../../domain/airing";
import type { Anime } from "../../domain/anime";
import type { AnimeProvider } from "./AnimeProvider";
import type { ChineseTitleMatch, ChineseTitleProvider } from "./BangumiTitleProvider";

const TITLE_LOOKUP_CONCURRENCY = 4;

export class LocalizedAnimeProvider implements AnimeProvider {
  private readonly chineseTitleLookups = new Map<string, Promise<ChineseTitleMatch | null>>();

  constructor(
    private readonly animeProvider: AnimeProvider,
    private readonly chineseTitles: ChineseTitleProvider
  ) {}

  async searchAnime(query: string, limit = 10): Promise<Anime[]> {
    const matches = await this.safeSearchTitles(query, Math.max(limit, 10));
    const expandedQuery = matches[0]?.native;
    const requests = [this.animeProvider.searchAnime(query, limit)];
    if (expandedQuery && normalize(expandedQuery) !== normalize(query)) {
      requests.push(this.animeProvider.searchAnime(expandedQuery, Math.max(limit, 20)));
    }
    const settled = await Promise.allSettled(requests);
    const successful = settled
      .filter((result): result is PromiseFulfilledResult<Anime[]> => result.status === "fulfilled")
      .flatMap((result) => result.value);
    if (successful.length === 0) {
      const failure = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
      throw failure?.reason ?? new Error("动画搜索失败");
    }
    return sortAnimeByNewestSeason(enrichAndDedupe(successful, matches))
      .slice(0, Math.max(limit, 20));
  }

  async getAnime(id: number): Promise<Anime | null> {
    const anime = await this.animeProvider.getAnime(id);
    if (!anime) return null;
    const query = anime.title.native || anime.title.romaji || anime.title.english;
    if (!query) return anime;
    return enrichAnime(anime, await this.safeSearchTitles(query, 10));
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
    const schedule = await this.animeProvider.getUpcomingAnimeSchedule(
      from,
      to,
      season,
      seasonYear
    );
    const matches = await this.safeCalendarTitles();
    return {
      ...schedule,
      anime: await this.enrichMissingChineseTitles(schedule.anime, matches)
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
        const query = item.title.native || item.title.romaji || item.title.english;
        if (!query) return null;
        const match = await this.lookupChineseTitle(query);
        return match ? { animeId: item.id, chinese: match.chinese } : null;
      }
    );
    const chineseByAnimeId = new Map(
      resolved
        .filter((item): item is { animeId: number; chinese: string } => item !== null)
        .map((item) => [item.animeId, item.chinese])
    );
    return localized.map((item) => {
      const chinese = chineseByAnimeId.get(item.id);
      return chinese ? { ...item, title: { ...item.title, chinese } } : item;
    });
  }

  private lookupChineseTitle(query: string): Promise<ChineseTitleMatch | null> {
    const key = normalize(query);
    const existing = this.chineseTitleLookups.get(key);
    if (existing) return existing;
    const lookup = this.safeSearchTitles(query, 5).then((candidates) => {
      const exact = candidates.find((candidate) => normalize(candidate.native) === key);
      return exact ?? candidates[0] ?? null;
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

function enrichAndDedupe(anime: Anime[], matches: ChineseTitleMatch[]): Anime[] {
  const unique = new Map<number, Anime>();
  for (const item of anime) unique.set(item.id, enrichAnime(item, matches));
  return [...unique.values()];
}

function enrichAnime(anime: Anime, matches: ChineseTitleMatch[]): Anime {
  const native = anime.title.native && normalize(anime.title.native);
  const match = native ? matches.find((candidate) => normalize(candidate.native) === native) : undefined;
  return match ? { ...anime, title: { ...anime.title, chinese: match.chinese } } : anime;
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
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

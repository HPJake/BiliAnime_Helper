import type { AiringEvent } from "../../domain/airing";
import type { Anime } from "../../domain/anime";
import type { AnimeProvider } from "./AnimeProvider";
import type { ChineseTitleMatch, ChineseTitleProvider } from "./BangumiTitleProvider";

export class LocalizedAnimeProvider implements AnimeProvider {
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
    return enrichAndDedupe(successful, matches).slice(0, Math.max(limit, 20));
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

  getTrending(limit?: number): Promise<Anime[]> {
    return this.animeProvider.getTrending(limit);
  }

  private async safeSearchTitles(query: string, limit: number): Promise<ChineseTitleMatch[]> {
    try {
      return await this.chineseTitles.searchTitles(query, limit);
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

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

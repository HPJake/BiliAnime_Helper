import type { AiringEvent } from "../../domain/airing";
import type { AnimeSeason, UpcomingAnimeSchedule } from "../../domain/airing";
import type { Anime } from "../../domain/anime";
import type { DiscoveryFilters, DiscoveryPage } from "../../domain/discovery";

export interface AnimeProvider {
  searchAnime(query: string, limit?: number): Promise<Anime[]>;
  getAnime(id: number): Promise<Anime | null>;
  browseAnime(filters: DiscoveryFilters, page: number, perPage?: number): Promise<DiscoveryPage>;
  getRandomAnime(excludeId?: number, filters?: DiscoveryFilters): Promise<Anime | null>;
  getAnimeSeries(id: number): Promise<Anime[]>;
  getAiringSchedule(animeId: number, from: number, to: number): Promise<AiringEvent[]>;
  getUpcomingAnimeSchedule(
    from: number,
    to: number,
    season: AnimeSeason,
    seasonYear: number
  ): Promise<UpcomingAnimeSchedule>;
  getTrending(limit?: number): Promise<Anime[]>;
}

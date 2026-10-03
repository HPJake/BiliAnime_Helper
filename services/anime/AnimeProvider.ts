import type { AiringEvent } from "../../domain/airing";
import type { Anime } from "../../domain/anime";

export interface AnimeProvider {
  searchAnime(query: string, limit?: number): Promise<Anime[]>;
  getAnime(id: number): Promise<Anime | null>;
  getAnimeSeries(id: number): Promise<Anime[]>;
  getAiringSchedule(animeId: number, from: number, to: number): Promise<AiringEvent[]>;
  getTrending(limit?: number): Promise<Anime[]>;
}

import type { Anime } from "./anime";

export type AiringEvent = {
  animeId: number;
  episode: number;
  airingAt: number;
};

export type AnimeSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export type UpcomingAnimeSchedule = {
  anime: Anime[];
  events: AiringEvent[];
};

import type { AiringEvent } from "./airing";

export type AnimeTitle = {
  chinese?: string;
  romaji?: string;
  english?: string;
  native?: string;
};

export type Anime = {
  id: number;
  title: AnimeTitle;
  synonyms: string[];
  coverImage?: string;
  episodes?: number;
  status?: string;
  season?: string;
  seasonYear?: number;
  popularity?: number;
  trending?: number;
  nextAiringEpisode?: AiringEvent;
};

export type FollowedAnime = {
  aniListId: number;
  addedAt: number;
  bilibiliSearchAlias?: string;
};

export function getAnimeDisplayTitle(anime: Anime): string {
  return anime.title.chinese || anime.title.native || anime.title.romaji || anime.title.english || `AniList ${anime.id}`;
}

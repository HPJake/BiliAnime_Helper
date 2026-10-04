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
  averageScore?: number;
  coverImage?: string;
  description?: string;
  episodes?: number;
  format?: string;
  genres?: string[];
  status?: string;
  season?: string;
  seasonYear?: number;
  popularity?: number;
  scoreSource?: "AniList" | "Bangumi";
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

export function getChineseAnimeDisplayTitle(anime: Anime): string {
  const chinese = anime.title.chinese?.trim();
  return chinese || `中文标题待补充（AniList #${anime.id}）`;
}

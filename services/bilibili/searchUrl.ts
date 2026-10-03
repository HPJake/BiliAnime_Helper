import type { Anime } from "../../domain/anime";

export function getBilibiliSearchTitle(anime: Anime, bilibiliSearchAlias?: string): string {
  return (
    bilibiliSearchAlias?.trim() ||
    anime.title.chinese?.trim() ||
    anime.title.native?.trim() ||
    anime.title.romaji?.trim() ||
    anime.title.english?.trim() ||
    `AniList ${anime.id}`
  );
}

export function createBilibiliSearchUrl(anime: Anime, bilibiliSearchAlias?: string): string {
  const title = getBilibiliSearchTitle(anime, bilibiliSearchAlias);
  return createBilibiliSearchUrlFromTitle(title);
}

export function createBilibiliSearchUrlFromTitle(title: string): string {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(title.trim())}`;
}

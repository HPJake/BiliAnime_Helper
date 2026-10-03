import type { Anime } from "../../domain/anime";

export type TrendingMetadata = {
  airing: string | null;
  summary: string;
};

export function getTrendingMetadata(anime: Anime): TrendingMetadata {
  const season = [
    anime.seasonYear,
    anime.season ? formatSeason(anime.season) : null
  ].filter(Boolean).join(" ");
  const summary = [
    season || null,
    anime.status ? formatAnimeStatus(anime.status) : null,
    anime.episodes ? `共 ${anime.episodes} 集` : null
  ].filter(Boolean).join(" · ") || "动画";
  const next = anime.nextAiringEpisode;
  return {
    summary,
    airing: next
      ? `下一集：第 ${next.episode} 集 · ${formatAiringTime(next.airingAt)}`
      : null
  };
}

export function formatAnimeStatus(status: string): string {
  const labels: Record<string, string> = {
    FINISHED: "已完结",
    RELEASING: "播出中",
    NOT_YET_RELEASED: "未播出",
    CANCELLED: "已取消",
    HIATUS: "暂停播出"
  };
  return labels[status] ?? status;
}

function formatSeason(season: string): string {
  const labels: Record<string, string> = {
    WINTER: "冬季",
    SPRING: "春季",
    SUMMER: "夏季",
    FALL: "秋季"
  };
  return labels[season] ?? season;
}

function formatAiringTime(airingAt: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(airingAt * 1000));
}

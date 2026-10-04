import type { Anime } from "../../domain/anime";

export function formatRandomAnimeScore(anime: Anime): string {
  if (anime.averageScore === undefined) return "暂无评分";
  return `${(anime.averageScore / 10).toFixed(1)} / 10 · ${anime.scoreSource ?? "AniList"}`;
}

export function getRandomAnimeFacts(anime: Anime): string[] {
  return [
    anime.seasonYear ? `${anime.seasonYear}年` : null,
    anime.season ? formatSeason(anime.season) : null,
    anime.format ? formatAnimeFormat(anime.format) : null,
    anime.episodes ? `${anime.episodes} 集` : null,
    anime.status ? formatStatus(anime.status) : null
  ].filter((item): item is string => item !== null);
}

export function formatRandomAnimeGenres(genres: string[] | undefined): string[] {
  if (!genres) return [];
  const labels: Record<string, string> = {
    Action: "动作",
    Adventure: "冒险",
    Comedy: "喜剧",
    Drama: "剧情",
    Ecchi: "卖肉",
    Fantasy: "奇幻",
    Horror: "恐怖",
    "Mahou Shoujo": "魔法少女",
    Mecha: "机甲",
    Music: "音乐",
    Mystery: "悬疑",
    Psychological: "心理",
    Romance: "恋爱",
    "Sci-Fi": "科幻",
    "Slice of Life": "日常",
    Sports: "运动",
    Supernatural: "超自然",
    Thriller: "惊悚"
  };
  return genres.map((genre) => labels[genre] ?? genre);
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

function formatAnimeFormat(format: string): string {
  const labels: Record<string, string> = {
    TV: "电视动画",
    TV_SHORT: "短篇动画",
    MOVIE: "剧场版",
    SPECIAL: "特别篇",
    OVA: "OVA",
    ONA: "网络动画",
    MUSIC: "音乐动画"
  };
  return labels[format] ?? format;
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    FINISHED: "已完结",
    RELEASING: "播出中",
    NOT_YET_RELEASED: "未播出",
    CANCELLED: "已取消",
    HIATUS: "暂停播出"
  };
  return labels[status] ?? status;
}

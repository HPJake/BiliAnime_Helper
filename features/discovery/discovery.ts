import {
  DEFAULT_DISCOVERY_FILTERS,
  type DiscoveryEra,
  type DiscoveryFilters,
  type DiscoveryFormat,
  type DiscoverySort
} from "../../domain/discovery";

export const FORMAT_OPTIONS: Array<{ label: string; value: DiscoveryFormat | "ALL" }> = [
  { label: "全部", value: "ALL" },
  { label: "TV", value: "TV" },
  { label: "短篇", value: "TV_SHORT" },
  { label: "网络动画", value: "ONA" },
  { label: "OVA", value: "OVA" },
  { label: "剧场版", value: "MOVIE" }
];

export const GENRE_OPTIONS = [
  { label: "动作", value: "Action" },
  { label: "冒险", value: "Adventure" },
  { label: "喜剧", value: "Comedy" },
  { label: "剧情", value: "Drama" },
  { label: "奇幻", value: "Fantasy" },
  { label: "恋爱", value: "Romance" },
  { label: "科幻", value: "Sci-Fi" },
  { label: "悬疑", value: "Mystery" },
  { label: "日常", value: "Slice of Life" },
  { label: "运动", value: "Sports" },
  { label: "音乐", value: "Music" },
  { label: "恐怖", value: "Horror" },
  { label: "机甲", value: "Mecha" },
  { label: "心理", value: "Psychological" }
] as const;

export const ERA_OPTIONS: Array<{ label: string; value: DiscoveryEra }> = [
  { label: "全部", value: "ALL" },
  { label: "2020年代", value: "2020S" },
  { label: "2010年代", value: "2010S" },
  { label: "2000年代", value: "2000S" },
  { label: "经典老番", value: "CLASSIC" }
];

export const SORT_OPTIONS: Array<{ label: string; value: DiscoverySort }> = [
  { label: "综合推荐", value: "POPULARITY" },
  { label: "评分最高", value: "SCORE" },
  { label: "最新播出", value: "NEWEST" },
  { label: "近期热度", value: "TRENDING" }
];

export function toggleDiscoveryGenre(filters: DiscoveryFilters, genre: string): DiscoveryFilters {
  if (filters.genres.includes(genre)) {
    return { ...filters, genres: filters.genres.filter((item) => item !== genre) };
  }
  if (filters.genres.length >= 2) return filters;
  return { ...filters, genres: [...filters.genres, genre] };
}

export function isDefaultDiscoveryFilters(filters: DiscoveryFilters): boolean {
  return filters.format === DEFAULT_DISCOVERY_FILTERS.format
    && filters.era === DEFAULT_DISCOVERY_FILTERS.era
    && filters.sort === DEFAULT_DISCOVERY_FILTERS.sort
    && filters.genres.length === 0;
}

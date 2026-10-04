import type { Anime } from "./anime";

export type DiscoveryFormat = "TV" | "TV_SHORT" | "ONA" | "OVA" | "MOVIE";
export type DiscoveryEra = "ALL" | "2020S" | "2010S" | "2000S" | "CLASSIC";
export type DiscoverySort = "POPULARITY" | "SCORE" | "NEWEST" | "TRENDING";

export type DiscoveryFilters = {
  era: DiscoveryEra;
  format: DiscoveryFormat | "ALL";
  genres: string[];
  sort: DiscoverySort;
};

export type DiscoveryPage = {
  anime: Anime[];
  hasNextPage: boolean;
  page: number;
  total: number;
};

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  era: "ALL",
  format: "ALL",
  genres: [],
  sort: "POPULARITY"
};

export function getDiscoveryYearRange(
  era: DiscoveryEra,
  currentYear = new Date().getFullYear()
): { from: number; to: number } {
  if (era === "2020S") return { from: 2020, to: currentYear + 1 };
  if (era === "2010S") return { from: 2010, to: 2019 };
  if (era === "2000S") return { from: 2000, to: 2009 };
  if (era === "CLASSIC") return { from: 1960, to: 1999 };
  return { from: 1960, to: currentYear + 1 };
}

export function serializeDiscoveryFilters(filters: DiscoveryFilters): string {
  return [
    filters.format,
    [...filters.genres].sort().join(",") || "ALL",
    filters.era,
    filters.sort
  ].join(":");
}

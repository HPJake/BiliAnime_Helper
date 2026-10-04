import { describe, expect, it } from "vitest";
import {
  formatRandomAnimeGenres,
  formatRandomAnimeScore,
  getRandomAnimeFacts
} from "../features/random/randomAnime";

describe("random anime presentation", () => {
  it("formats score, facts, and genre labels in Chinese", () => {
    const anime = {
      id: 1,
      title: {},
      synonyms: [],
      averageScore: 89,
      scoreSource: "Bangumi" as const,
      seasonYear: 2023,
      season: "FALL",
      format: "TV",
      episodes: 28,
      status: "FINISHED",
      genres: ["Adventure", "Fantasy", "Historical"]
    };

    expect(formatRandomAnimeScore(anime)).toBe("8.9 / 10 · Bangumi");
    expect(getRandomAnimeFacts(anime)).toEqual([
      "2023年",
      "秋季",
      "电视动画",
      "28 集",
      "已完结"
    ]);
    expect(formatRandomAnimeGenres(anime.genres)).toEqual(["冒险", "奇幻", "Historical"]);
  });

  it("shows an explicit empty score state", () => {
    expect(formatRandomAnimeScore({ id: 1, title: {}, synonyms: [] })).toBe("暂无评分");
  });
});

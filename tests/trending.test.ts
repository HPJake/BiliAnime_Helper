import { describe, expect, it } from "vitest";
import type { Anime } from "../domain/anime";
import { formatAnimeStatus, getTrendingMetadata } from "../features/trending/trending";

describe("trending presentation", () => {
  it("formats Chinese status, season, episode count and next airing metadata", () => {
    const anime: Anime = {
      id: 1,
      title: { chinese: "测试动画" },
      synonyms: [],
      episodes: 12,
      season: "FALL",
      seasonYear: 2026,
      status: "RELEASING",
      nextAiringEpisode: { animeId: 1, episode: 3, airingAt: 1_800_000_000 }
    };

    expect(getTrendingMetadata(anime)).toMatchObject({
      summary: "2026 秋季 · 播出中 · 共 12 集",
      airing: expect.stringContaining("下一集：第 3 集")
    });
  });

  it("keeps unknown AniList statuses readable", () => {
    expect(formatAnimeStatus("UNKNOWN_STATUS")).toBe("UNKNOWN_STATUS");
  });
});

import { describe, expect, it } from "vitest";
import { mapAniListMedia } from "../services/anime/AniListProvider";

describe("mapAniListMedia", () => {
  it("maps an AniList response into the internal Anime model", () => {
    expect(
      mapAniListMedia({
        id: 154587,
        title: {
          romaji: "Sousou no Frieren",
          english: "Frieren: Beyond Journey's End",
          native: "葬送のフリーレン"
        },
        synonyms: ["Frieren at the Funeral", null],
        coverImage: { extraLarge: "https://example.com/frieren.jpg" },
        episodes: 28,
        status: "FINISHED",
        season: "FALL",
        seasonYear: 2023,
        popularity: 500000,
        trending: 100,
        isAdult: false,
        nextAiringEpisode: { episode: 29, airingAt: 2_000_000_000 }
      })
    ).toEqual({
      id: 154587,
      title: {
        romaji: "Sousou no Frieren",
        english: "Frieren: Beyond Journey's End",
        native: "葬送のフリーレン"
      },
      synonyms: ["Frieren at the Funeral"],
      coverImage: "https://example.com/frieren.jpg",
      episodes: 28,
      status: "FINISHED",
      season: "FALL",
      seasonYear: 2023,
      popularity: 500000,
      trending: 100,
      nextAiringEpisode: {
        animeId: 154587,
        episode: 29,
        airingAt: 2_000_000_000
      }
    });
  });

  it("filters adult and malformed media", () => {
    expect(mapAniListMedia({ id: 1, isAdult: true })).toBeNull();
    expect(mapAniListMedia({ id: null, isAdult: false })).toBeNull();
  });

  it("tolerates missing optional fields", () => {
    expect(mapAniListMedia({ id: 42, title: null, synonyms: null })).toEqual({
      id: 42,
      title: {},
      synonyms: []
    });
  });
});

import { describe, expect, it } from "vitest";
import type { Anime } from "../domain/anime";
import { createBilibiliSearchUrl, getBilibiliSearchTitle } from "../services/bilibili/searchUrl";

const anime: Anime = {
  id: 154587,
  title: { native: "葬送のフリーレン", romaji: "Sousou no Frieren", english: "Frieren: Beyond Journey's End" },
  synonyms: []
};

describe("Bilibili anime search", () => {
  it("uses alias, Chinese, native, romaji, then English title priority", () => {
    expect(getBilibiliSearchTitle(anime, "葬送的芙莉莲")).toBe("葬送的芙莉莲");
    expect(getBilibiliSearchTitle(anime)).toBe("葬送のフリーレン");
    expect(getBilibiliSearchTitle({ ...anime, title: { romaji: "Frieren" } })).toBe("Frieren");
    expect(getBilibiliSearchTitle({ ...anime, title: { english: "Frieren" } })).toBe("Frieren");
    expect(getBilibiliSearchTitle({ ...anime, title: { chinese: "葬送的芙莉莲", native: "葬送のフリーレン" } })).toBe("葬送的芙莉莲");
  });

  it("encodes the selected title in the Bilibili URL", () => {
    expect(createBilibiliSearchUrl(anime)).toBe(`https://search.bilibili.com/all?keyword=${encodeURIComponent("葬送のフリーレン")}`);
  });
});

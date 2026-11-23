import { describe, expect, it } from "vitest";
import {
  HEADER_PHRASE_CATEGORIES,
  HEADER_PHRASES
} from "../features/dashboard/headerPhrases";

describe("header phrase library", () => {
  it("contains unique phrases in every category", () => {
    const texts = HEADER_PHRASES.map((phrase) => phrase.text);
    expect(new Set(texts).size).toBe(texts.length);

    for (const category of HEADER_PHRASE_CATEGORIES) {
      expect(HEADER_PHRASES.filter((phrase) => phrase.category === category).length)
        .toBeGreaterThanOrEqual(4);
    }

    for (const phrase of HEADER_PHRASES) {
      expect(phrase.text.trim()).toBe(phrase.text);
      expect(phrase.text.length).toBeGreaterThan(0);
    }
  });

  it("wraps every classic line in corner brackets", () => {
    const classics = HEADER_PHRASES.filter((phrase) => phrase.category === "经典台词");
    expect(classics.length).toBeGreaterThanOrEqual(30);
    for (const phrase of classics) {
      expect(phrase.text).toMatch(/^「[^「」]+」$/u);
    }
  });
});

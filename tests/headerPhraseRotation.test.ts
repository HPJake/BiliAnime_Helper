import { describe, expect, it } from "vitest";
import { HEADER_PHRASES } from "../features/dashboard/headerPhrases";
import {
  createHeaderPhraseRotation,
  HEADER_GREETING_DURATION_MS,
  HEADER_PHRASE_INTERVAL_MS
} from "../features/dashboard/headerPhraseRotation";

describe("header phrase rotation", () => {
  it("starts with a 15-second greeting, then changes once per minute", () => {
    const rotation = createHeaderPhraseRotation(HEADER_PHRASES, () => 0);
    expect(rotation.first.category).toBe("问候");
    expect(HEADER_GREETING_DURATION_MS).toBe(15_000);
    expect(HEADER_PHRASE_INTERVAL_MS).toBe(60_000);
    expect(rotation.next()).not.toBe(rotation.first);
  });

  it("uses the full library before repeating and avoids an immediate repeat", () => {
    const rotation = createHeaderPhraseRotation(HEADER_PHRASES, () => 0.5);
    const seen = new Set([rotation.first.text]);
    let previous = rotation.first.text;

    for (let index = 1; index < HEADER_PHRASES.length; index += 1) {
      const phrase = rotation.next();
      expect(phrase.text).not.toBe(previous);
      expect(seen.has(phrase.text)).toBe(false);
      seen.add(phrase.text);
      previous = phrase.text;
    }

    expect(seen.size).toBe(HEADER_PHRASES.length);
    expect(rotation.next().text).not.toBe(previous);
  });

  it("requires at least one greeting", () => {
    expect(() => createHeaderPhraseRotation(
      HEADER_PHRASES.filter((phrase) => phrase.category !== "问候")
    )).toThrow("标题文库至少需要一条问候语");
  });
});

import { describe, expect, it } from "vitest";
import {
  AnimeApiError,
  normalizeApiError,
  parseRetryAfter
} from "../services/anime/errors";

describe("API error normalization", () => {
  it("preserves normalized errors", () => {
    const error = new AnimeApiError("graphql", "Bad query");
    expect(normalizeApiError(error)).toBe(error);
  });

  it("distinguishes offline and network failures", () => {
    expect(normalizeApiError(new TypeError("fetch failed"), { offline: true }).code).toBe(
      "offline"
    );
    expect(normalizeApiError(new TypeError("fetch failed")).code).toBe("network");
  });

  it("parses Retry-After seconds and HTTP dates", () => {
    expect(parseRetryAfter("30", 0)).toBe(30);
    expect(parseRetryAfter("Thu, 01 Jan 1970 00:01:00 GMT", 30_000)).toBe(30);
    expect(parseRetryAfter("invalid", 0)).toBeUndefined();
  });
});

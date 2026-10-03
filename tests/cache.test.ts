import { describe, expect, it } from "vitest";
import { CacheRepository, isCacheFresh } from "../utils/cache";
import { MemoryStorage } from "./helpers/memoryStorage";

describe("CacheRepository", () => {
  it("stores normalized values with an expiry", async () => {
    const storage = new MemoryStorage();
    const cache = new CacheRepository(storage, () => 1_000);

    await cache.set("anime:1", { id: 1 }, 500);

    expect(await cache.get("anime:1")).toEqual({
      value: { id: 1 },
      storedAt: 1_000,
      expiresAt: 1_500
    });
  });

  it("distinguishes fresh and expired cache entries", () => {
    const entry = { value: "cached", storedAt: 1_000, expiresAt: 2_000 };
    expect(isCacheFresh(entry, 1_999)).toBe(true);
    expect(isCacheFresh(entry, 2_000)).toBe(false);
  });

  it("clears only cache-prefixed storage", async () => {
    const storage = new MemoryStorage();
    await storage.set({ followedAnime: [{ aniListId: 1 }], "cache:a": 1, "cache:b": 2 });
    const cache = new CacheRepository(storage);

    await cache.clear();

    expect(Object.fromEntries(storage.values)).toEqual({ followedAnime: [{ aniListId: 1 }] });
  });
});

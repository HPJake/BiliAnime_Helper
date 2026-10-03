import { describe, expect, it } from "vitest";
import { AppRepository } from "../storage/repository";
import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "../storage/schema";
import { MemoryStorage } from "./helpers/memoryStorage";

describe("AppRepository", () => {
  it("initializes a versioned storage schema", async () => {
    const storage = new MemoryStorage();
    const repository = new AppRepository(storage);

    await repository.initialize();

    expect(storage.values.get(STORAGE_KEYS.schemaVersion)).toBe(STORAGE_SCHEMA_VERSION);
    expect(storage.values.get(STORAGE_KEYS.followedAnime)).toEqual([]);
  });

  it("saves and reloads followed anime", async () => {
    const storage = new MemoryStorage();
    const repository = new AppRepository(storage, () => 123456);

    await repository.followAnime(154587, "葬送的芙莉莲");
    const reloaded = new AppRepository(storage);

    expect(await reloaded.getFollowedAnime()).toEqual([
      {
        aniListId: 154587,
        addedAt: 123456,
        bilibiliSearchAlias: "葬送的芙莉莲"
      }
    ]);
  });

  it("prevents duplicate follows", async () => {
    const storage = new MemoryStorage();
    const repository = new AppRepository(storage, () => 100);

    await repository.followAnime(1);
    await repository.followAnime(1);

    expect(await repository.getFollowedAnime()).toHaveLength(1);
  });

  it("ignores corrupted followed entries", async () => {
    const storage = new MemoryStorage();
    await storage.set({
      [STORAGE_KEYS.schemaVersion]: STORAGE_SCHEMA_VERSION,
      [STORAGE_KEYS.followedAnime]: [null, { aniListId: "bad" }, { aniListId: 2, addedAt: 10 }]
    });
    const repository = new AppRepository(storage);

    expect(await repository.getFollowedAnime()).toEqual([{ aniListId: 2, addedAt: 10 }]);
  });

  it("migrates notification storage and persists scheduled events", async () => {
    const storage = new MemoryStorage();
    await storage.set({
      [STORAGE_KEYS.schemaVersion]: 1,
      [STORAGE_KEYS.notificationState]: {
        notifiedEventIds: ["1:1:100", 123],
        unseenEventIds: ["1:1:100"]
      }
    });
    const repository = new AppRepository(storage);

    await repository.initialize();
    await repository.saveScheduledAiringEvents([{
      animeId: 1,
      followedAnimeId: 1,
      episode: 1,
      airingAt: 100,
      title: "Anime",
      searchTitle: "动画"
    }]);

    expect(await repository.getNotificationState()).toEqual({
      notifiedEventIds: ["1:1:100"],
      unseenEventIds: ["1:1:100"]
    });
    expect(await repository.getScheduledAiringEvents()).toHaveLength(1);
    expect(storage.values.get(STORAGE_KEYS.schemaVersion)).toBe(STORAGE_SCHEMA_VERSION);
  });
});

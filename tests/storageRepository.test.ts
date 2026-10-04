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
    expect(await repository.getSettings()).toMatchObject({ themePreference: "auto" });
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

  it("serializes concurrent follow writes without losing an anime", async () => {
    const repository = new AppRepository(new MemoryStorage(), () => 100);

    await Promise.all([repository.followAnime(1), repository.followAnime(2)]);

    expect((await repository.getFollowedAnime()).map((item) => item.aniListId)).toEqual([1, 2]);
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

  it("repairs corrupted arrays during migration", async () => {
    const storage = new MemoryStorage();
    await storage.set({
      [STORAGE_KEYS.schemaVersion]: 1,
      [STORAGE_KEYS.followedAnime]: [
        null,
        { aniListId: "bad", addedAt: 1 },
        { aniListId: 7, addedAt: 10 }
      ],
      [STORAGE_KEYS.scheduledAiringEvents]: [
        { animeId: 7, followedAnimeId: 7, episode: 1, airingAt: 100, title: "A", searchTitle: "A" },
        { animeId: 0, episode: "bad" }
      ]
    });
    const repository = new AppRepository(storage);

    await repository.initialize();

    expect(storage.values.get(STORAGE_KEYS.followedAnime)).toEqual([{ aniListId: 7, addedAt: 10 }]);
    expect(await repository.getScheduledAiringEvents()).toEqual([
      { animeId: 7, followedAnimeId: 7, episode: 1, airingAt: 100, title: "A", searchTitle: "A" }
    ]);
  });

  it("migrates legacy settings to follow the Bilibili theme", async () => {
    const storage = new MemoryStorage();
    await storage.set({
      [STORAGE_KEYS.schemaVersion]: 2,
      [STORAGE_KEYS.settings]: {
        notificationsEnabled: false,
        badgeEnabled: true,
        timezoneMode: "local"
      }
    });

    const settings = await new AppRepository(storage).getSettings();

    expect(settings).toEqual({
      notificationsEnabled: false,
      badgeEnabled: true,
      themePreference: "auto",
      timezoneMode: "local"
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "../services/settings/SettingsService";
import { AppRepository } from "../storage/repository";
import { CacheRepository } from "../utils/cache";
import { MemoryStorage } from "./helpers/memoryStorage";

describe("SettingsService", () => {
  it("persists notification settings and asks the background to sync", async () => {
    const storage = new MemoryStorage();
    const repository = new AppRepository(storage);
    const sendMessage = vi.fn(async () => undefined);
    const service = new SettingsService(repository, new CacheRepository(storage), sendMessage);

    const settings = await service.updateSettings({ badgeEnabled: false });

    expect(settings.badgeEnabled).toBe(false);
    expect((await repository.getSettings()).badgeEnabled).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith({ type: "settings-updated" });
  });

  it("keeps saved settings when the background is temporarily unavailable", async () => {
    const storage = new MemoryStorage();
    const repository = new AppRepository(storage);
    const service = new SettingsService(
      repository,
      new CacheRepository(storage),
      async () => { throw new Error("background asleep"); }
    );

    await expect(service.updateSettings({ notificationsEnabled: false })).resolves.toMatchObject({
      notificationsEnabled: false
    });
    expect((await repository.getSettings()).notificationsEnabled).toBe(false);
  });

  it("persists a user-selected appearance", async () => {
    const storage = new MemoryStorage();
    const repository = new AppRepository(storage);
    const service = new SettingsService(
      repository,
      new CacheRepository(storage),
      async () => undefined
    );

    await expect(service.updateSettings({ themePreference: "dark" })).resolves.toMatchObject({
      themePreference: "dark"
    });
    expect((await repository.getSettings()).themePreference).toBe("dark");
  });

  it("clears cache before requesting an immediate background refresh", async () => {
    const storage = new MemoryStorage();
    const repository = new AppRepository(storage);
    const cache = new CacheRepository(storage);
    const sendMessage = vi.fn(async () => undefined);
    const service = new SettingsService(repository, cache, sendMessage);
    await repository.followAnime(1);
    await cache.set("trending:20", [{ id: 1 }], 1000);

    await service.refreshNow();

    expect(await cache.get("trending:20")).toBeNull();
    expect(await repository.getFollowedAnime()).toHaveLength(1);
    expect(sendMessage).toHaveBeenCalledWith({ type: "refresh-data-now" });
  });
});

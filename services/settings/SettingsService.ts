import type { AppSettings } from "../../domain/settings";
import type { AppRepository } from "../../storage/repository";
import type { CacheRepository } from "../../utils/cache";

export type BackgroundMessage = {
  type: "refresh-data-now" | "settings-updated";
};

export type RuntimeMessenger = (message: BackgroundMessage) => Promise<void>;

export class SettingsService {
  constructor(
    private readonly repository: AppRepository,
    private readonly cache: CacheRepository,
    private readonly sendMessage: RuntimeMessenger
  ) {}

  getSettings(): Promise<AppSettings> {
    return this.repository.getSettings();
  }

  async updateSettings(
    patch: Partial<Pick<AppSettings, "notificationsEnabled" | "badgeEnabled" | "themePreference">>
  ): Promise<AppSettings> {
    const current = await this.repository.getSettings();
    const next: AppSettings = { ...current, ...patch, timezoneMode: "local" };
    await this.repository.saveSettings(next);
    await this.sendMessage({ type: "settings-updated" }).catch(() => undefined);
    return next;
  }

  async refreshNow(): Promise<void> {
    await this.cache.clear();
    await this.sendMessage({ type: "refresh-data-now" });
  }

  clearCache(): Promise<void> {
    return this.cache.clear();
  }
}

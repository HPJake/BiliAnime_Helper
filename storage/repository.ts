import type { FollowedAnime } from "../domain/anime";
import {
  DEFAULT_NOTIFICATION_STATE,
  DEFAULT_SETTINGS,
  type AppSettings,
  type NotificationState,
  type ScheduledAiringEvent
} from "../domain/settings";
import { runStorageMigrations } from "./migrations";
import { STORAGE_KEYS } from "./schema";

export type StorageKeys = string | string[] | null;

export interface StorageArea {
  get(keys?: StorageKeys): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export class AppRepository {
  private initialization: Promise<void> | null = null;

  constructor(
    private readonly storage: StorageArea,
    private readonly now: () => number = Date.now
  ) {}

  initialize(): Promise<void> {
    this.initialization ??= runStorageMigrations(this.storage);
    return this.initialization;
  }

  async getFollowedAnime(): Promise<FollowedAnime[]> {
    await this.initialize();
    const stored = await this.storage.get(STORAGE_KEYS.followedAnime);
    const value = stored[STORAGE_KEYS.followedAnime];
    if (!Array.isArray(value)) return [];
    return value.filter(isFollowedAnime).map((item) => ({ ...item }));
  }

  async saveFollowedAnime(followedAnime: FollowedAnime): Promise<void> {
    if (!isFollowedAnime(followedAnime)) throw new TypeError("Invalid followed anime");
    const current = await this.getFollowedAnime();
    const next = current.filter((item) => item.aniListId !== followedAnime.aniListId);
    next.push({ ...followedAnime });
    await this.storage.set({ [STORAGE_KEYS.followedAnime]: next });
  }

  async followAnime(aniListId: number, bilibiliSearchAlias?: string): Promise<FollowedAnime> {
    if (!Number.isInteger(aniListId) || aniListId <= 0) throw new TypeError("Invalid AniList ID");
    const current = await this.getFollowedAnime();
    const existing = current.find((item) => item.aniListId === aniListId);
    if (existing) return existing;

    const followed: FollowedAnime = {
      aniListId,
      addedAt: this.now(),
      ...(bilibiliSearchAlias ? { bilibiliSearchAlias } : {})
    };
    await this.storage.set({ [STORAGE_KEYS.followedAnime]: [...current, followed] });
    return followed;
  }

  async unfollowAnime(aniListId: number): Promise<void> {
    const current = await this.getFollowedAnime();
    await this.storage.set({
      [STORAGE_KEYS.followedAnime]: current.filter((item) => item.aniListId !== aniListId)
    });
  }

  async getSettings(): Promise<AppSettings> {
    await this.initialize();
    const stored = await this.storage.get(STORAGE_KEYS.settings);
    const value = stored[STORAGE_KEYS.settings];
    if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
    return {
      notificationsEnabled:
        typeof value.notificationsEnabled === "boolean"
          ? value.notificationsEnabled
          : DEFAULT_SETTINGS.notificationsEnabled,
      badgeEnabled:
        typeof value.badgeEnabled === "boolean" ? value.badgeEnabled : DEFAULT_SETTINGS.badgeEnabled,
      timezoneMode: "local"
    };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    if (!isAppSettings(settings)) throw new TypeError("Invalid app settings");
    await this.initialize();
    await this.storage.set({ [STORAGE_KEYS.settings]: { ...settings } });
  }

  async getNotificationState(): Promise<NotificationState> {
    await this.initialize();
    const stored = await this.storage.get(STORAGE_KEYS.notificationState);
    const value = stored[STORAGE_KEYS.notificationState];
    if (!isRecord(value)) return cloneNotificationState(DEFAULT_NOTIFICATION_STATE);
    return {
      notifiedEventIds: stringArray(value.notifiedEventIds),
      unseenEventIds: stringArray(value.unseenEventIds)
    };
  }

  async saveNotificationState(state: NotificationState): Promise<void> {
    if (!isNotificationState(state)) throw new TypeError("Invalid notification state");
    await this.initialize();
    await this.storage.set({
      [STORAGE_KEYS.notificationState]: cloneNotificationState(state)
    });
  }

  async getScheduledAiringEvents(): Promise<ScheduledAiringEvent[]> {
    await this.initialize();
    const stored = await this.storage.get(STORAGE_KEYS.scheduledAiringEvents);
    const value = stored[STORAGE_KEYS.scheduledAiringEvents];
    return Array.isArray(value)
      ? value.filter(isScheduledAiringEvent).map((event) => ({ ...event }))
      : [];
  }

  async saveScheduledAiringEvents(events: ScheduledAiringEvent[]): Promise<void> {
    if (!events.every(isScheduledAiringEvent)) throw new TypeError("Invalid scheduled airing events");
    await this.initialize();
    await this.storage.set({
      [STORAGE_KEYS.scheduledAiringEvents]: events.map((event) => ({ ...event }))
    });
  }
}

function isFollowedAnime(value: unknown): value is FollowedAnime {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<FollowedAnime>;
  return (
    Number.isInteger(candidate.aniListId) &&
    Number(candidate.aniListId) > 0 &&
    typeof candidate.addedAt === "number" &&
    Number.isFinite(candidate.addedAt) &&
    (candidate.bilibiliSearchAlias === undefined ||
      typeof candidate.bilibiliSearchAlias === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAppSettings(value: unknown): value is AppSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.notificationsEnabled === "boolean" &&
    typeof value.badgeEnabled === "boolean" &&
    value.timezoneMode === "local"
  );
}

function isNotificationState(value: unknown): value is NotificationState {
  if (!isRecord(value)) return false;
  return Array.isArray(value.notifiedEventIds) &&
    value.notifiedEventIds.every((item) => typeof item === "string") &&
    Array.isArray(value.unseenEventIds) &&
    value.unseenEventIds.every((item) => typeof item === "string");
}

function isScheduledAiringEvent(value: unknown): value is ScheduledAiringEvent {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.animeId) &&
    Number(value.animeId) > 0 &&
    Number.isInteger(value.followedAnimeId) &&
    Number(value.followedAnimeId) > 0 &&
    Number.isInteger(value.episode) &&
    Number(value.episode) > 0 &&
    Number.isInteger(value.airingAt) &&
    Number(value.airingAt) > 0 &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.searchTitle === "string" &&
    value.searchTitle.length > 0
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function cloneNotificationState(state: NotificationState): NotificationState {
  return {
    notifiedEventIds: [...state.notifiedEventIds],
    unseenEventIds: [...state.unseenEventIds]
  };
}

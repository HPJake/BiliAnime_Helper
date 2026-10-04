import { DEFAULT_STORAGE, STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "./schema";
import type { FollowedAnime } from "../domain/anime";
import type { ScheduledAiringEvent } from "../domain/settings";
import type { StorageArea } from "./repository";

export async function runStorageMigrations(storage: StorageArea): Promise<void> {
  const current = await storage.get([
    STORAGE_KEYS.schemaVersion,
    STORAGE_KEYS.followedAnime,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.notificationState,
    STORAGE_KEYS.scheduledAiringEvents
  ]);
  const version = current[STORAGE_KEYS.schemaVersion];

  if (typeof version === "number" && version > STORAGE_SCHEMA_VERSION) return;

  const updates: Record<string, unknown> = {
    [STORAGE_KEYS.schemaVersion]: STORAGE_SCHEMA_VERSION
  };
  updates[STORAGE_KEYS.followedAnime] = migrateFollowedAnime(
    current[STORAGE_KEYS.followedAnime]
  );
  updates[STORAGE_KEYS.settings] = migrateSettings(current[STORAGE_KEYS.settings]);
  updates[STORAGE_KEYS.notificationState] = migrateNotificationState(
    current[STORAGE_KEYS.notificationState]
  );
  updates[STORAGE_KEYS.scheduledAiringEvents] = migrateScheduledEvents(
    current[STORAGE_KEYS.scheduledAiringEvents]
  );

  await storage.set(updates);
}

function migrateFollowedAnime(value: unknown): FollowedAnime[] {
  if (!Array.isArray(value)) return DEFAULT_STORAGE.followedAnime;
  return value.filter((item): item is FollowedAnime => {
    if (!isRecord(item)) return false;
    return Number.isInteger(item.aniListId) && Number(item.aniListId) > 0 &&
      typeof item.addedAt === "number" && Number.isFinite(item.addedAt) &&
      (item.bilibiliSearchAlias === undefined || typeof item.bilibiliSearchAlias === "string");
  });
}

function migrateScheduledEvents(value: unknown): ScheduledAiringEvent[] {
  if (!Array.isArray(value)) return DEFAULT_STORAGE.scheduledAiringEvents;
  return value.filter((item): item is ScheduledAiringEvent => {
    if (!isRecord(item)) return false;
    return Number.isInteger(item.animeId) && Number(item.animeId) > 0 &&
      Number.isInteger(item.followedAnimeId) && Number(item.followedAnimeId) > 0 &&
      Number.isInteger(item.episode) && Number(item.episode) > 0 &&
      Number.isInteger(item.airingAt) && Number(item.airingAt) > 0 &&
      typeof item.title === "string" && item.title.length > 0 &&
      typeof item.searchTitle === "string" && item.searchTitle.length > 0;
  });
}

function migrateSettings(value: unknown) {
  const stored = isRecord(value) ? value : {};
  return {
    notificationsEnabled:
      typeof stored.notificationsEnabled === "boolean"
        ? stored.notificationsEnabled
        : DEFAULT_STORAGE.settings.notificationsEnabled,
    badgeEnabled:
      typeof stored.badgeEnabled === "boolean"
        ? stored.badgeEnabled
        : DEFAULT_STORAGE.settings.badgeEnabled,
    themePreference: isThemePreference(stored.themePreference)
      ? stored.themePreference
      : DEFAULT_STORAGE.settings.themePreference,
    timezoneMode: "local" as const
  };
}

function isThemePreference(value: unknown): value is "auto" | "light" | "dark" {
  return value === "auto" || value === "light" || value === "dark";
}

function migrateNotificationState(value: unknown) {
  const stored = isRecord(value) ? value : {};
  return {
    notifiedEventIds: stringArray(stored.notifiedEventIds),
    unseenEventIds: stringArray(stored.unseenEventIds)
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { DEFAULT_STORAGE, STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "./schema";
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
  if (!Array.isArray(current[STORAGE_KEYS.followedAnime])) {
    updates[STORAGE_KEYS.followedAnime] = DEFAULT_STORAGE.followedAnime;
  }
  updates[STORAGE_KEYS.settings] = migrateSettings(current[STORAGE_KEYS.settings]);
  updates[STORAGE_KEYS.notificationState] = migrateNotificationState(
    current[STORAGE_KEYS.notificationState]
  );
  if (!Array.isArray(current[STORAGE_KEYS.scheduledAiringEvents])) {
    updates[STORAGE_KEYS.scheduledAiringEvents] = DEFAULT_STORAGE.scheduledAiringEvents;
  }

  await storage.set(updates);
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
    timezoneMode: "local" as const
  };
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

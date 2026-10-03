import { DEFAULT_STORAGE, STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "./schema";
import type { StorageArea } from "./repository";

export async function runStorageMigrations(storage: StorageArea): Promise<void> {
  const current = await storage.get([
    STORAGE_KEYS.schemaVersion,
    STORAGE_KEYS.followedAnime,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.notificationState
  ]);
  const version = current[STORAGE_KEYS.schemaVersion];

  if (typeof version === "number" && version > STORAGE_SCHEMA_VERSION) return;

  const updates: Record<string, unknown> = {
    [STORAGE_KEYS.schemaVersion]: STORAGE_SCHEMA_VERSION
  };
  if (!Array.isArray(current[STORAGE_KEYS.followedAnime])) {
    updates[STORAGE_KEYS.followedAnime] = DEFAULT_STORAGE.followedAnime;
  }
  if (!isRecord(current[STORAGE_KEYS.settings])) {
    updates[STORAGE_KEYS.settings] = DEFAULT_STORAGE.settings;
  }
  if (!isRecord(current[STORAGE_KEYS.notificationState])) {
    updates[STORAGE_KEYS.notificationState] = DEFAULT_STORAGE.notificationState;
  }

  await storage.set(updates);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

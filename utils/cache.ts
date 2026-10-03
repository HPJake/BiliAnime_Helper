import type { StorageArea } from "../storage/repository";

export type CacheEntry<T> = {
  value: T;
  storedAt: number;
  expiresAt: number;
};

const CACHE_PREFIX = "cache:";

export function isCacheEntry(value: unknown): value is CacheEntry<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CacheEntry<unknown>>;
  return (
    Object.prototype.hasOwnProperty.call(candidate, "value") &&
    typeof candidate.storedAt === "number" &&
    Number.isFinite(candidate.storedAt) &&
    typeof candidate.expiresAt === "number" &&
    Number.isFinite(candidate.expiresAt)
  );
}

export function isCacheFresh(entry: CacheEntry<unknown>, now = Date.now()): boolean {
  return entry.expiresAt > now;
}

export class CacheRepository {
  constructor(
    private readonly storage: StorageArea,
    private readonly now: () => number = Date.now
  ) {}

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const storageKey = `${CACHE_PREFIX}${key}`;
    const stored = await this.storage.get(storageKey);
    const entry = stored[storageKey];
    return isCacheEntry(entry) ? (entry as CacheEntry<T>) : null;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<CacheEntry<T>> {
    const storedAt = this.now();
    const entry: CacheEntry<T> = {
      value,
      storedAt,
      expiresAt: storedAt + Math.max(0, ttlMs)
    };
    await this.storage.set({ [`${CACHE_PREFIX}${key}`]: entry });
    return entry;
  }

  async remove(key: string): Promise<void> {
    await this.storage.remove(`${CACHE_PREFIX}${key}`);
  }

  async clear(): Promise<void> {
    const all = await this.storage.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith(CACHE_PREFIX));
    if (keys.length > 0) await this.storage.remove(keys);
  }
}

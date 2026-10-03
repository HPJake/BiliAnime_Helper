import type { FollowedAnime } from "../domain/anime";
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

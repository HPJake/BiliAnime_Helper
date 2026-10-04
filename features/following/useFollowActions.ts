import { useEffect, useRef, useState } from "react";
import type { Anime } from "../../domain/anime";
import type { AppRepository } from "../../storage/repository";

export type FollowActions = {
  busyIds: ReadonlySet<number>;
  error: string | null;
  followedIds: ReadonlySet<number>;
  ready: boolean;
  toggleFollow: (anime: Anime) => Promise<void>;
};

export function useFollowActions(repository: AppRepository): FollowActions {
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyIdsRef = useRef(new Set<number>());

  useEffect(() => {
    let cancelled = false;
    repository.getFollowedAnime()
      .then((records) => {
        if (!cancelled) setFollowedIds(new Set(records.map((record) => record.aniListId)));
      })
      .catch(() => {
        if (!cancelled) setError("无法读取本地追番列表，请重新打开插件后再试。");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  async function toggleFollow(anime: Anime): Promise<void> {
    if (!ready || busyIdsRef.current.has(anime.id)) return;
    const wasFollowed = followedIds.has(anime.id);
    busyIdsRef.current.add(anime.id);
    setBusyIds(new Set(busyIdsRef.current));
    setError(null);
    try {
      if (wasFollowed) {
        await repository.unfollowAnime(anime.id);
      } else {
        await repository.followAnime(anime.id);
      }
      setFollowedIds((current) => {
        const next = new Set(current);
        if (wasFollowed) next.delete(anime.id);
        else next.add(anime.id);
        return next;
      });
    } catch {
      setError(wasFollowed
        ? "取消追番失败，本地记录没有改变。"
        : "保存追番失败，请稍后重试。");
    } finally {
      busyIdsRef.current.delete(anime.id);
      setBusyIds(new Set(busyIdsRef.current));
    }
  }

  return { busyIds, error, followedIds, ready, toggleFollow };
}

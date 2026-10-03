import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { StateMessage } from "../../components/StateMessage";
import { getAnimeDisplayTitle, type Anime, type FollowedAnime } from "../../domain/anime";
import type { AnimeService } from "../../services/anime/AnimeService";
import { AnimeApiError } from "../../services/anime/errors";
import { openBilibiliSearch } from "../../services/bilibili/openBilibiliSearch";
import type { AppRepository } from "../../storage/repository";

type MyAnimeViewProps = {
  animeService: AnimeService;
  repository: AppRepository;
};

export function MyAnimeView({ animeService, repository }: MyAnimeViewProps) {
  const [followed, setFollowed] = useState<FollowedAnime[]>([]);
  const [animeById, setAnimeById] = useState<Map<number, Anime>>(new Map());
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listWarning, setListWarning] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStale, setSearchStale] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const searchSequence = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowedAnime() {
      setListLoading(true);
      setListError(null);
      try {
        const records = await repository.getFollowedAnime();
        if (cancelled) return;
        setFollowed(records);

        const loaded = await Promise.allSettled(
          records.map(async (record) => ({
            id: record.aniListId,
            result: await animeService.getAnime(record.aniListId)
          }))
        );
        if (cancelled) return;

        const nextMap = new Map<number, Anime>();
        let unavailable = 0;
        let stale = 0;
        for (const item of loaded) {
          if (item.status === "fulfilled" && item.value.result.data) {
            nextMap.set(item.value.id, item.value.result.data);
            if (item.value.result.stale) stale += 1;
          } else {
            unavailable += 1;
          }
        }
        setAnimeById(nextMap);
        if (unavailable > 0) {
          setListWarning("部分番剧信息未能刷新，本地追番记录仍然可用。");
        } else if (stale > 0) {
          setListWarning("当前网络不可用或刷新失败，正在显示缓存数据。");
        } else {
          setListWarning(null);
        }
      } catch (error) {
        if (!cancelled) setListError(toUserMessage(error));
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }

    void loadFollowedAnime();
    return () => {
      cancelled = true;
    };
  }, [animeService, repository]);

  const followedIds = useMemo(
    () => new Set(followed.map((record) => record.aniListId)),
    [followed]
  );

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    const sequence = ++searchSequence.current;
    setSearchLoading(true);
    setSearchError(null);
    setSearchStale(false);
    setHasSearched(true);
    try {
      const result = await animeService.searchAnime(trimmed);
      if (sequence !== searchSequence.current) return;
      setSearchResults(result.data);
      setSearchStale(result.stale);
    } catch (error) {
      if (sequence !== searchSequence.current) return;
      setSearchResults([]);
      setSearchError(toUserMessage(error));
    } finally {
      if (sequence === searchSequence.current) setSearchLoading(false);
    }
  }

  async function toggleFollow(anime: Anime) {
    if (busyIds.has(anime.id)) return;
    setBusyIds((current) => new Set(current).add(anime.id));
    setListError(null);
    try {
      if (followedIds.has(anime.id)) {
        await repository.unfollowAnime(anime.id);
        setFollowed((current) => current.filter((record) => record.aniListId !== anime.id));
        setAnimeById((current) => {
          const next = new Map(current);
          next.delete(anime.id);
          return next;
        });
      } else {
        const record = await repository.followAnime(anime.id);
        setFollowed((current) =>
          current.some((item) => item.aniListId === anime.id) ? current : [...current, record]
        );
        setAnimeById((current) => new Map(current).set(anime.id, anime));
      }
    } catch (error) {
      setListError(toUserMessage(error));
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(anime.id);
        return next;
      });
    }
  }

  async function removeFollow(record: FollowedAnime) {
    if (busyIds.has(record.aniListId)) return;
    setBusyIds((current) => new Set(current).add(record.aniListId));
    setListError(null);
    try {
      await repository.unfollowAnime(record.aniListId);
      setFollowed((current) =>
        current.filter((item) => item.aniListId !== record.aniListId)
      );
      setAnimeById((current) => {
        const next = new Map(current);
        next.delete(record.aniListId);
        return next;
      });
    } catch (error) {
      setListError(toUserMessage(error));
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(record.aniListId);
        return next;
      });
    }
  }

  return (
    <section className="my-anime" aria-labelledby="my-anime-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">追番列表</p>
          <h2 id="my-anime-title">我的追番</h2>
        </div>
        <button
          className="primary-button"
          type="button"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((open) => !open)}
        >
          {searchOpen ? "收起" : "+ 添加番剧"}
        </button>
      </div>

      {searchOpen ? (
        <section className="search-panel" aria-label="搜索番剧">
          <form className="search-form" onSubmit={handleSearch}>
            <label className="sr-only" htmlFor="anime-search">按标题搜索番剧</label>
            <input
              id="anime-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入中文、日文或英文标题…"
              autoFocus
            />
            <button type="submit" disabled={!query.trim() || searchLoading}>
              {searchLoading ? "搜索中…" : "搜索"}
            </button>
          </form>

          {searchError ? <StateMessage title="暂时无法搜索" detail={searchError} tone="error" /> : null}
          {searchStale ? <StateMessage title="正在显示缓存结果" detail="在线数据未能刷新。" tone="warning" /> : null}
          {!searchLoading && hasSearched && !searchError && searchResults.length === 0 ? (
            <StateMessage title="没有找到番剧" detail="请尝试其他中文译名、日文名或英文名。" />
          ) : null}
          {searchResults.length > 0 ? (
            <div className="anime-list search-results" aria-label="番剧搜索结果">
              {searchResults.map((anime) => (
                <AnimeRow
                  key={anime.id}
                  anime={anime}
                  actionLabel={followedIds.has(anime.id) ? "取消追番" : "追番"}
                  actionBusy={busyIds.has(anime.id)}
                  onAction={() => void toggleFollow(anime)}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {listError ? <StateMessage title="无法更新追番列表" detail={listError} tone="error" /> : null}
      {listWarning ? <StateMessage title="正在使用本地数据" detail={listWarning} tone="warning" /> : null}
      {listLoading ? <LoadingRows /> : null}
      {!listLoading && followed.length === 0 ? (
        <StateMessage title="还没有追番" detail="点击“添加番剧”建立你的本地追番列表。" />
      ) : null}
      {!listLoading && followed.length > 0 ? (
        <div className="anime-list" aria-label="已追番剧">
          {followed.map((record) => {
            const anime = animeById.get(record.aniListId);
            return anime ? (
              <AnimeRow
                key={record.aniListId}
                anime={anime}
                searchAlias={record.bilibiliSearchAlias}
                actionLabel="移除"
                actionBusy={busyIds.has(record.aniListId)}
                onAction={() => void removeFollow(record)}
              />
            ) : (
              <div className="anime-row anime-row--unavailable" key={record.aniListId}>
                <div className="cover-placeholder" aria-hidden="true">?</div>
                <div className="anime-copy">
                  <strong>AniList #{record.aniListId}</strong>
                  <span>番剧信息暂不可用</span>
                </div>
                <button className="text-button text-button--danger" type="button" disabled={busyIds.has(record.aniListId)} onClick={() => void removeFollow(record)}>
                  移除
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

type AnimeRowProps = {
  anime: Anime;
  searchAlias?: string;
  actionLabel: string;
  actionBusy: boolean;
  onAction: () => void;
};

function AnimeRow({ anime, searchAlias, actionLabel, actionBusy, onAction }: AnimeRowProps) {
  const title = getAnimeDisplayTitle(anime);
  const metadata = [anime.seasonYear, anime.status ? formatStatus(anime.status) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="anime-row">
      {anime.coverImage ? <img className="anime-cover" src={anime.coverImage} alt="" loading="lazy" /> : <div className="cover-placeholder" aria-hidden="true">B</div>}
      <div className="anime-copy">
        <button type="button" className="anime-title" title={`在哔哩哔哩搜索 ${title}`} onClick={() => void openBilibiliSearch(anime, searchAlias)}>
          {title}
        </button>
        <span>{metadata || "动画"}</span>
      </div>
      <button type="button" className={`text-button ${actionLabel === "追番" ? "text-button--follow" : "text-button--danger"}`} disabled={actionBusy} onClick={onAction}>
        {actionBusy ? "保存中…" : actionLabel}
      </button>
    </article>
  );
}

function LoadingRows() {
  return (
    <div className="loading-rows" role="status" aria-label="正在加载追番列表">
      {[0, 1, 2].map((item) => (
        <div className="loading-row" key={item}>
          <span className="loading-cover" />
          <span className="loading-lines" />
        </div>
      ))}
    </div>
  );
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    FINISHED: "已完结",
    RELEASING: "播出中",
    NOT_YET_RELEASED: "未播出",
    CANCELLED: "已取消",
    HIATUS: "暂停播出"
  };
  return labels[status] ?? status;
}

function toUserMessage(error: unknown): string {
  if (error instanceof AnimeApiError) {
    switch (error.code) {
      case "offline": return "当前似乎处于离线状态。";
      case "network": return "无法连接动画数据服务，请稍后重试。";
      case "rate_limited":
        return error.options.retryAfterSeconds
          ? `请求过于频繁，请在约 ${error.options.retryAfterSeconds} 秒后重试。`
          : "请求过于频繁，请稍后重试。";
      default: return "动画数据服务暂时不可用，请稍后重试。";
    }
  }
  return error instanceof Error ? error.message : "发生了未知错误。";
}

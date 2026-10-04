import { useEffect, useState } from "react";
import { StateMessage } from "../../components/StateMessage";
import { getChineseAnimeDisplayTitle, type Anime } from "../../domain/anime";
import type { AnimeService } from "../../services/anime/AnimeService";
import { AnimeApiError } from "../../services/anime/errors";
import { openBilibiliSearch } from "../../services/bilibili/openBilibiliSearch";
import type { AppRepository } from "../../storage/repository";
import { FollowAnimeButton } from "../following/FollowAnimeButton";
import { useFollowActions, type FollowActions } from "../following/useFollowActions";
import { getTrendingMetadata } from "./trending";

const TRENDING_LIMIT = 20;

type TrendingData = {
  anime: Anime[];
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  warning: string | null;
};

type TrendingProps = {
  animeService: AnimeService;
  repository: AppRepository;
};

export function TrendingView({ animeService, repository }: TrendingProps) {
  const data = useTrendingData(animeService);
  const followActions = useFollowActions(repository);

  return (
    <section className="trending-view" aria-labelledby="trending-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ANILIST GLOBAL</p>
          <h2 id="trending-title">全球趋势 Top 20</h2>
        </div>
        {data.refreshing && !data.loading ? <span className="refresh-indicator">正在刷新…</span> : null}
      </div>
      <p className="schedule-note">AniList 站内动画趋势，不代表所有动画平台的客观排名。</p>
      <TrendingState data={data} />
      {followActions.error ? <StateMessage title="无法更新追番状态" detail={followActions.error} tone="warning" /> : null}
      {!data.loading && data.anime.length > 0 ? (
        <TrendingList anime={data.anime} followActions={followActions} />
      ) : null}
      <p className="trending-source">趋势数据：AniList · 中文标题：Bangumi</p>
    </section>
  );
}

type TrendingPreviewProps = TrendingProps & {
  onOpenTrending: () => void;
};

export function TrendingPreview({ animeService, onOpenTrending, repository }: TrendingPreviewProps) {
  const data = useTrendingData(animeService);
  const followActions = useFollowActions(repository);

  return (
    <section className="trending-preview" aria-labelledby="trending-preview-title">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">ANILIST GLOBAL</p>
          <h2 id="trending-preview-title">热门趋势 Top 3</h2>
        </div>
        <button type="button" className="text-link-button" onClick={onOpenTrending}>查看 Top 20</button>
      </div>
      <TrendingState data={data} compact />
      {followActions.error ? <StateMessage title="无法更新追番状态" detail={followActions.error} tone="warning" /> : null}
      {!data.loading && data.anime.length > 0 ? (
        <TrendingList anime={data.anime.slice(0, 3)} compact followActions={followActions} />
      ) : null}
      <p className="trending-source">趋势数据：AniList · 中文标题：Bangumi</p>
    </section>
  );
}

function TrendingState({ data, compact = false }: { data: TrendingData; compact?: boolean }) {
  if (data.loading) return <TrendingLoading count={compact ? 3 : 5} />;
  if (data.error) return <StateMessage title="暂时无法加载趋势榜" detail={data.error} tone="error" />;
  return (
    <>
      {data.warning ? <StateMessage title="无法刷新趋势榜" detail={data.warning} tone="warning" /> : null}
      {data.anime.length === 0 ? <StateMessage title="暂无趋势数据" detail="AniList 暂时没有返回动画趋势结果。" /> : null}
    </>
  );
}

function TrendingList({
  anime,
  compact = false,
  followActions
}: {
  anime: Anime[];
  compact?: boolean;
  followActions: FollowActions;
}) {
  return (
    <ol className={`trending-list${compact ? " trending-list--compact" : ""}`}>
      {anime.map((item, index) => (
        <TrendingRow
          anime={item}
          compact={compact}
          followActions={followActions}
          key={item.id}
          rank={index + 1}
        />
      ))}
    </ol>
  );
}

function TrendingRow({
  anime,
  compact,
  followActions,
  rank
}: {
  anime: Anime;
  compact: boolean;
  followActions: FollowActions;
  rank: number;
}) {
  const title = getChineseAnimeDisplayTitle(anime);
  const metadata = getTrendingMetadata(anime);
  return (
    <li className="trending-row">
      <span className={`trending-rank${rank <= 3 ? ` trending-rank--${rank}` : ""}`} aria-label={`第 ${rank} 名`}>{rank}</span>
      {anime.coverImage ? (
        <img className="trending-cover" src={anime.coverImage} alt="" loading="lazy" />
      ) : (
        <div className="trending-cover trending-cover--placeholder" aria-hidden="true">B</div>
      )}
      <div className="trending-copy">
        <button type="button" title={`在哔哩哔哩搜索 ${title}`} onClick={() => void openBilibiliSearch(anime)}>
          {title}
        </button>
        <span>{metadata.summary}</span>
        {!compact && metadata.airing ? <small>{metadata.airing}</small> : null}
      </div>
      <FollowAnimeButton actions={followActions} anime={anime} />
    </li>
  );
}

function TrendingLoading({ count }: { count: number }) {
  return (
    <div className="trending-loading" role="status" aria-label="正在加载全球动画趋势">
      {Array.from({ length: count }, (_, index) => <span key={index} />)}
    </div>
  );
}

function useTrendingData(animeService: AnimeService): TrendingData {
  const [data, setData] = useState<TrendingData>({
    anime: [],
    error: null,
    loading: true,
    refreshing: false,
    warning: null
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cached = await animeService.getCachedTrending(TRENDING_LIMIT);
      if (cancelled) return;
      if (cached) {
        setData({
          anime: cached.data,
          error: null,
          loading: false,
          refreshing: true,
          warning: cached.stale ? "缓存数据可能已经过期，正在尝试刷新。" : null
        });
      }

      try {
        const result = await animeService.getTrending(TRENDING_LIMIT);
        if (cancelled) return;
        setData({
          anime: result.data,
          error: null,
          loading: false,
          refreshing: false,
          warning: result.stale ? "在线数据暂时不可用，当前显示上次缓存结果。" : null
        });
      } catch (error) {
        if (cancelled) return;
        setData((current) => ({
          ...current,
          error: current.anime.length > 0 ? null : toUserMessage(error),
          loading: false,
          refreshing: false,
          warning: current.anime.length > 0 ? "在线数据暂时不可用，当前显示上次缓存结果。" : null
        }));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [animeService]);

  return data;
}

function toUserMessage(error: unknown): string {
  if (error instanceof AnimeApiError) {
    if (error.code === "offline") return "当前似乎处于离线状态，且没有可用缓存。";
    if (error.code === "rate_limited") return "AniList 请求过于频繁，请稍后重试。";
    return "无法连接 AniList，请稍后重试。";
  }
  return error instanceof Error ? error.message : "发生了未知错误。";
}

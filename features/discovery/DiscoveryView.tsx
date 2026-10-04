import { useEffect, useRef, useState } from "react";
import { StateMessage } from "../../components/StateMessage";
import { getChineseAnimeDisplayTitle, type Anime } from "../../domain/anime";
import {
  DEFAULT_DISCOVERY_FILTERS,
  serializeDiscoveryFilters,
  type DiscoveryFilters
} from "../../domain/discovery";
import type { AnimeService } from "../../services/anime/AnimeService";
import { AnimeApiError } from "../../services/anime/errors";
import { openBilibiliSearch } from "../../services/bilibili/openBilibiliSearch";
import type { AppRepository } from "../../storage/repository";
import { FollowAnimeButton } from "../following/FollowAnimeButton";
import { useFollowActions, type FollowActions } from "../following/useFollowActions";
import { RandomAnimePanel } from "../random/RandomAnimeView";
import {
  ERA_OPTIONS,
  FORMAT_OPTIONS,
  GENRE_OPTIONS,
  isDefaultDiscoveryFilters,
  SORT_OPTIONS,
  toggleDiscoveryGenre
} from "./discovery";

const PAGE_SIZE = 10;

type DiscoveryViewProps = {
  animeService: AnimeService;
  repository: AppRepository;
};

export function DiscoveryView({ animeService, repository }: DiscoveryViewProps) {
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_DISCOVERY_FILTERS);
  const followActions = useFollowActions(repository);
  const randomKey = serializeDiscoveryFilters(filters);
  const deferredFilters = useDebouncedFilters(filters);

  return (
    <section className="discovery-view" aria-labelledby="discovery-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">DISCOVER ANIME</p>
          <h2 id="discovery-title">分类找番</h2>
        </div>
      </div>
      <p className="schedule-note">按喜好筛选作品，或者让“随心一番”替你决定。</p>
      <RandomAnimePanel
        animeService={animeService}
        filters={filters}
        followActions={followActions}
        key={randomKey}
      />
      <DiscoveryFilterPanel filters={filters} onChange={setFilters} />
      {followActions.error ? (
        <StateMessage detail={followActions.error} title="无法更新追番状态" tone="warning" />
      ) : null}
      <DiscoveryResults
        animeService={animeService}
        filters={deferredFilters}
        followActions={followActions}
      />
      <p className="trending-source">分类数据：AniList · 中文标题：Bangumi</p>
    </section>
  );
}

function useDebouncedFilters(filters: DiscoveryFilters): DiscoveryFilters {
  const [deferredFilters, setDeferredFilters] = useState(filters);
  useEffect(() => {
    const timer = window.setTimeout(() => setDeferredFilters(filters), 350);
    return () => window.clearTimeout(timer);
  }, [filters]);
  return deferredFilters;
}

function DiscoveryFilterPanel({
  filters,
  onChange
}: {
  filters: DiscoveryFilters;
  onChange: (filters: DiscoveryFilters) => void;
}) {
  return (
    <section className="discovery-filters" aria-labelledby="discovery-filter-title">
      <div className="discovery-filters__heading">
        <div>
          <h3 id="discovery-filter-title">筛选条件</h3>
          <span>类型最多可选两个</span>
        </div>
        <button
          className="text-link-button"
          disabled={isDefaultDiscoveryFilters(filters)}
          onClick={() => onChange(DEFAULT_DISCOVERY_FILTERS)}
          type="button"
        >
          重置
        </button>
      </div>
      <FilterRow label="形式">
        {FORMAT_OPTIONS.map((option) => (
          <FilterChip
            active={filters.format === option.value}
            key={option.value}
            label={option.label}
            onClick={() => onChange({ ...filters, format: option.value })}
          />
        ))}
      </FilterRow>
      <FilterRow label="类型">
        {GENRE_OPTIONS.map((option) => {
          const active = filters.genres.includes(option.value);
          return (
            <FilterChip
              active={active}
              disabled={!active && filters.genres.length >= 2}
              key={option.value}
              label={option.label}
              onClick={() => onChange(toggleDiscoveryGenre(filters, option.value))}
            />
          );
        })}
      </FilterRow>
      <FilterRow label="年代">
        {ERA_OPTIONS.map((option) => (
          <FilterChip
            active={filters.era === option.value}
            key={option.value}
            label={option.label}
            onClick={() => onChange({ ...filters, era: option.value })}
          />
        ))}
      </FilterRow>
      <FilterRow label="排序">
        {SORT_OPTIONS.map((option) => (
          <FilterChip
            active={filters.sort === option.value}
            key={option.value}
            label={option.label}
            onClick={() => onChange({ ...filters, sort: option.value })}
          />
        ))}
      </FilterRow>
    </section>
  );
}

function FilterRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="filter-row">
      <strong>{label}</strong>
      <div className="filter-chips">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  disabled = false,
  label,
  onClick
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className="filter-chip"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function DiscoveryResults({
  animeService,
  filters,
  followActions
}: {
  animeService: AnimeService;
  filters: DiscoveryFilters;
  followActions: FollowActions;
}) {
  const [anime, setAnime] = useState<Anime[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtersKey = serializeDiscoveryFilters(filters);
  const filtersKeyRef = useRef(filtersKey);
  filtersKeyRef.current = filtersKey;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    animeService.browseAnime(filters, 1, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setAnime(result.data.anime);
        setPage(1);
        setHasNextPage(result.data.hasNextPage);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setAnime([]);
          setError(toUserMessage(requestError));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [animeService, filters]);

  async function loadMore() {
    if (loadingMore || !hasNextPage) return;
    const requestKey = filtersKey;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await animeService.browseAnime(filters, page + 1, PAGE_SIZE);
      if (filtersKeyRef.current !== requestKey) return;
      setAnime((current) => [
        ...current,
        ...result.data.anime.filter((item) => !current.some((existing) => existing.id === item.id))
      ]);
      setPage(result.data.page);
      setHasNextPage(result.data.hasNextPage);
    } catch (requestError) {
      setError(toUserMessage(requestError));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="discovery-results" aria-labelledby="discovery-results-title">
      <div className="discovery-results__heading">
        <h3 id="discovery-results-title">筛选结果</h3>
        {!loading && !error ? <span>已加载 {anime.length} 部</span> : null}
      </div>
      {loading ? <DiscoveryLoading /> : null}
      {error ? <StateMessage detail={error} title="暂时无法加载分类结果" tone="error" /> : null}
      {!loading && !error && anime.length === 0 ? (
        <StateMessage detail="可以减少类型条件，或者换一个年代再试。" title="没有找到符合条件的作品" />
      ) : null}
      {!loading && anime.length > 0 ? (
        <div className="discovery-grid">
          {anime.map((item) => (
            <DiscoveryCard anime={item} followActions={followActions} key={item.id} />
          ))}
        </div>
      ) : null}
      {hasNextPage && !loading ? (
        <button
          className="secondary-button discovery-load-more"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          type="button"
        >
          {loadingMore ? "加载中…" : "加载更多"}
        </button>
      ) : null}
    </section>
  );
}

function DiscoveryCard({ anime, followActions }: { anime: Anime; followActions: FollowActions }) {
  const title = getChineseAnimeDisplayTitle(anime);
  const score = anime.averageScore === undefined ? "暂无评分" : `${(anime.averageScore / 10).toFixed(1)} 分`;
  return (
    <article className="discovery-card">
      <button
        className="discovery-card__cover"
        onClick={() => void openBilibiliSearch(anime)}
        title={`在哔哩哔哩搜索 ${title}`}
        type="button"
      >
        {anime.coverImage ? <img alt="" loading="lazy" src={anime.coverImage} /> : <span aria-hidden="true">B</span>}
      </button>
      <div className="discovery-card__copy">
        <button onClick={() => void openBilibiliSearch(anime)} type="button">{title}</button>
        <span>{[anime.seasonYear ? `${anime.seasonYear}年` : null, score].filter(Boolean).join(" · ")}</span>
      </div>
      <FollowAnimeButton actions={followActions} anime={anime} />
    </article>
  );
}

function DiscoveryLoading() {
  return (
    <div className="discovery-loading" aria-label="正在加载分类结果" role="status">
      {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
    </div>
  );
}

function toUserMessage(error: unknown): string {
  if (error instanceof AnimeApiError) {
    if (error.code === "offline") return "当前似乎处于离线状态，且没有可用缓存。";
    if (error.code === "rate_limited") return "AniList 暂时繁忙，已自动重试仍未成功，请稍后再试。";
    return "无法连接动画数据服务，请稍后重试。";
  }
  return error instanceof Error ? error.message : "发生了未知错误。";
}

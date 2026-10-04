import { useState } from "react";
import { StateMessage } from "../../components/StateMessage";
import { getChineseAnimeDisplayTitle, type Anime } from "../../domain/anime";
import type { DiscoveryFilters } from "../../domain/discovery";
import type { AnimeService } from "../../services/anime/AnimeService";
import { AnimeApiError } from "../../services/anime/errors";
import { openBilibiliSearch } from "../../services/bilibili/openBilibiliSearch";
import { FollowAnimeButton } from "../following/FollowAnimeButton";
import type { FollowActions } from "../following/useFollowActions";
import {
  formatRandomAnimeGenres,
  formatRandomAnimeScore,
  getRandomAnimeFacts
} from "./randomAnime";

type RandomAnimePanelProps = {
  animeService: AnimeService;
  filters: DiscoveryFilters;
  followActions: FollowActions;
};

export function RandomAnimePanel({
  animeService,
  filters,
  followActions
}: RandomAnimePanelProps) {
  const [anime, setAnime] = useState<Anime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  async function drawAnime() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setHasDrawn(true);
    try {
      const result = await animeService.getRandomAnime(anime?.id, filters);
      if (!result.data) {
        setAnime(null);
        setError("这次没有抽到合适的番剧，请再试一次。");
      } else {
        setAnime(result.data);
      }
    } catch (requestError) {
      setError(toUserMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="random-panel" aria-labelledby="random-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ANIME ROULETTE</p>
          <h3 id="random-title">随心一番</h3>
        </div>
        {anime ? (
          <button className="secondary-button" disabled={loading} onClick={() => void drawAnime()} type="button">
            {loading ? "抽取中…" : "再抽一部"}
          </button>
        ) : null}
      </div>
      <p className="schedule-note">从当前筛选范围随机抽取；不设条件时新番、老番都有机会出现。</p>

      {error ? <StateMessage detail={error} title="随机抽取失败" tone="error" /> : null}
      {followActions.error ? <StateMessage detail={followActions.error} title="无法更新追番状态" tone="warning" /> : null}

      {!anime ? (
        <div className="random-empty">
          <span aria-hidden="true">?</span>
          <strong>{loading ? "正在翻动番剧库…" : "今天看什么？"}</strong>
          <p>{hasDrawn && error ? "网络恢复后可以继续抽取。" : "会自动采用当前的分类筛选条件。"}</p>
          <button className="primary-button" disabled={loading} onClick={() => void drawAnime()} type="button">
            {loading ? "抽取中…" : "按当前条件抽一部"}
          </button>
        </div>
      ) : (
        <RandomAnimeCard anime={anime} followActions={followActions} />
      )}
    </section>
  );
}

function RandomAnimeCard({
  anime,
  followActions
}: {
  anime: Anime;
  followActions: FollowActions;
}) {
  const title = getChineseAnimeDisplayTitle(anime);
  const originalTitle = anime.title.native || anime.title.romaji || anime.title.english;
  const facts = getRandomAnimeFacts(anime);
  const genres = formatRandomAnimeGenres(anime.genres);

  return (
    <article className="random-card">
      <div className="random-card__hero">
        {anime.coverImage ? (
          <img src={anime.coverImage} alt="" loading="lazy" />
        ) : (
          <div className="random-cover-placeholder" aria-hidden="true">B</div>
        )}
        <div className="random-card__summary">
          <div>
            <h3>{title}</h3>
            {originalTitle && originalTitle !== title ? <small>{originalTitle}</small> : null}
          </div>
          <strong className="random-score">★ {formatRandomAnimeScore(anime)}</strong>
          {facts.length > 0 ? <p>{facts.join(" · ")}</p> : null}
          {genres.length > 0 ? (
            <div className="random-genres" aria-label="番剧类型">
              {genres.slice(0, 5).map((genre) => <span key={genre}>{genre}</span>)}
            </div>
          ) : null}
        </div>
      </div>
      <section className="random-description" aria-labelledby="random-description-title">
        <h4 id="random-description-title">剧情简介</h4>
        <p>{anime.description || "暂无中文简介。"}</p>
      </section>
      <div className="random-actions">
        <FollowAnimeButton actions={followActions} anime={anime} />
        <button className="primary-button" onClick={() => void openBilibiliSearch(anime)} type="button">
          在 B 站搜索
        </button>
      </div>
      <p className="trending-source">动画资料：AniList · 中文资料：Bangumi</p>
    </article>
  );
}

function toUserMessage(error: unknown): string {
  if (error instanceof AnimeApiError) {
    if (error.code === "offline") return "当前似乎处于离线状态。";
    if (error.code === "rate_limited") return "AniList 暂时繁忙，已自动重试仍未成功，请稍后再试。";
    return "无法连接动画数据服务，请稍后重试。";
  }
  return error instanceof Error ? error.message : "发生了未知错误。";
}

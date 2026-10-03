import type { FollowedAnime } from "../../domain/anime";
import { getAnimeDisplayTitle } from "../../domain/anime";
import { openBilibiliSearch } from "../../services/bilibili/openBilibiliSearch";
import { formatLocalAiringTime, getLocalDateKey, type CalendarItem } from "./calendar";

type AiringRowProps = {
  item: CalendarItem;
  follow?: FollowedAnime;
  showDay?: boolean;
};

export function AiringRow({ item, follow, showDay = false }: AiringRowProps) {
  const title = item.anime ? getAnimeDisplayTitle(item.anime) : `AniList #${item.event.animeId}`;
  const day = showDay
    ? getLocalDateKey(item.event.airingAt) === getLocalDateKey(Math.floor(Date.now() / 1000))
      ? "今天"
      : new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(
          new Date(item.event.airingAt * 1000)
        )
    : null;

  return (
    <article className="airing-row">
      <time dateTime={new Date(item.event.airingAt * 1000).toISOString()}>
        {formatLocalAiringTime(item.event.airingAt)}
      </time>
      {item.anime?.coverImage ? (
        <img src={item.anime.coverImage} alt="" loading="lazy" />
      ) : (
        <div className="airing-cover-placeholder" aria-hidden="true">B</div>
      )}
      <div className="airing-copy">
        {item.anime ? (
          <button
            type="button"
            onClick={() => void openBilibiliSearch(item.anime!, follow?.bilibiliSearchAlias)}
          >
            {title}
          </button>
        ) : <strong>{title}</strong>}
        <span>{day ? `${day} · ` : ""}第 {item.event.episode} 集预计播出</span>
      </div>
    </article>
  );
}

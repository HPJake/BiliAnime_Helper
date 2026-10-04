import type { Anime } from "../../domain/anime";
import type { FollowActions } from "./useFollowActions";

type FollowAnimeButtonProps = {
  actions: FollowActions;
  anime: Anime;
};

export function FollowAnimeButton({ actions, anime }: FollowAnimeButtonProps) {
  const followed = actions.followedIds.has(anime.id);
  const busy = actions.busyIds.has(anime.id);
  const label = busy ? "保存中…" : followed ? "已追" : "追番";
  const description = followed ? "点击取消追番" : "添加到我的追番";

  return (
    <button
      aria-label={`${label}：${description}`}
      aria-pressed={followed}
      className={`follow-button${followed ? " follow-button--active" : ""}`}
      disabled={!actions.ready || busy}
      onClick={() => void actions.toggleFollow(anime)}
      title={description}
      type="button"
    >
      <span className="follow-button__state">{busy ? "保存中…" : followed ? "✓ 已追" : "＋追番"}</span>
      {followed && !busy ? <span className="follow-button__cancel">取消</span> : null}
    </button>
  );
}

import { useEffect, useMemo, useState } from "react";
import { StateMessage } from "../../components/StateMessage";
import type { AiringEvent } from "../../domain/airing";
import { getAnimeDisplayTitle, type Anime, type FollowedAnime } from "../../domain/anime";
import type { AnimeService } from "../../services/anime/AnimeService";
import { openBilibiliSearch } from "../../services/bilibili/openBilibiliSearch";
import type { AppRepository } from "../../storage/repository";
import {
  buildWeeklyCalendar,
  getLocalCalendarRange,
  getNextUp,
  includeNextAiringEvents
} from "./calendar";
import { AiringRow } from "./AiringRow";

type CalendarViewProps = {
  animeService: AnimeService;
  mode: "today" | "calendar";
  onOpenMyAnime: () => void;
  repository: AppRepository;
};

type CalendarData = {
  animeById: Map<number, Anime>;
  error: string | null;
  events: AiringEvent[];
  followed: FollowedAnime[];
  loading: boolean;
  refreshing: boolean;
  seriesByFollowId: Map<number, number[]>;
  warning: string | null;
};

export function CalendarView({ animeService, mode, onOpenMyAnime, repository }: CalendarViewProps) {
  const data = useCalendarData(animeService, repository);
  const now = useMemo(() => new Date(), []);
  const days = useMemo(
    () => buildWeeklyCalendar(data.events, data.animeById, now),
    [data.animeById, data.events, now]
  );
  const followByAnimeId = useMemo(() => {
    const map = new Map<number, FollowedAnime>();
    for (const record of data.followed) {
      for (const animeId of data.seriesByFollowId.get(record.aniListId) ?? [record.aniListId]) {
        map.set(animeId, record);
      }
    }
    return map;
  }, [data.followed, data.seriesByFollowId]);
  const unscheduled = useMemo(() => {
    const scheduledIds = new Set(data.events.map((event) => event.animeId));
    return data.followed.filter((record) =>
      !(data.seriesByFollowId.get(record.aniListId) ?? [record.aniListId])
        .some((animeId) => scheduledIds.has(animeId))
    );
  }, [data.events, data.followed, data.seriesByFollowId]);
  const nextEvent = getNextUp(data.events, Math.floor(now.getTime() / 1000));
  const nextItem = nextEvent
    ? { event: nextEvent, anime: data.animeById.get(nextEvent.animeId) }
    : null;

  return (
    <section className={`calendar-view calendar-view--${mode}`} aria-labelledby="calendar-view-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">预计播出</p>
          <h2 id="calendar-view-title">{mode === "today" ? "今日更新" : "未来七天"}</h2>
        </div>
        {data.refreshing && !data.loading ? <span className="refresh-indicator">正在刷新…</span> : null}
      </div>

      <p className="schedule-note">排期来自 AniList，中文标题来自 Bangumi；不代表哔哩哔哩一定可观看。</p>

      {data.error ? <StateMessage title="暂时无法加载日历" detail={data.error} tone="error" /> : null}
      {data.warning ? <StateMessage title="正在使用缓存数据" detail={data.warning} tone="warning" /> : null}
      {data.loading ? <CalendarLoading /> : null}

      {!data.loading && data.followed.length === 0 ? (
        <div className="empty-calendar">
          <StateMessage title="还没有追番" detail="添加想追的动画后，这里会自动生成每周排期。" />
          <button type="button" className="primary-button" onClick={onOpenMyAnime}>去添加番剧</button>
        </div>
      ) : null}

      {!data.loading && data.followed.length > 0 && mode === "today" ? (
        <>
          <section className="calendar-section" aria-labelledby="today-episodes-title">
            <h3 id="today-episodes-title">今天播出</h3>
            {days[0]?.items.length ? (
              <div className="airing-list">
                {days[0].items.map((item) => (
                  <AiringRow key={eventKey(item.event)} item={item} follow={followByAnimeId.get(item.event.animeId)} />
                ))}
              </div>
            ) : (
              <StateMessage title="今天暂无更新" detail="你追踪的系列今天没有预计播出内容。" />
            )}
          </section>

          <section className="calendar-section" aria-labelledby="next-up-title">
            <h3 id="next-up-title">下一集</h3>
            {nextItem ? (
              <div className="next-up-card">
                <AiringRow item={nextItem} follow={followByAnimeId.get(nextItem.event.animeId)} showDay />
              </div>
            ) : (
              <StateMessage title="未来七天暂无排期" detail="目前没有找到下一集的预计播出时间。" />
            )}
          </section>
        </>
      ) : null}

      {!data.loading && data.followed.length > 0 && mode === "calendar" ? (
        <>
          <div className="calendar-days">
            {days.map((day) => (
              <section className={`calendar-day${day.isToday ? " calendar-day--today" : ""}`} key={day.key} aria-labelledby={`day-${day.key}`}>
                <div className="day-heading">
                  <span>{day.shortLabel}</span>
                  <h3 id={`day-${day.key}`}>{day.label}</h3>
                  <small>{day.items.length ? `${day.items.length} 集` : "暂无更新"}</small>
                </div>
                {day.items.length > 0 ? (
                  <div className="airing-list">
                    {day.items.map((item) => (
                      <AiringRow key={eventKey(item.event)} item={item} follow={followByAnimeId.get(item.event.animeId)} />
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
          {unscheduled.length > 0 ? (
            <section className="calendar-section unscheduled-section" aria-labelledby="unscheduled-title">
              <h3 id="unscheduled-title">本周无排期</h3>
              <div className="unscheduled-list">
                {unscheduled.map((record) => {
                  const anime = data.animeById.get(record.aniListId);
                  return anime ? (
                    <button key={record.aniListId} type="button" onClick={() => void openBilibiliSearch(anime, record.bilibiliSearchAlias)}>
                      {getAnimeDisplayTitle(anime)}
                    </button>
                  ) : <span key={record.aniListId}>AniList #{record.aniListId}</span>;
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function useCalendarData(animeService: AnimeService, repository: AppRepository): CalendarData {
  const [data, setData] = useState<CalendarData>({
    animeById: new Map(),
    error: null,
    events: [],
    followed: [],
    loading: true,
    refreshing: false,
    seriesByFollowId: new Map(),
    warning: null
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const followed = await repository.getFollowedAnime();
        if (cancelled) return;
        if (followed.length === 0) {
          setData((current) => ({ ...current, followed, loading: false }));
          return;
        }

        const range = getLocalCalendarRange();
        const cached = await Promise.all(
          followed.map(async (record) => ({
            id: record.aniListId,
            anime: await animeService.getCachedAnime(record.aniListId),
            schedule: await animeService.getCachedAiringSchedule(record.aniListId, range.from, range.to)
          }))
        );
        if (cancelled) return;

        const cachedAnime = new Map<number, Anime>();
        const cachedEvents: AiringEvent[] = [];
        let hasScheduleCache = false;
        for (const item of cached) {
          if (item.anime?.data) cachedAnime.set(item.id, item.anime.data);
          if (item.schedule) {
            hasScheduleCache = true;
            cachedEvents.push(...item.schedule.data);
          }
        }
        setData((current) => ({
          ...current,
          animeById: cachedAnime,
          events: includeNextAiringEvents(dedupeEvents(cachedEvents), cachedAnime, range),
          followed,
          loading: !hasScheduleCache,
          refreshing: true,
          seriesByFollowId: new Map(followed.map((record) => [record.aniListId, [record.aniListId]]))
        }));

        const seriesResults = await Promise.allSettled(
          followed.map((record) => animeService.getAnimeSeries(record.aniListId))
        );
        if (cancelled) return;

        const animeById = new Map(cachedAnime);
        const seriesByFollowId = new Map<number, number[]>();
        let failures = 0;
        let stale = 0;
        seriesResults.forEach((result, index) => {
          const rootId = followed[index].aniListId;
          if (result.status === "fulfilled" && result.value.data.length > 0) {
            const ids: number[] = [];
            for (const anime of result.value.data) {
              animeById.set(anime.id, anime);
              ids.push(anime.id);
            }
            seriesByFollowId.set(rootId, ids);
            if (result.value.stale) stale += 1;
          } else {
            failures += 1;
            seriesByFollowId.set(rootId, [rootId]);
          }
        });

        const missingRoots = followed.filter((record) => !animeById.has(record.aniListId));
        const fallbackResults = await Promise.allSettled(
          missingRoots.map((record) => animeService.getAnime(record.aniListId))
        );
        fallbackResults.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value.data) {
            animeById.set(missingRoots[index].aniListId, result.value.data);
            if (result.value.stale) stale += 1;
          }
        });

        const scheduleIds = [...new Set([
          ...animeById.keys(),
          ...followed.map((record) => record.aniListId)
        ])];
        const scheduleResults = await Promise.allSettled(
          scheduleIds.map((animeId) => animeService.getAiringSchedule(animeId, range.from, range.to))
        );
        if (cancelled) return;

        const events: AiringEvent[] = [];
        scheduleResults.forEach((result) => {
          if (result.status === "fulfilled") {
            events.push(...result.value.data);
            if (result.value.stale) stale += 1;
          } else {
            failures += 1;
          }
        });
        setData({
          animeById,
          error: null,
          events: includeNextAiringEvents(dedupeEvents(events), animeById, range),
          followed,
          loading: false,
          refreshing: false,
          seriesByFollowId,
          warning: failures > 0 || stale > 0
            ? "部分排期未能刷新，当前时间可能不是最新数据。"
            : null
        });
      } catch (error) {
        if (!cancelled) {
          setData((current) => ({
            ...current,
            error: error instanceof Error ? error.message : "发生了未知错误。",
            loading: false,
            refreshing: false
          }));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [animeService, repository]);

  return data;
}

function CalendarLoading() {
  return (
    <div className="calendar-loading" role="status" aria-label="正在加载播出日历">
      <span />
      <span />
      <span />
    </div>
  );
}

function dedupeEvents(events: AiringEvent[]): AiringEvent[] {
  return [...new Map(events.map((event) => [eventKey(event), event])).values()]
    .sort((left, right) => left.airingAt - right.airingAt);
}

function eventKey(event: AiringEvent): string {
  return `${event.animeId}:${event.episode}:${event.airingAt}`;
}

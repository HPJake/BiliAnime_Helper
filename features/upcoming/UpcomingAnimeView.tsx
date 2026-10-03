import { useEffect, useMemo, useState } from "react";
import { StateMessage } from "../../components/StateMessage";
import type { AiringEvent, AnimeSeason, UpcomingAnimeSchedule } from "../../domain/airing";
import type { Anime } from "../../domain/anime";
import type { AnimeService } from "../../services/anime/AnimeService";
import { AiringRow } from "../calendar/AiringRow";
import {
  buildWeeklyCalendar,
  getAnimeSeason,
  getLocalCalendarRange
} from "../calendar/calendar";

type UpcomingAnimeViewProps = {
  animeService: AnimeService;
};

type UpcomingData = {
  animeById: Map<number, Anime>;
  error: string | null;
  events: AiringEvent[];
  loading: boolean;
  refreshing: boolean;
  warning: string | null;
};

export function UpcomingAnimeView({ animeService }: UpcomingAnimeViewProps) {
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => getLocalCalendarRange(now), [now]);
  const season = useMemo(() => getAnimeSeason(now), [now]);
  const data = useUpcomingData(animeService, range, season);
  const upcomingEvents = useMemo(() => {
    const nowSeconds = Math.floor(now.getTime() / 1000);
    return data.events.filter((event) => event.airingAt >= nowSeconds && event.airingAt < range.to);
  }, [data.events, now, range.to]);
  const days = useMemo(
    () => buildWeeklyCalendar(upcomingEvents, data.animeById, now),
    [data.animeById, now, upcomingEvents]
  );
  const animeCount = useMemo(
    () => new Set(upcomingEvents.map((event) => event.animeId)).size,
    [upcomingEvents]
  );

  return (
    <section className="upcoming-view" aria-labelledby="upcoming-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">本季新番</p>
          <h2 id="upcoming-title">近期播出</h2>
        </div>
        {data.refreshing && !data.loading ? <span className="refresh-indicator">正在刷新…</span> : null}
      </div>

      <p className="schedule-note">
        当前季度日本非成人动画的原始播出排期；不代表哔哩哔哩一定可观看。
      </p>

      {!data.loading && !data.error ? (
        <p className="upcoming-summary">未来七天共 {animeCount} 部 · {upcomingEvents.length} 集</p>
      ) : null}
      {data.error ? <StateMessage title="暂时无法加载新番排期" detail={data.error} tone="error" /> : null}
      {data.warning ? <StateMessage title="正在使用缓存数据" detail={data.warning} tone="warning" /> : null}
      {data.loading ? <UpcomingLoading /> : null}

      {!data.loading && !data.error && upcomingEvents.length === 0 ? (
        <StateMessage title="未来七天暂无新番排期" detail="当前季度暂时没有找到预计播出的动画。" />
      ) : null}

      {!data.loading && upcomingEvents.length > 0 ? (
        <div className="calendar-days upcoming-days">
          {days.map((day) => (
            <section
              className={`calendar-day${day.isToday ? " calendar-day--today" : ""}`}
              key={day.key}
              aria-labelledby={`upcoming-${day.key}`}
            >
              <div className="day-heading">
                <span>{day.shortLabel}</span>
                <h3 id={`upcoming-${day.key}`}>{day.label}</h3>
                <small>{day.items.length ? `${day.items.length} 集` : "暂无更新"}</small>
              </div>
              {day.items.length > 0 ? (
                <div className="airing-list">
                  {day.items.map((item) => (
                    <AiringRow key={eventKey(item.event)} item={item} />
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function useUpcomingData(
  animeService: AnimeService,
  range: { from: number; to: number },
  season: { season: AnimeSeason; year: number }
): UpcomingData {
  const [data, setData] = useState<UpcomingData>({
    animeById: new Map(),
    error: null,
    events: [],
    loading: true,
    refreshing: false,
    warning: null
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cached = await animeService.getCachedUpcomingAnimeSchedule(
        range.from,
        range.to,
        season.season,
        season.year
      );
      if (cancelled) return;
      if (cached) {
        setData(fromSchedule(cached.data, false, true, cached.stale ? "缓存数据可能已经过期。" : null));
      }

      try {
        const result = await animeService.getUpcomingAnimeSchedule(
          range.from,
          range.to,
          season.season,
          season.year
        );
        if (cancelled) return;
        setData(fromSchedule(
          result.data,
          false,
          false,
          result.stale ? "在线数据未能刷新，当前显示上次缓存结果。" : null
        ));
      } catch {
        if (cancelled) return;
        setData((current) => ({
          ...current,
          error: current.events.length > 0
            ? null
            : "动画排期服务暂时不可用，请稍后重试。",
          loading: false,
          refreshing: false,
          warning: current.events.length > 0 ? "在线数据未能刷新，当前显示上次缓存结果。" : null
        }));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [animeService, range.from, range.to, season.season, season.year]);

  return data;
}

function fromSchedule(
  schedule: UpcomingAnimeSchedule,
  loading: boolean,
  refreshing: boolean,
  warning: string | null
): UpcomingData {
  return {
    animeById: new Map(schedule.anime.map((anime) => [anime.id, anime])),
    error: null,
    events: schedule.events,
    loading,
    refreshing,
    warning
  };
}

function UpcomingLoading() {
  return (
    <div className="calendar-loading" role="status" aria-label="正在加载近期新番">
      <span />
      <span />
      <span />
    </div>
  );
}

function eventKey(event: AiringEvent): string {
  return `${event.animeId}:${event.episode}:${event.airingAt}`;
}

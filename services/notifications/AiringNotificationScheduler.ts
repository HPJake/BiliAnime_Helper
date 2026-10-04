import type { Anime } from "../../domain/anime";
import { getAnimeDisplayTitle } from "../../domain/anime";
import type { ScheduledAiringEvent } from "../../domain/settings";
import type { AnimeDataResult } from "../anime/AnimeService";
import { getBilibiliSearchTitle, createBilibiliSearchUrlFromTitle } from "../bilibili/searchUrl";
import type { AppRepository } from "../../storage/repository";

export const REFRESH_ALARM_NAME = "refresh-data";
export const NEXT_AIRING_ALARM_NAME = "next-airing";
export const REFRESH_PERIOD_MINUTES = 30;
export const NOTIFICATION_ID_PREFIX = "airing:";
export const EVENT_RETENTION_SECONDS = 30 * 24 * 60 * 60;

type AlarmInfo = {
  when?: number;
  periodInMinutes?: number;
};

export interface NotificationPlatform {
  getAlarm(name: string): Promise<unknown | undefined>;
  createAlarm(name: string, info: AlarmInfo): Promise<void>;
  clearAlarm(name: string): Promise<unknown>;
  createNotification(id: string, title: string, message: string): Promise<unknown>;
  setBadgeText(text: string): Promise<void>;
  openUrl(url: string): Promise<void>;
}

export interface AnimeSeriesService {
  getAnimeSeries(id: number): Promise<AnimeDataResult<Anime[]>>;
}

export function createAiringEventId(event: Pick<ScheduledAiringEvent, "animeId" | "episode" | "airingAt">): string {
  return `${event.animeId}:${event.episode}:${event.airingAt}`;
}

export function formatBadgeCount(count: number): string {
  if (count <= 0) return "";
  return count > 99 ? "99+" : String(Math.trunc(count));
}

export function pruneEventIds(ids: string[], nowSeconds: number): string[] {
  const cutoff = nowSeconds - EVENT_RETENTION_SECONDS;
  return unique(ids).filter((id) => {
    const airingAt = Number(id.split(":").at(-1));
    return Number.isInteger(airingAt) && airingAt >= cutoff;
  });
}

export class AiringNotificationScheduler {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly repository: AppRepository,
    private readonly animeService: AnimeSeriesService,
    private readonly platform: NotificationPlatform,
    private readonly now: () => number = Date.now
  ) {}

  start(): Promise<void> {
    return this.enqueue(async () => {
      await this.repository.initialize();
      await this.ensureRefreshAlarm();
      await this.processDueEventsInternal();
      await this.refreshScheduleInternal();
    });
  }

  handleAlarm(name: string): Promise<void> {
    return this.enqueue(async () => {
      if (name === REFRESH_ALARM_NAME) {
        await this.refreshScheduleInternal();
      } else if (name === NEXT_AIRING_ALARM_NAME) {
        await this.processDueEventsInternal();
        await this.refreshScheduleInternal();
      }
    });
  }

  refreshNow(): Promise<void> {
    return this.enqueue(async () => {
      const result = await this.refreshScheduleInternal();
      if (result.requested > 0 && result.succeeded === 0) {
        throw new Error("Unable to refresh followed anime schedules");
      }
    });
  }

  markAllSeen(): Promise<void> {
    return this.enqueue(async () => {
      const state = await this.repository.getNotificationState();
      await this.repository.saveNotificationState({ ...state, unseenEventIds: [] });
      await this.syncBadge();
    });
  }

  applySettings(): Promise<void> {
    return this.enqueue(() => this.syncBadge());
  }

  handleNotificationClick(notificationId: string): Promise<void> {
    return this.enqueue(async () => {
      const eventId = notificationId.startsWith(NOTIFICATION_ID_PREFIX)
        ? notificationId.slice(NOTIFICATION_ID_PREFIX.length)
        : "";
      if (!eventId) return;
      const events = await this.repository.getScheduledAiringEvents();
      const event = events.find((candidate) => createAiringEventId(candidate) === eventId);
      if (event) await this.platform.openUrl(createBilibiliSearchUrlFromTitle(event.searchTitle));
    });
  }

  private async ensureRefreshAlarm(): Promise<void> {
    if (await this.platform.getAlarm(REFRESH_ALARM_NAME)) return;
    await this.platform.createAlarm(REFRESH_ALARM_NAME, {
      periodInMinutes: REFRESH_PERIOD_MINUTES
    });
  }

  private async refreshScheduleInternal(): Promise<{ requested: number; succeeded: number }> {
    const nowSeconds = Math.floor(this.now() / 1000);
    const followed = await this.repository.getFollowedAnime();
    const followedIds = new Set(followed.map((item) => item.aniListId));
    const existing = (await this.repository.getScheduledAiringEvents()).filter((event) =>
      followedIds.has(event.followedAnimeId)
    );
    const loaded = await Promise.allSettled(
      followed.map(async (followedAnime) => {
        const result = await this.animeService.getAnimeSeries(followedAnime.aniListId);
        return result.data.flatMap((anime): ScheduledAiringEvent[] => {
          const next = anime.nextAiringEpisode;
          if (!next) return [];
          return [{
            ...next,
            followedAnimeId: followedAnime.aniListId,
            title: getAnimeDisplayTitle(anime),
            searchTitle: getBilibiliSearchTitle(anime, followedAnime.bilibiliSearchAlias)
          }];
        });
      })
    );
    const successfulFollowedIds = new Set(
      loaded.flatMap((result, index) => result.status === "fulfilled"
        ? [followed[index]?.aniListId]
        : []).filter((id): id is number => id !== undefined)
    );
    const retained = existing.filter((event) =>
      event.airingAt <= nowSeconds || !successfulFollowedIds.has(event.followedAnimeId)
    );
    const incoming = loaded.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const events = mergeEvents(retained, incoming, nowSeconds);
    await this.repository.saveScheduledAiringEvents(events);
    await this.processDueEventsInternal();
    return { requested: followed.length, succeeded: successfulFollowedIds.size };
  }

  private async processDueEventsInternal(): Promise<void> {
    const nowSeconds = Math.floor(this.now() / 1000);
    const [settings, state, storedEvents, followed] = await Promise.all([
      this.repository.getSettings(),
      this.repository.getNotificationState(),
      this.repository.getScheduledAiringEvents(),
      this.repository.getFollowedAnime()
    ]);
    const followedIds = new Set(followed.map((item) => item.aniListId));
    const events = mergeEvents(
      [],
      storedEvents.filter((event) => followedIds.has(event.followedAnimeId)),
      nowSeconds
    );
    const notified = new Set(pruneEventIds(state.notifiedEventIds, nowSeconds));
    const unseen = new Set(pruneEventIds(state.unseenEventIds, nowSeconds));
    const due = events.filter((event) => event.airingAt <= nowSeconds && !notified.has(createAiringEventId(event)));

    if (settings.notificationsEnabled) {
      await Promise.allSettled(due.map((event) => this.platform.createNotification(
        `${NOTIFICATION_ID_PREFIX}${createAiringEventId(event)}`,
        `BiliAnime Helper · ${event.title}`,
        `第 ${event.episode} 集已到预计播出时间（不代表 B 站已上线）`
      )));
    }

    for (const event of due) {
      const id = createAiringEventId(event);
      notified.add(id);
      unseen.add(id);
    }
    await Promise.all([
      this.repository.saveNotificationState({
        notifiedEventIds: [...notified],
        unseenEventIds: [...unseen]
      }),
      this.repository.saveScheduledAiringEvents(events)
    ]);
    await this.syncBadge(unseen.size, settings.badgeEnabled);
    await this.scheduleNextAlarm(events, nowSeconds);
  }

  private async syncBadge(unseenCount?: number, badgeEnabled?: boolean): Promise<void> {
    const [settings, state] = await Promise.all([
      badgeEnabled === undefined ? this.repository.getSettings() : null,
      unseenCount === undefined ? this.repository.getNotificationState() : null
    ]);
    const enabled = badgeEnabled ?? settings?.badgeEnabled ?? true;
    const count = unseenCount ?? state?.unseenEventIds.length ?? 0;
    await this.platform.setBadgeText(enabled ? formatBadgeCount(count) : "");
  }

  private async scheduleNextAlarm(events: ScheduledAiringEvent[], nowSeconds: number): Promise<void> {
    const next = events.find((event) => event.airingAt > nowSeconds);
    if (!next) {
      await this.platform.clearAlarm(NEXT_AIRING_ALARM_NAME);
      return;
    }
    await this.platform.createAlarm(NEXT_AIRING_ALARM_NAME, { when: next.airingAt * 1000 });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

function mergeEvents(
  existing: ScheduledAiringEvent[],
  incoming: ScheduledAiringEvent[],
  nowSeconds: number
): ScheduledAiringEvent[] {
  const cutoff = nowSeconds - EVENT_RETENTION_SECONDS;
  const merged = new Map<string, ScheduledAiringEvent>();
  for (const event of [...existing, ...incoming]) {
    if (event.airingAt >= cutoff) merged.set(createAiringEventId(event), { ...event });
  }
  return [...merged.values()].sort((left, right) => left.airingAt - right.airingAt);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

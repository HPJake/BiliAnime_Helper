import { describe, expect, it, vi } from "vitest";
import type { Anime } from "../domain/anime";
import type { ScheduledAiringEvent } from "../domain/settings";
import type { AnimeDataResult } from "../services/anime/AnimeService";
import {
  AiringNotificationScheduler,
  EVENT_RETENTION_SECONDS,
  NEXT_AIRING_ALARM_NAME,
  NOTIFICATION_ID_PREFIX,
  REFRESH_ALARM_NAME,
  createAiringEventId,
  formatBadgeCount,
  pruneEventIds,
  type AnimeSeriesService,
  type NotificationPlatform
} from "../services/notifications/AiringNotificationScheduler";
import { AppRepository } from "../storage/repository";
import { MemoryStorage } from "./helpers/memoryStorage";

const NOW_SECONDS = 2_000_000;
const NOW_MS = NOW_SECONDS * 1000;

class MemoryPlatform implements NotificationPlatform {
  readonly alarms = new Map<string, { when?: number; periodInMinutes?: number }>();
  readonly notifications: Array<{ id: string; title: string; message: string }> = [];
  readonly badgeTexts: string[] = [];
  readonly openedUrls: string[] = [];

  async getAlarm(name: string) {
    return this.alarms.get(name);
  }

  async createAlarm(name: string, info: { when?: number; periodInMinutes?: number }) {
    this.alarms.set(name, { ...info });
  }

  async clearAlarm(name: string) {
    return this.alarms.delete(name);
  }

  async createNotification(id: string, title: string, message: string) {
    this.notifications.push({ id, title, message });
  }

  async setBadgeText(text: string) {
    this.badgeTexts.push(text);
  }

  async openUrl(url: string) {
    this.openedUrls.push(url);
  }
}

function scheduledEvent(overrides: Partial<ScheduledAiringEvent> = {}): ScheduledAiringEvent {
  return {
    animeId: 10,
    followedAnimeId: 10,
    episode: 3,
    airingAt: NOW_SECONDS - 10,
    title: "测试动画",
    searchTitle: "测试动画",
    ...overrides
  };
}

function animeService(anime: Anime[] = []): AnimeSeriesService {
  return {
    getAnimeSeries: vi.fn(async (): Promise<AnimeDataResult<Anime[]>> => ({
      data: anime,
      source: "network",
      stale: false
    }))
  };
}

describe("airing notification helpers", () => {
  it("uses a stable event ID and caps the badge at 99+", () => {
    expect(createAiringEventId(scheduledEvent())).toBe(`10:3:${NOW_SECONDS - 10}`);
    expect(formatBadgeCount(0)).toBe("");
    expect(formatBadgeCount(42)).toBe("42");
    expect(formatBadgeCount(100)).toBe("99+");
  });

  it("prunes malformed and older-than-30-day event IDs", () => {
    const recent = `1:1:${NOW_SECONDS - EVENT_RETENTION_SECONDS}`;
    const old = `1:1:${NOW_SECONDS - EVENT_RETENTION_SECONDS - 1}`;

    expect(pruneEventIds([recent, recent, old, "invalid"], NOW_SECONDS)).toEqual([recent]);
  });
});

describe("AiringNotificationScheduler", () => {
  it("creates required alarms and schedules the nearest future airing", async () => {
    const repository = new AppRepository(new MemoryStorage(), () => NOW_MS);
    await repository.followAnime(10);
    const next = scheduledEvent({ episode: 4, airingAt: NOW_SECONDS + 600 });
    const service = animeService([{
      id: 10,
      title: { native: "テストアニメ" },
      synonyms: [],
      nextAiringEpisode: next
    }]);
    const platform = new MemoryPlatform();
    const scheduler = new AiringNotificationScheduler(repository, service, platform, () => NOW_MS);

    await scheduler.start();

    expect(platform.alarms.get(REFRESH_ALARM_NAME)).toEqual({ periodInMinutes: 30 });
    expect(platform.alarms.get(NEXT_AIRING_ALARM_NAME)).toEqual({
      when: next.airingAt * 1000
    });
  });

  it("processes every due event once, persists unseen state, and survives restart", async () => {
    const storage = new MemoryStorage();
    const repository = new AppRepository(storage, () => NOW_MS);
    await repository.followAnime(10);
    await repository.saveScheduledAiringEvents([
      scheduledEvent(),
      scheduledEvent({ episode: 4, airingAt: NOW_SECONDS - 5 })
    ]);
    const platform = new MemoryPlatform();
    const service = animeService([]);

    await new AiringNotificationScheduler(repository, service, platform, () => NOW_MS).start();
    await new AiringNotificationScheduler(
      new AppRepository(storage, () => NOW_MS),
      service,
      platform,
      () => NOW_MS
    ).start();

    expect(platform.notifications).toHaveLength(2);
    expect(platform.notifications[0]?.message).toContain("预计播出时间");
    expect((await repository.getNotificationState()).unseenEventIds).toHaveLength(2);
    expect(platform.badgeTexts.at(-1)).toBe("2");
  });

  it("tracks unseen events even when system notifications are disabled", async () => {
    const repository = new AppRepository(new MemoryStorage(), () => NOW_MS);
    await repository.followAnime(10);
    await repository.saveSettings({
      notificationsEnabled: false,
      badgeEnabled: true,
      timezoneMode: "local"
    });
    await repository.saveScheduledAiringEvents([scheduledEvent()]);
    const platform = new MemoryPlatform();

    await new AiringNotificationScheduler(repository, animeService(), platform, () => NOW_MS).start();

    expect(platform.notifications).toHaveLength(0);
    expect((await repository.getNotificationState()).unseenEventIds).toHaveLength(1);
    expect(platform.badgeTexts.at(-1)).toBe("1");
  });

  it("marks events seen when the popup opens", async () => {
    const repository = new AppRepository(new MemoryStorage(), () => NOW_MS);
    const id = createAiringEventId(scheduledEvent());
    await repository.saveNotificationState({ notifiedEventIds: [id], unseenEventIds: [id] });
    const platform = new MemoryPlatform();
    const scheduler = new AiringNotificationScheduler(repository, animeService(), platform, () => NOW_MS);

    await scheduler.markAllSeen();

    expect((await repository.getNotificationState()).unseenEventIds).toEqual([]);
    expect(platform.badgeTexts.at(-1)).toBe("");
  });

  it("opens the stored Bilibili search when a notification is clicked", async () => {
    const repository = new AppRepository(new MemoryStorage(), () => NOW_MS);
    const event = scheduledEvent({ searchTitle: "药屋少女的呢喃" });
    await repository.saveScheduledAiringEvents([event]);
    const platform = new MemoryPlatform();
    const scheduler = new AiringNotificationScheduler(repository, animeService(), platform, () => NOW_MS);

    await scheduler.handleNotificationClick(`${NOTIFICATION_ID_PREFIX}${createAiringEventId(event)}`);

    expect(platform.openedUrls).toEqual([
      `https://search.bilibili.com/all?keyword=${encodeURIComponent("药屋少女的呢喃")}`
    ]);
  });
});

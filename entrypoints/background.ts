import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import { AniListProvider } from "../services/anime/AniListProvider";
import { AnimeService } from "../services/anime/AnimeService";
import { BangumiTitleProvider } from "../services/anime/BangumiTitleProvider";
import { LocalizedAnimeProvider } from "../services/anime/LocalizedAnimeProvider";
import {
  AiringNotificationScheduler,
  type NotificationPlatform
} from "../services/notifications/AiringNotificationScheduler";
import { browserStorageArea, createAppRepository } from "../storage/browserStorage";
import { CacheRepository } from "../utils/cache";

export default defineBackground(() => {
  const repository = createAppRepository();
  const animeService = new AnimeService(
    new LocalizedAnimeProvider(new AniListProvider(), new BangumiTitleProvider()),
    new CacheRepository(browserStorageArea)
  );
  const platform: NotificationPlatform = {
    getAlarm: (name) => browser.alarms.get(name),
    createAlarm: async (name, info) => {
      if (info.when !== undefined) {
        await browser.alarms.create(name, { when: info.when });
      } else if (info.periodInMinutes !== undefined) {
        await browser.alarms.create(name, { periodInMinutes: info.periodInMinutes });
      }
    },
    clearAlarm: (name) => browser.alarms.clear(name),
    createNotification: (id, title, message) => browser.notifications.create(id, {
      type: "basic",
      iconUrl: browser.runtime.getURL("/icon-128.svg"),
      title,
      message
    }),
    setBadgeText: async (text) => {
      if (text) await browser.action.setBadgeBackgroundColor({ color: "#fb7299" });
      await browser.action.setBadgeText({ text });
    },
    openUrl: async (url) => {
      await browser.tabs.create({ url });
    }
  };
  const scheduler = new AiringNotificationScheduler(
    repository,
    animeService,
    platform
  );

  browser.alarms.onAlarm.addListener((alarm) => {
    void scheduler.handleAlarm(alarm.name).catch(reportBackgroundError);
  });
  browser.notifications.onClicked.addListener((notificationId) => {
    void scheduler.handleNotificationClick(notificationId).catch(reportBackgroundError);
  });
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isPopupOpenedMessage(message)) return scheduler.markAllSeen();
    return undefined;
  });

  void scheduler.start().catch(reportBackgroundError);
});

function isPopupOpenedMessage(message: unknown): message is { type: "popup-opened" } {
  return typeof message === "object" && message !== null &&
    "type" in message && message.type === "popup-opened";
}

function reportBackgroundError(error: unknown): void {
  console.error("BiliAnime Helper background task failed", error);
}

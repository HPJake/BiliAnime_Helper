import type { AiringEvent } from "./airing";

export type AppSettings = {
  notificationsEnabled: boolean;
  badgeEnabled: boolean;
  timezoneMode: "local";
};

export type NotificationState = {
  notifiedEventIds: string[];
  unseenEventIds: string[];
};

export type ScheduledAiringEvent = AiringEvent & {
  followedAnimeId: number;
  title: string;
  searchTitle: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  badgeEnabled: true,
  timezoneMode: "local"
};

export const DEFAULT_NOTIFICATION_STATE: NotificationState = {
  notifiedEventIds: [],
  unseenEventIds: []
};

import type { AiringEvent } from "./airing";
import type { ThemePreference } from "../features/theme/theme";

export type AppSettings = {
  notificationsEnabled: boolean;
  badgeEnabled: boolean;
  themePreference: ThemePreference;
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
  themePreference: "auto",
  timezoneMode: "local"
};

export const DEFAULT_NOTIFICATION_STATE: NotificationState = {
  notifiedEventIds: [],
  unseenEventIds: []
};

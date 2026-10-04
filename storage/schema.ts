import type { FollowedAnime } from "../domain/anime";
import {
  DEFAULT_NOTIFICATION_STATE,
  DEFAULT_SETTINGS,
  type AppSettings,
  type NotificationState,
  type ScheduledAiringEvent
} from "../domain/settings";

export const STORAGE_SCHEMA_VERSION = 3;

export const STORAGE_KEYS = {
  schemaVersion: "schemaVersion",
  followedAnime: "followedAnime",
  settings: "settings",
  notificationState: "notificationState",
  scheduledAiringEvents: "scheduledAiringEvents"
} as const;

export type StorageSchema = {
  schemaVersion: number;
  followedAnime: FollowedAnime[];
  settings: AppSettings;
  notificationState: NotificationState;
  scheduledAiringEvents: ScheduledAiringEvent[];
};

export const DEFAULT_STORAGE: StorageSchema = {
  schemaVersion: STORAGE_SCHEMA_VERSION,
  followedAnime: [],
  settings: DEFAULT_SETTINGS,
  notificationState: DEFAULT_NOTIFICATION_STATE,
  scheduledAiringEvents: []
};

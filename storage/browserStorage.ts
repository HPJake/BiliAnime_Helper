import { browser } from "wxt/browser";
import { AppRepository, type StorageArea, type StorageKeys } from "./repository";

export const browserStorageArea: StorageArea = {
  async get(keys?: StorageKeys) {
    return browser.storage.local.get(keys ?? null) as Promise<Record<string, unknown>>;
  },
  async set(items) {
    await browser.storage.local.set(items);
  },
  async remove(keys) {
    await browser.storage.local.remove(keys);
  }
};

export function createAppRepository(): AppRepository {
  return new AppRepository(browserStorageArea);
}

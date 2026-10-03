import type { StorageArea, StorageKeys } from "../../storage/repository";

export class MemoryStorage implements StorageArea {
  readonly values = new Map<string, unknown>();

  async get(keys?: StorageKeys): Promise<Record<string, unknown>> {
    if (keys === null || keys === undefined) return Object.fromEntries(this.values);
    const requested = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      requested.filter((key) => this.values.has(key)).map((key) => [key, this.values.get(key)])
    );
  }

  async set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items)) this.values.set(key, structuredClone(value));
  }

  async remove(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.values.delete(key);
  }
}

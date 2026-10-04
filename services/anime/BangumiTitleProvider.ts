export type ChineseTitleMatch = {
  native: string;
  chinese: string;
  score?: number;
  summary?: string;
};

export interface ChineseTitleProvider {
  searchTitles(query: string, limit?: number): Promise<ChineseTitleMatch[]>;
  getCalendarTitles(): Promise<ChineseTitleMatch[]>;
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const BANGUMI_SEARCH_ENDPOINT = "https://api.bgm.tv/v0/search/subjects";
const BANGUMI_CALENDAR_ENDPOINT = "https://api.bgm.tv/calendar";

export class BangumiTitleProvider implements ChineseTitleProvider {
  constructor(private readonly fetcher: Fetcher = fetch) {}

  async searchTitles(query: string, limit = 10): Promise<ChineseTitleMatch[]> {
    const keyword = query.trim();
    if (!keyword) return [];
    const url = `${BANGUMI_SEARCH_ENDPOINT}?limit=${clampLimit(limit)}&offset=0`;
    const response = await this.fetcher.call(globalThis, url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        keyword,
        sort: "match",
        filter: { type: [2], nsfw: false }
      })
    });
    if (!response.ok) throw new Error(`Bangumi request failed with HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.data)) return [];

    return mapTitleMatches(payload.data);
  }

  async getCalendarTitles(): Promise<ChineseTitleMatch[]> {
    const response = await this.fetcher.call(globalThis, BANGUMI_CALENDAR_ENDPOINT, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Bangumi calendar request failed with HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return [];
    const items = payload.flatMap((day) =>
      isRecord(day) && Array.isArray(day.items) ? day.items : []
    );
    return mapTitleMatches(items);
  }
}

function mapTitleMatches(items: unknown[]): ChineseTitleMatch[] {
  const matches = new Map<string, ChineseTitleMatch>();
  for (const item of items) {
    if (!isRecord(item) || typeof item.name !== "string" || typeof item.name_cn !== "string") continue;
    const native = item.name.trim();
    const chinese = item.name_cn.trim();
    const summary = typeof item.summary === "string" ? item.summary.trim() : "";
    const rating = isRecord(item.rating) && isFiniteNumber(item.rating.score)
      ? item.rating.score
      : null;
    if (native && chinese) {
      matches.set(normalize(native), {
        native,
        chinese,
        ...(summary ? { summary } : {}),
        ...(rating !== null && rating > 0 ? { score: rating } : {})
      });
    }
  }
  return [...matches.values()];
}

function clampLimit(limit: number): number {
  return Math.min(20, Math.max(1, Math.trunc(limit)));
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

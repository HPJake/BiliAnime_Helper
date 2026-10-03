import { describe, expect, it, vi } from "vitest";
import { BangumiTitleProvider } from "../services/anime/BangumiTitleProvider";

describe("BangumiTitleProvider", () => {
  it("maps Chinese anime titles and limits results to anime", async () => {
    const fetcher = vi.fn(function (this: unknown, _input: string | URL | Request, _init?: RequestInit) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      void _input;
      void _init;
      return Promise.resolve(Response.json({
        data: [
          { name: "薬屋のひとりごと", name_cn: "药屋少女的呢喃", type: 2 },
          { name: "薬屋のひとりごと 第3期", name_cn: "药屋少女的呢喃 第三季", type: 2 }
        ]
      }));
    });
    const provider = new BangumiTitleProvider(fetcher);

    await expect(provider.searchTitles("药屋少女的呢喃", 10)).resolves.toEqual([
      { native: "薬屋のひとりごと", chinese: "药屋少女的呢喃" },
      { native: "薬屋のひとりごと 第3期", chinese: "药屋少女的呢喃 第三季" }
    ]);
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ keyword: "药屋少女的呢喃", filter: { type: [2], nsfw: false } });
  });
});

import { browser } from "wxt/browser";
import type { Anime } from "../../domain/anime";
import { createBilibiliSearchUrl } from "./searchUrl";

export async function openBilibiliSearch(
  anime: Anime,
  bilibiliSearchAlias?: string
): Promise<void> {
  await browser.tabs.create({ url: createBilibiliSearchUrl(anime, bilibiliSearchAlias) });
}

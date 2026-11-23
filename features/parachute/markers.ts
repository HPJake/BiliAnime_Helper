export type OpeningMarker = { start: number; target: number };

export function chooseOpeningMarker(comments: Iterable<{ time: number; text: string }>): OpeningMarker | null {
  const candidates = new Map<number, { start: number; votes: number }>();
  for (const { time, text } of comments) {
    const match = /跳[伞傘]\s*[:：]?\s*(\d{1,3})\s*:\s*([0-5]\d)(?![\d:])/u.exec(text.normalize("NFKC"));
    if (!match || !Number.isFinite(time) || time < 0) continue;
    const target = Number(match[1]) * 60 + Number(match[2]);
    if (target <= time) continue;
    const group = candidates.get(target);
    candidates.set(target, { start: Math.min(time, group?.start ?? time), votes: (group?.votes ?? 0) + 1 });
  }
  const best = [...candidates].sort(([, a], [, b]) => b.votes - a.votes || a.start - b.start)[0];
  return best ? { start: best[1].start, target: best[0] } : null;
}

export function episodeKey(url: URL): string | null {
  const video = /^\/video\/(BV[\da-zA-Z]+|av\d+)\/?$/.exec(url.pathname);
  if (video) {
    const page = Number(url.searchParams.get("p") ?? 1);
    return Number.isSafeInteger(page) && page > 0 ? video[1] + "/" + page : null;
  }
  return /^\/bangumi\/play\/(ep\d+)\/?$/.exec(url.pathname)?.[1] ?? null;
}

export async function loadOpeningMarker(key: string, signal: AbortSignal): Promise<OpeningMarker | null> {
  const api = "https://api.bilibili.com";
  const options = { signal, credentials: "omit" } as const;
  const [id, page] = key.split("/");
  const bangumi = id.startsWith("ep");
  const lookup = bangumi ? "/pgc/view/web/season?ep_id=" + id.slice(2)
    : "/x/player/pagelist?" + (id.startsWith("av") ? "aid=" + id.slice(2) : "bvid=" + id);
  const response = await fetch(api + lookup, options);
  if (!response.ok) throw new Error("无法读取分集信息");
  const data = await response.json();
  if (data.code !== 0) throw new Error("无法读取分集信息");
  const episodes: { id?: number; page?: number; cid: number }[] = bangumi ? data.result?.episodes : data.data;
  const episode = episodes?.find((item) => bangumi ? item.id === Number(id.slice(2)) : item.page === Number(page));
  if (!episode || !Number.isSafeInteger(episode.cid)) return null;
  const result = await fetch(api + "/x/v1/dm/list.so?oid=" + episode.cid, options);
  if (!result.ok) throw new Error("无法读取弹幕");
  const xml = new DOMParser().parseFromString(await result.text(), "application/xml");
  if (xml.documentElement.localName !== "i") throw new Error("弹幕格式异常");
  return chooseOpeningMarker(Array.from(xml.querySelectorAll("d[p]"), (node) => ({
    time: parseFloat(node.getAttribute("p") ?? ""),
    text: node.textContent ?? ""
  })));
}

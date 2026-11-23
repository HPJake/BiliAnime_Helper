import { browser } from "wxt/browser";
import { episodeKey, loadOpeningMarker, type OpeningMarker } from "./markers";

const preference = "autoParachuteEnabled";

export class AutoParachute {
  readonly button = document.createElement("button");
  private video: HTMLVideoElement | null = null;
  private key: string | null = null;
  private request?: AbortController;
  private marker: OpeningMarker | null = null;
  private consumed = false;
  private enabled = false;
  private preferenceReady = false;
  private status = "当前分集没有可用的跳伞提示";

  constructor() {
    this.button.type = "button";
    this.button.textContent = "自动跳伞🪂";
    this.button.onclick = () => {
      void browser.storage.local.set({ [preference]: !this.enabled }).catch(() => {
        this.button.title = "保存开关失败，请再试一次";
      });
    };
    this.render();
  }

  start() {
    browser.storage.onChanged.addListener(this.onStorage);
    void browser.storage.local.get(preference).then((stored) => {
      if (!this.preferenceReady) this.applyPreference(stored[preference]);
    }).catch(() => { this.button.title = "无法读取跳伞设置"; });
    window.addEventListener("popstate", this.update);
  }

  private readonly onStorage = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === "local" && preference in changes) this.applyPreference(changes[preference].newValue);
  };

  private applyPreference(value: unknown) {
    this.preferenceReady = true;
    this.enabled = value === true;
    this.render();
    this.update();
  }

  attach(video: HTMLVideoElement | null) {
    for (const event of ["timeupdate", "playing", "loadedmetadata", "durationchange"]) {
      this.video?.removeEventListener(event, this.update);
      video?.addEventListener(event, this.update);
    }
    this.video = video;
    this.update();
  }

  stop() {
    this.attach(null);
    this.request?.abort();
    browser.storage.onChanged.removeListener(this.onStorage);
    window.removeEventListener("popstate", this.update);
  }

  readonly update = () => {
    const video = this.video;
    if (!video) return;
    const key = episodeKey(new URL(location.href));
    if (key !== this.key) {
      this.request?.abort();
      this.key = key;
      this.marker = null;
      this.consumed = false;
      this.status = key ? "正在查找跳伞弹幕" : "当前分集没有可用的跳伞提示";
      this.render();
      if (key) {
        this.request = new AbortController();
        void this.load(key, this.request.signal);
      }
    }
    const marker = this.marker;
    if (!marker || this.consumed || video.readyState < 1 || !Number.isFinite(video.duration)) return;
    if (marker.target >= video.duration) {
      this.button.disabled = true;
      this.button.title = "跳伞时间超出本集时长";
      return;
    }
    if (this.button.disabled && this.preferenceReady) this.render();
    if (video.currentTime >= marker.target) this.consumed = true;
    if (this.consumed || !this.enabled || video.paused || video.seeking || video.currentTime < marker.start) return;
    this.consumed = true;
    video.currentTime = marker.target;
  };

  private async load(key: string, signal: AbortSignal) {
    try {
      const marker = await loadOpeningMarker(key, signal);
      if (signal.aborted) return;
      this.marker = marker;
      this.status = marker ? "跳至 " + Math.floor(marker.target / 60) + ":" +
        String(marker.target % 60).padStart(2, "0") : "本集弹幕中没有找到跳伞时间";
    } catch {
      if (signal.aborted) return;
      this.status = "弹幕读取失败，可刷新页面重试";
    }
    this.render();
    this.update();
  }

  private render() {
    this.button.disabled = !this.marker || !this.preferenceReady;
    this.button.title = this.status;
    this.button.setAttribute("aria-pressed", String(this.enabled));
  }
}

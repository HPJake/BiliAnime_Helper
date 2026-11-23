import { browser } from "wxt/browser";
import { STORAGE_KEYS } from "../../storage/schema";

const positionKey = "launcherHeightRatio";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function startFloatingLauncher() {
  const host = document.createElement("div");
  host.id = "bilianime-helper-launcher";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; position: fixed; right: 12px; top: 66%; width: 40px; height: 40px;
      z-index: 2147483644; color-scheme: light; }
    :host([hidden]) { display: none !important; }
    button { width: 40px; height: 40px; padding: 5px; border: 1px solid #ffffffbb; border-radius: 50%;
      background: #f9fcff; box-shadow: 0 2px 10px #1113; cursor: pointer; touch-action: none; user-select: none; }
    button:focus-visible { outline: 2px solid #00aeec; outline-offset: 2px; }
    img { width: 100%; height: 100%; pointer-events: none; }
    iframe { display: block; position: fixed; right: 62px; width: min(420px, calc(100vw - 74px));
      height: min(600px, calc(100dvh - 24px)); border: 0; border-radius: 16px;
      box-shadow: 0 8px 32px #12172533; color-scheme: light; }
    :host([data-glass]) iframe { backdrop-filter: blur(8px); }
    @media (max-width: 430px) { iframe { right: 8px; width: calc(100vw - 16px); } }
  `;
  const button = document.createElement("button");
  button.type = "button";
  button.title = "打开追番助手 · 拖动调整高度";
  button.setAttribute("aria-label", "追番助手");
  button.setAttribute("aria-expanded", "false");
  const logo = document.createElement("img");
  logo.src = browser.runtime.getURL("/icon-48.png");
  logo.alt = "";
  button.append(logo);
  shadow.append(style, button);
  host.hidden = true;
  document.documentElement.append(host);

  let frame: HTMLIFrameElement | null = null;
  let ratio = 2 / 3;
  let enabled = true;
  let pointerStart: number | null = null;
  let dragOffset = 0;
  let dragged = false;
  let observedVideo: HTMLVideoElement | null = null;
  const events = new AbortController();
  const { signal } = events;

  function layout() {
    let top = clamp(ratio * innerHeight - 20, 8, innerHeight - 48);
    // Keep the default position clear of the homepage's floating action buttons.
    if (pointerStart === null && ratio === 2 / 3) {
      const obstacle = document.elementsFromPoint(innerWidth - 32, top + 20)
        .find(el => el.closest(".roll-btn,.palette-button-wrap,.fixed-sidenav-storage"));
      if (obstacle) top = clamp(obstacle.getBoundingClientRect().bottom + 8, 8, innerHeight - 48);
    }
    host.style.top = top + "px";
    if (frame) {
      const height = frame.getBoundingClientRect().height;
      frame.style.top = clamp(top + 20 - height / 2, 12, innerHeight - height - 12) + "px";
    }
  }

  function close(restoreFocus = false) {
    frame?.remove();
    frame = null;
    button.setAttribute("aria-expanded", "false");
    if (restoreFocus) button.focus();
  }
  function visibility() {
    const rect = observedVideo?.getBoundingClientRect();
    const fillsWindow = rect && rect.width >= innerWidth - 2 && rect.height >= innerHeight - 2;
    const webFullscreen = document.querySelector('.bpx-state-webscreen, .bpx-player-container[data-screen="web"], body.player-mode-webfullscreen');
    host.hidden = !enabled || Boolean(document.fullscreenElement || fillsWindow || webFullscreen);
    if (host.hidden) close();
    else layout();
  }
  button.onclick = () => {
    if (dragged) { dragged = false; return; }
    if (frame) { close(true); return; }
    frame = document.createElement("iframe");
    frame.title = "BiliAnime Helper 追番助手";
    frame.src = browser.runtime.getURL("/popup.html") + "?floating";
    shadow.append(frame);
    button.setAttribute("aria-expanded", "true");
    layout();
    frame.focus();
  };
  button.onpointerdown = event => {
    if (event.button !== 0 || !event.isPrimary) return;
    pointerStart = event.clientY;
    dragOffset = event.clientY - host.getBoundingClientRect().top;
    dragged = false;
    button.setPointerCapture(event.pointerId);
  };
  button.onpointermove = event => {
    if (pointerStart === null || !event.isPrimary) return;
    if (!dragged && Math.abs(event.clientY - pointerStart) < 5) return;
    dragged = true;
    ratio = clamp((event.clientY - dragOffset + 20) / innerHeight, 0, 1);
    layout();
  };
  button.onpointerup = () => {
    pointerStart = null;
    if (dragged) void browser.storage.local.set({ [positionKey]: ratio });
  };
  button.onpointercancel = () => { pointerStart = null; dragged = false; };
  document.addEventListener("pointerdown", e => {
    if (frame && !e.composedPath().includes(host)) close();
  }, { capture: true, signal });
  window.addEventListener("keydown", e => {
    if (frame && e.key === "Escape") { e.stopPropagation(); close(true); }
  }, { capture: true, signal });
  window.addEventListener("message", e => {
    if (frame && e.source === frame.contentWindow && e.origin === new URL(frame.src).origin &&
        e.data === "bilianime-close-panel") close(true);
  }, { signal });
  const playerResize = new ResizeObserver(visibility);
  function observePlayer(event?: Event) {
    const video = event?.target instanceof HTMLVideoElement ? event.target : document.querySelector("video");
    if (video === observedVideo) return;
    playerResize.disconnect();
    observedVideo = video;
    if (video) playerResize.observe(video);
    visibility();
  }
  if (/^\/(video|bangumi\/play)\//.test(location.pathname)) {
    observePlayer();
    document.addEventListener("playing", observePlayer, { capture: true, signal });
    document.addEventListener("loadedmetadata", observePlayer, { capture: true, signal });
  }
  window.addEventListener("resize", visibility, { signal });
  document.addEventListener("fullscreenchange", visibility, { signal });
  function apply(values: Record<string, unknown>) {
    if (positionKey in values) {
      const y = values[positionKey];
      ratio = typeof y === "number" && Number.isFinite(y) ? clamp(y, 0, 1) : 2 / 3;
    }
    if (STORAGE_KEYS.settings in values) {
      const prefs = values[STORAGE_KEYS.settings] as { launcherEnabled?: boolean; glassEnabled?: boolean } | undefined;
      enabled = prefs?.launcherEnabled !== false;
      host.toggleAttribute("data-glass", prefs?.glassEnabled !== false);
    }
    visibility();
  }
  const changed = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === "local" && (positionKey in changes || STORAGE_KEYS.settings in changes))
      apply(Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue])));
  };
  browser.storage.onChanged.addListener(changed);
  void browser.storage.local.get([positionKey, STORAGE_KEYS.settings]).then(values => {
    if (!signal.aborted) apply({ settings: undefined, ...values });
  });
  return () => {
    events.abort();
    playerResize.disconnect();
    browser.storage.onChanged.removeListener(changed);
    close();
    host.remove();
  };
}

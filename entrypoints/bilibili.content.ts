import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { VideoRotationFeature } from "../features/rotation/videoRotation";
import { detectBilibiliTheme } from "../features/theme/theme";

export default defineContentScript({
  matches: ["*://*.bilibili.com/*"],
  runAt: "document_idle",
  main(ctx) {
    const rotationFeature = isVideoPage(location.pathname) ? new VideoRotationFeature() : null;
    rotationFeature?.start();

    const handleMessage = (message: unknown) => {
      if (!isRecord(message) || message.type !== "get-bilianime-bilibili-theme") return undefined;
      return Promise.resolve({ theme: detectBilibiliTheme() });
    };
    browser.runtime.onMessage.addListener(handleMessage);
    ctx.onInvalidated(() => {
      rotationFeature?.stop();
      browser.runtime.onMessage.removeListener(handleMessage);
    });
  }
});

function isVideoPage(pathname: string): boolean {
  return pathname.startsWith("/video/") || pathname.startsWith("/bangumi/play/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

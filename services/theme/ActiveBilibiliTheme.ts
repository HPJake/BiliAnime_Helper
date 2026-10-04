import { browser } from "wxt/browser";
import type { ResolvedTheme } from "../../features/theme/theme";

export async function getActiveBilibiliTheme(): Promise<ResolvedTheme | null> {
  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id === undefined) return null;
    const response: unknown = await browser.tabs.sendMessage(activeTab.id, {
      type: "get-bilianime-bilibili-theme"
    });
    if (!isRecord(response)) return null;
    return response.theme === "dark" || response.theme === "light" ? response.theme : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

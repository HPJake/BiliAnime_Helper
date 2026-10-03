export const DASHBOARD_TABS = ["today", "calendar", "upcoming", "trending", "my-anime"] as const;

export type DashboardTab = typeof DASHBOARD_TABS[number];

export function getKeyboardTab(current: DashboardTab, key: string): DashboardTab | null {
  const index = DASHBOARD_TABS.indexOf(current);
  if (key === "Home") return DASHBOARD_TABS[0];
  if (key === "End") return DASHBOARD_TABS[DASHBOARD_TABS.length - 1];
  if (key === "ArrowRight") return DASHBOARD_TABS[(index + 1) % DASHBOARD_TABS.length];
  if (key === "ArrowLeft") {
    return DASHBOARD_TABS[(index - 1 + DASHBOARD_TABS.length) % DASHBOARD_TABS.length];
  }
  return null;
}

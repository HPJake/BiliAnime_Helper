import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { browser } from "wxt/browser";
import { DEFAULT_SETTINGS } from "../../domain/settings";
import { CalendarView } from "../../features/calendar/CalendarView";
import { MyAnimeView } from "../../features/following/MyAnimeView";
import { UpcomingAnimeView } from "../../features/upcoming/UpcomingAnimeView";
import { TrendingPreview, TrendingView } from "../../features/trending/TrendingView";
import { SettingsView } from "../../features/settings/SettingsView";
import {
  DASHBOARD_TABS,
  getKeyboardTab,
  type DashboardTab
} from "../../features/dashboard/navigation";
import { AniListProvider } from "../../services/anime/AniListProvider";
import { AnimeService } from "../../services/anime/AnimeService";
import { BangumiTitleProvider } from "../../services/anime/BangumiTitleProvider";
import { LocalizedAnimeProvider } from "../../services/anime/LocalizedAnimeProvider";
import { browserStorageArea, createAppRepository } from "../../storage/browserStorage";
import { CacheRepository } from "../../utils/cache";
import { SettingsService } from "../../services/settings/SettingsService";
import { getActiveBilibiliTheme } from "../../services/theme/ActiveBilibiliTheme";
import {
  resolveThemePreference,
  type ResolvedTheme,
  type ThemePreference
} from "../../features/theme/theme";

const repository = createAppRepository();
const cacheRepository = new CacheRepository(browserStorageArea);
const animeService = new AnimeService(
  new LocalizedAnimeProvider(new AniListProvider(), new BangumiTitleProvider()),
  cacheRepository
);
const settingsService = new SettingsService(
  repository,
  cacheRepository,
  async (message) => {
    await browser.runtime.sendMessage(message);
  }
);

export function App() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("today");
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    DEFAULT_SETTINGS.themePreference
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    void browser.runtime.sendMessage({ type: "popup-opened" }).catch(() => undefined);
    void settingsService.getSettings()
      .then((settings) => setThemePreference(settings.themePreference))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = async () => {
      const bilibiliTheme = themePreference === "auto"
        ? await getActiveBilibiliTheme()
        : null;
      if (cancelled) return;
      setResolvedTheme(resolveThemePreference(
        themePreference,
        bilibiliTheme,
        media.matches ? "dark" : "light"
      ));
    };
    const handleSystemThemeChange = () => void applyTheme();
    void applyTheme();
    media.addEventListener("change", handleSystemThemeChange);
    return () => {
      cancelled = true;
      media.removeEventListener("change", handleSystemThemeChange);
    };
  }, [themePreference]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  function selectTab(tab: DashboardTab) {
    setActiveTab(tab);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = getKeyboardTab(activeTab, event.key);
    if (!next) return;
    event.preventDefault();
    selectTab(next);
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  }

  let panel: ReactNode;
  if (activeTab === "my-anime") {
    panel = <MyAnimeView animeService={animeService} repository={repository} />;
  } else if (activeTab === "settings") {
    panel = (
      <SettingsView
        onThemePreferenceChange={setThemePreference}
        resolvedTheme={resolvedTheme}
        service={settingsService}
        version={browser.runtime.getManifest().version}
      />
    );
  } else if (activeTab === "upcoming") {
    panel = <UpcomingAnimeView animeService={animeService} repository={repository} />;
  } else if (activeTab === "trending") {
    panel = <TrendingView animeService={animeService} repository={repository} />;
  } else {
    panel = (
      <div className={activeTab === "today" ? "dashboard-view" : undefined}>
        <CalendarView
          animeService={animeService}
          mode={activeTab}
          onOpenMyAnime={() => selectTab("my-anime")}
          repository={repository}
        />
        {activeTab === "today" ? (
          <TrendingPreview
            animeService={animeService}
            onOpenTrending={() => selectTab("trending")}
            repository={repository}
          />
        ) : null}
      </div>
    );
  }

  return (
    <main className="popup-shell">
      <header className="app-header">
        <span className="brand-mark" aria-hidden="true">B</span>
        <div className="app-header__copy">
          <h1>BiliAnime Helper</h1>
          <p>你的本地追番仪表盘</p>
        </div>
        <span className="unofficial-chip">UNOFFICIAL</span>
      </header>
      <nav className="tab-bar" role="tablist" aria-label="功能导航">
        {DASHBOARD_TABS.map((tab) => (
          <TabButton
            active={activeTab === tab}
            key={tab}
            label={TAB_LABELS[tab]}
            onClick={() => selectTab(tab)}
            onKeyDown={handleTabKeyDown}
            tab={tab}
          />
        ))}
      </nav>
      <section
        aria-labelledby={`tab-${activeTab}`}
        className="tab-panel"
        id={`panel-${activeTab}`}
        role="tabpanel"
      >
        {panel}
      </section>
      <footer className="app-footer">
        <p>排期与趋势来自 AniList · 中文标题来自 Bangumi</p>
        <p>BiliAnime Helper is an unofficial browser extension and is not affiliated with Bilibili or AniList.</p>
      </footer>
    </main>
  );
}

const TAB_LABELS: Record<DashboardTab, string> = {
  today: "今日",
  calendar: "日历",
  upcoming: "新番",
  trending: "趋势",
  "my-anime": "追番",
  settings: "设置"
};

type TabButtonProps = {
  active: boolean;
  label: string;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  tab: DashboardTab;
};

function TabButton({ active, label, onClick, onKeyDown, tab }: TabButtonProps) {
  return (
    <button
      aria-controls={`panel-${tab}`}
      aria-selected={active}
      id={`tab-${tab}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role="tab"
      tabIndex={active ? 0 : -1}
      type="button"
    >
      {label}
    </button>
  );
}

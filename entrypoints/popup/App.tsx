import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { browser } from "wxt/browser";
import { CalendarView } from "../../features/calendar/CalendarView";
import { MyAnimeView } from "../../features/following/MyAnimeView";
import { UpcomingAnimeView } from "../../features/upcoming/UpcomingAnimeView";
import { TrendingPreview, TrendingView } from "../../features/trending/TrendingView";
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

const repository = createAppRepository();
const animeService = new AnimeService(
  new LocalizedAnimeProvider(new AniListProvider(), new BangumiTitleProvider()),
  new CacheRepository(browserStorageArea)
);

export function App() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("today");

  useEffect(() => {
    void browser.runtime.sendMessage({ type: "popup-opened" }).catch(() => undefined);
  }, []);

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
  } else if (activeTab === "upcoming") {
    panel = <UpcomingAnimeView animeService={animeService} />;
  } else if (activeTab === "trending") {
    panel = <TrendingView animeService={animeService} />;
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
          <TrendingPreview animeService={animeService} onOpenTrending={() => selectTab("trending")} />
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
  "my-anime": "追番"
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

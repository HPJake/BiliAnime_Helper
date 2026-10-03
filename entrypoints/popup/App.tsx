import { useState } from "react";
import { CalendarView } from "../../features/calendar/CalendarView";
import { MyAnimeView } from "../../features/following/MyAnimeView";
import { UpcomingAnimeView } from "../../features/upcoming/UpcomingAnimeView";
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
  const [activeTab, setActiveTab] = useState<"today" | "calendar" | "upcoming" | "my-anime">("today");

  return (
    <main className="popup-shell">
      <header className="app-header">
        <span className="brand-mark" aria-hidden="true">B</span>
        <div>
          <h1>BiliAnime Helper</h1>
          <p>非官方哔哩哔哩追番助手</p>
        </div>
      </header>
      <nav className="tab-bar" role="tablist" aria-label="功能导航">
        <TabButton active={activeTab === "today"} label="今日" onClick={() => setActiveTab("today")} />
        <TabButton active={activeTab === "calendar"} label="七日历" onClick={() => setActiveTab("calendar")} />
        <TabButton active={activeTab === "upcoming"} label="新番" onClick={() => setActiveTab("upcoming")} />
        <TabButton active={activeTab === "my-anime"} label="我的追番" onClick={() => setActiveTab("my-anime")} />
      </nav>
      {activeTab === "my-anime" ? (
        <MyAnimeView animeService={animeService} repository={repository} />
      ) : activeTab === "upcoming" ? (
        <UpcomingAnimeView animeService={animeService} />
      ) : (
        <CalendarView
          animeService={animeService}
          mode={activeTab}
          onOpenMyAnime={() => setActiveTab("my-anime")}
          repository={repository}
        />
      )}
      <footer>排期来自 AniList · 中文标题来自 Bangumi · 点击标题前往哔哩哔哩搜索</footer>
    </main>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick}>{label}</button>;
}

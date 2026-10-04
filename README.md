# BiliAnime Helper

BiliAnime Helper is an unofficial Chrome/Edge Manifest V3 extension for Bilibili anime viewers. The v0.1 project is being built incrementally from the development plan in `BiliAnime_Helper_PROJECT_PLAN.md`.

## Current status

M8 is complete. The popup is a responsive, keyboard-accessible anime dashboard with Bilibili-aware light/dark appearance controls, local notification and badge settings, manual data refresh and cache cleanup, a Chinese Today view, a vertical seven-day timeline, a current-season upcoming-anime schedule, AniList Global Trending Top 20 with a Top 3 dashboard preview, sequel-aware scheduling, Chinese title search, manual following, and video rotation. Reliability coverage includes API outages, corrupted storage, missing fields, service-worker restarts, duplicate events, concurrent cache requests, and local write races.

## Development

Requires Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

To load a production build, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `.output/chrome-mv3`.

## Architecture

- `entrypoints/popup`: React popup UI
- `entrypoints/background.ts`: Manifest V3 service worker
- `entrypoints/bilibili.content.ts`: lightweight Bilibili theme detection on site pages and video rotation on playback pages
- `features/rotation`: isolated video detection, rotation lifecycle, and pure fit calculations
- `domain`: normalized app types that do not expose AniList response objects
- `services/anime`: provider abstraction, cached service, AniList schedules, and Bangumi Chinese-title enrichment
- `storage`: schema migrations and the `chrome.storage.local` adapter
- `utils/cache.ts`: persistent TTL cache used by anime data services
- `features/following`: My Anime state and manual follow UI
- `services/bilibili`: centralized title selection, URL generation, and tab opening
- `services/notifications`: persistent due-event processing, alarm scheduling, notification deduplication, and badge state
- `features/calendar`: local-time grouping, cached schedule loading, Today, and Next Up UI
- `features/upcoming`: paginated current-season schedule for all upcoming anime in the next seven days
- `features/trending`: AniList Top 20, dashboard Top 3 preview, metadata formatting, and cached outage states
- `features/dashboard`: popup navigation model and keyboard tab behavior
- `features/settings` and `services/settings`: local preferences, refresh, cache cleanup, and background synchronization
- `features/theme` and `services/theme`: Bilibili theme inference, system fallback, and active-tab theme resolution

The extension requests only `storage`, `alarms`, and `notifications`, plus AniList and Bangumi API host access. On Bilibili pages, it reads only visual theme signals (including the `theme_style` value when present) and returns the resolved light/dark value to the popup; it does not collect account data or transmit cookie contents.

## Privacy

Followed anime and preferences are stored locally in `chrome.storage.local`. Airing metadata is fetched from AniList and Chinese titles are enriched from Bangumi. Anime links open Bilibili search pages. BiliAnime Helper is not affiliated with Bilibili, AniList, or Bangumi.

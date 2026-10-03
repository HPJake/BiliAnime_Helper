# BiliAnime Helper

BiliAnime Helper is an unofficial Chrome/Edge Manifest V3 extension for Bilibili anime viewers. The v0.1 project is being built incrementally from the development plan in `BiliAnime_Helper_PROJECT_PLAN.md`.

## Current status

M1 is complete. The extension includes the project scaffold and a Bilibili-only video rotation controller. Repeated 90° actions cycle through 0°, 90°, 180°, and 270°. The controller is anchored above the player's top-right corner and hides in fullscreen.

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
- `entrypoints/bilibili.content.ts`: content script limited to Bilibili video pages
- `features/rotation`: isolated video detection, rotation lifecycle, and pure fit calculations
- `domain`, `storage`, `services`, `features`, `components`: reserved boundaries for later milestones

The extension requests only `storage`, `alarms`, and `notifications`, plus AniList GraphQL host access. It does not read Bilibili cookies or user account data.

## Privacy

Followed anime and preferences will be stored locally in `chrome.storage.local`. Anime metadata will be fetched from AniList. Anime links will open Bilibili search pages. BiliAnime Helper is not affiliated with Bilibili or AniList.

import { defineConfig } from "wxt";
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "BiliAnime Helper",
    description: "An unofficial anime dashboard and video rotation helper for Bilibili.",
    permissions: ["storage", "alarms", "notifications"],
    host_permissions: ["https://graphql.anilist.co/*"],
    action: {
      default_title: "BiliAnime Helper",
      default_popup: "popup.html"
    },
    icons: {
      16: "icon-16.svg",
      32: "icon-32.svg",
      48: "icon-48.svg",
      128: "icon-128.svg"
    }
  }
});

import { defineConfig } from "wxt";
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "BiliAnime Helper",
    description: "非官方哔哩哔哩追番日历与视频旋转助手。",
    permissions: ["storage", "alarms", "notifications"],
    host_permissions: ["https://graphql.anilist.co/*", "https://api.bgm.tv/*"],
    action: {
      default_icon: {16: "icon-16.png", 32: "icon-32.png", 48: "icon-48.png", 128: "icon-128.png"},
      default_title: "BiliAnime Helper",
      default_popup: "popup.html"
    },
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png"
    },
    web_accessible_resources: [{
      resources: ["popup.html", "icon-48.png"],
      matches: ["*://*.bilibili.com/*"]
    }]
  }
});

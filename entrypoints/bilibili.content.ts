import { defineContentScript } from "wxt/utils/define-content-script";
import { VideoRotationFeature } from "../features/rotation/videoRotation";

export default defineContentScript({
  matches: ["*://www.bilibili.com/video/*", "*://www.bilibili.com/bangumi/play/*"],
  runAt: "document_idle",
  main(ctx) {
    const rotationFeature = new VideoRotationFeature();
    rotationFeature.start();
    ctx.onInvalidated(() => rotationFeature.stop());
  }
});

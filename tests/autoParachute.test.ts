import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoParachute } from "../features/parachute/AutoParachute";
import { chooseOpeningMarker, episodeKey, loadOpeningMarker } from "../features/parachute/markers";

const storage = vi.hoisted(() => ({
  local: { get: vi.fn(), set: vi.fn() },
  onChanged: { addListener: vi.fn(), removeListener: vi.fn() }
}));
vi.mock("wxt/browser", () => ({ browser: { storage } }));
vi.mock("../features/parachute/markers", async (original) => ({
  ...await original<typeof import("../features/parachute/markers")>(),
  loadOpeningMarker: vi.fn()
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("自动跳伞", () => {
  it("selects the common destination from the P2 comments and preserves the cold open", () => {
    expect(episodeKey(new URL("https://www.bilibili.com/video/BV1dfzSBYEWX/?p=2")))
      .toBe("BV1dfzSBYEWX/2");
    expect(chooseOpeningMarker([
      { time: 59.223, text: "跳伞02:25" }, { time: 57.594, text: "跳伞02：25" },
      { time: 60.505, text: "跳伞02：25" }, { time: 64.852, text: "跳伞2:27" },
      { time: 152.505, text: "感谢跳伞君" }
    ])).toEqual({ start: 57.594, target: 145 });
    expect(chooseOpeningMarker([{ time: 120, text: "跳伞1:30" }])).toBeNull();
  });

  it("remembers opt-in across parts, disables missing markers and permits a replay", async () => {
    vi.stubGlobal("document", { createElement: () => ({ setAttribute: vi.fn() }) });
    vi.stubGlobal("window", new EventTarget());
    const location = new URL("https://www.bilibili.com/video/BV1dfzSBYEWX/?p=2");
    vi.stubGlobal("location", location);
    storage.local.get.mockResolvedValue({});
    storage.local.set.mockImplementation(async (items) => {
      storage.onChanged.addListener.mock.calls[0][0]({
        autoParachuteEnabled: { newValue: items.autoParachuteEnabled }
      }, "local");
    });
    vi.mocked(loadOpeningMarker).mockResolvedValueOnce({ start: 58, target: 145 })
      .mockResolvedValueOnce(null).mockResolvedValueOnce({ start: 70, target: 160 });
    const video = Object.assign(new EventTarget(), {
      readyState: 4, duration: 1759, currentTime: 65, paused: false, seeking: false
    });
    const control = new AutoParachute();
    control.start();
    control.attach(video as unknown as HTMLVideoElement);
    expect(control.button.disabled).toBe(true);
    await vi.waitFor(() => expect(control.button.disabled).toBe(false));
    expect(video.currentTime).toBe(65);
    control.button.onclick?.call(control.button, {} as PointerEvent);
    expect(video.currentTime).toBe(145);
    video.currentTime = 60;
    video.dispatchEvent(new Event("timeupdate"));
    expect(video.currentTime).toBe(60);
    location.search = "?p=3";
    control.update();
    await vi.waitFor(() => expect(control.button.title).toContain("没有找到"));
    expect(control.button.disabled).toBe(true);
    location.search = "?p=4";
    control.update();
    await vi.waitFor(() => expect(control.button.disabled).toBe(false));
    expect(video.currentTime).toBe(60);
    video.currentTime = 71;
    video.dispatchEvent(new Event("timeupdate"));
    expect(video.currentTime).toBe(160);
    control.stop();
  });
});

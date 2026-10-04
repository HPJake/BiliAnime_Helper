import { describe, expect, it } from "vitest";
import {
  inferBilibiliTheme,
  resolveThemePreference
} from "../features/theme/theme";

describe("theme resolution", () => {
  it("lets an explicit user preference override Bilibili and the system", () => {
    expect(resolveThemePreference("light", "dark", "dark")).toBe("light");
    expect(resolveThemePreference("dark", "light", "light")).toBe("dark");
  });

  it("follows Bilibili first and the operating system as a fallback", () => {
    expect(resolveThemePreference("auto", "dark", "light")).toBe("dark");
    expect(resolveThemePreference("auto", null, "dark")).toBe("dark");
  });

  it("recognizes Bilibili theme signals in priority order", () => {
    expect(inferBilibiliTheme({
      cookieTheme: "dark",
      tokens: ["light"],
      backgroundColor: "rgb(255, 255, 255)"
    })).toBe("dark");
    expect(inferBilibiliTheme({ tokens: ["bili-theme-dark"] })).toBe("dark");
    expect(inferBilibiliTheme({ tokens: [], backgroundColor: "rgb(246, 247, 248)" })).toBe("light");
    expect(inferBilibiliTheme({ tokens: [], backgroundColor: "rgb(24, 25, 28)" })).toBe("dark");
  });
});

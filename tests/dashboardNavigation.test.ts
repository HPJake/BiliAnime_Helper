import { describe, expect, it } from "vitest";
import { getKeyboardTab } from "../features/dashboard/navigation";

describe("dashboard tab keyboard navigation", () => {
  it("moves across tabs and wraps at both ends", () => {
    expect(getKeyboardTab("today", "ArrowRight")).toBe("calendar");
    expect(getKeyboardTab("today", "ArrowLeft")).toBe("discover");
    expect(getKeyboardTab("discover", "ArrowRight")).toBe("today");
  });

  it("supports Home and End without handling unrelated keys", () => {
    expect(getKeyboardTab("trending", "Home")).toBe("today");
    expect(getKeyboardTab("calendar", "End")).toBe("discover");
    expect(getKeyboardTab("today", "Enter")).toBeNull();
  });
});

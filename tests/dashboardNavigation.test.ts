import { describe, expect, it } from "vitest";
import { getKeyboardTab } from "../features/dashboard/navigation";

describe("dashboard tab keyboard navigation", () => {
  it("moves across tabs and wraps at both ends", () => {
    expect(getKeyboardTab("today", "ArrowRight")).toBe("calendar");
    expect(getKeyboardTab("today", "ArrowLeft")).toBe("random");
    expect(getKeyboardTab("random", "ArrowRight")).toBe("today");
  });

  it("supports Home and End without handling unrelated keys", () => {
    expect(getKeyboardTab("trending", "Home")).toBe("today");
    expect(getKeyboardTab("calendar", "End")).toBe("random");
    expect(getKeyboardTab("today", "Enter")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  calculateRotationScale,
  createRotationTransform
} from "../features/rotation/rotationMath";

describe("calculateRotationScale", () => {
  it("fits a rotated landscape video inside its original landscape area", () => {
    expect(
      calculateRotationScale(90, { width: 1600, height: 900 }, { width: 1600, height: 900 })
    ).toBeCloseTo(0.5625);
  });

  it("uses the tightest container dimension", () => {
    expect(
      calculateRotationScale(90, { width: 1280, height: 720 }, { width: 1000, height: 700 })
    ).toBeCloseTo(0.546875);
  });

  it("can enlarge a portrait layout while keeping it contained", () => {
    expect(
      calculateRotationScale(90, { width: 600, height: 1000 }, { width: 1200, height: 800 })
    ).toBeCloseTo(1.2);
  });

  it("keeps reset and 180-degree rotations at their original scale", () => {
    expect(calculateRotationScale(0, { width: 10, height: 20 }, { width: 30, height: 40 })).toBe(1);
    expect(calculateRotationScale(180, { width: 10, height: 20 }, { width: 30, height: 40 })).toBe(1);
  });

  it("fits 270 degrees using the same swapped dimensions as 90 degrees", () => {
    expect(
      calculateRotationScale(270, { width: 1600, height: 900 }, { width: 1600, height: 900 })
    ).toBeCloseTo(0.5625);
  });

  it("falls back safely for unavailable dimensions", () => {
    expect(calculateRotationScale(90, { width: 0, height: 0 }, { width: 0, height: 0 })).toBe(1);
  });
});

describe("createRotationTransform", () => {
  it("builds transforms for each supported state", () => {
    expect(createRotationTransform(0, 1)).toBe("");
    expect(createRotationTransform(90, 0.5)).toBe("rotate(90deg) scale(0.5)");
    expect(createRotationTransform(180, 1)).toBe("rotate(180deg)");
    expect(createRotationTransform(270, 0.5)).toBe("rotate(270deg) scale(0.5)");
  });
});

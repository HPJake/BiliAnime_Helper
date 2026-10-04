import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISCOVERY_FILTERS,
  getDiscoveryYearRange,
  serializeDiscoveryFilters
} from "../domain/discovery";
import { toggleDiscoveryGenre } from "../features/discovery/discovery";

describe("anime discovery filters", () => {
  it("maps eras to bounded year ranges", () => {
    expect(getDiscoveryYearRange("ALL", 2026)).toEqual({ from: 1960, to: 2027 });
    expect(getDiscoveryYearRange("2020S", 2026)).toEqual({ from: 2020, to: 2027 });
    expect(getDiscoveryYearRange("2010S", 2026)).toEqual({ from: 2010, to: 2019 });
    expect(getDiscoveryYearRange("CLASSIC", 2026)).toEqual({ from: 1960, to: 1999 });
  });

  it("serializes genre selections independently of click order", () => {
    const left = { ...DEFAULT_DISCOVERY_FILTERS, genres: ["Fantasy", "Adventure"] };
    const right = { ...DEFAULT_DISCOVERY_FILTERS, genres: ["Adventure", "Fantasy"] };
    expect(serializeDiscoveryFilters(left)).toBe(serializeDiscoveryFilters(right));
  });

  it("limits genre combinations to two and toggles selected values", () => {
    const one = toggleDiscoveryGenre(DEFAULT_DISCOVERY_FILTERS, "Fantasy");
    const two = toggleDiscoveryGenre(one, "Adventure");
    expect(toggleDiscoveryGenre(two, "Comedy")).toBe(two);
    expect(toggleDiscoveryGenre(two, "Fantasy").genres).toEqual(["Adventure"]);
  });
});

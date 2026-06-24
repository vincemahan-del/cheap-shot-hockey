import { describe, it, expect } from "vitest";
import { formatPrice, categoryLabel, categoryColor } from "./format";

describe("formatPrice", () => {
  it("formats whole dollars without rounding", () => {
    expect(formatPrice(10000)).toBe("$100.00");
  });

  it("formats sub-dollar amounts with the leading zero", () => {
    expect(formatPrice(99)).toBe("$0.99");
  });

  it("zeros format cleanly", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("keeps two decimals on uneven cents", () => {
    expect(formatPrice(19999)).toBe("$199.99");
    expect(formatPrice(12305)).toBe("$123.05");
  });

  it("groups thousands with a comma separator", () => {
    expect(formatPrice(100000)).toBe("$1,000.00");
    expect(formatPrice(140398)).toBe("$1,403.98");
    expect(formatPrice(1234567)).toBe("$12,345.67");
  });

  it("defaults to the US region (USD) when none is given", () => {
    expect(formatPrice(19999)).toBe(formatPrice(19999, "us"));
  });

  it("converts and labels CAD with the disambiguating CA$ symbol", () => {
    // 19999 USD base × 1.35 FX = 26999 → CA$269.99
    expect(formatPrice(19999, "ca")).toBe("CA$269.99");
    expect(formatPrice(10000, "ca")).toBe("CA$135.00");
  });
});

describe("categoryLabel", () => {
  it.each([
    ["sticks", "Sticks"],
    ["skates", "Skates"],
    ["helmets", "Helmets"],
    ["gloves", "Gloves"],
    ["pads", "Pads"],
    ["jerseys", "Jerseys"],
    ["pucks", "Pucks"],
    ["goalie-gear", "Goalie Gear"],
    ["accessories", "Accessories"],
  ])("%s → %s", (category, expected) => {
    expect(categoryLabel(category)).toBe(expected);
  });

  it("passes through unknown categories unchanged (safe fallback)", () => {
    expect(categoryLabel("mystery")).toBe("mystery");
  });
});

describe("categoryColor", () => {
  it("returns a stable hex for each known category", () => {
    const known = [
      "sticks",
      "skates",
      "helmets",
      "gloves",
      "pads",
      "jerseys",
      "pucks",
      "goalie-gear",
      "accessories",
    ];
    for (const c of known) {
      expect(categoryColor(c)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("returns a fallback for unknowns", () => {
    expect(categoryColor("not-a-category")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

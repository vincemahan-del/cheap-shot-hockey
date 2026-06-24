import { describe, it, expect } from "vitest";
import {
  parseRegion,
  readRegion,
  regionConfig,
  normalizeProvince,
  taxRate,
  convertToRegionCents,
  shippingConfig,
  shippingForSubtotal,
  REGION_HEADER,
  DEFAULT_REGION,
} from "./region";

describe("parseRegion", () => {
  it("recognizes ca case-insensitively and trims", () => {
    expect(parseRegion("ca")).toBe("ca");
    expect(parseRegion("CA")).toBe("ca");
    expect(parseRegion("  ca  ")).toBe("ca");
  });

  it("defaults to us for anything else", () => {
    expect(parseRegion("us")).toBe("us");
    expect(parseRegion("uk")).toBe("us");
    expect(parseRegion("")).toBe("us");
    expect(parseRegion(null)).toBe("us");
    expect(parseRegion(undefined)).toBe("us");
  });
});

describe("readRegion", () => {
  it("reads the region header set by middleware", () => {
    const h = new Headers();
    h.set(REGION_HEADER, "ca");
    expect(readRegion(h)).toBe("ca");
  });

  it("defaults to us when the header is absent", () => {
    expect(readRegion(new Headers())).toBe("us");
    expect(DEFAULT_REGION).toBe("us");
  });
});

describe("regionConfig", () => {
  it("returns currency + locale per region", () => {
    expect(regionConfig("us").currency).toBe("USD");
    expect(regionConfig("ca").currency).toBe("CAD");
  });
});

describe("normalizeProvince", () => {
  it("uppercases and trims; coerces nullish to empty", () => {
    expect(normalizeProvince(" on ")).toBe("ON");
    expect(normalizeProvince("qc")).toBe("QC");
    expect(normalizeProvince(null)).toBe("");
    expect(normalizeProvince(undefined)).toBe("");
  });
});

describe("taxRate", () => {
  it("is a flat 8% for the US regardless of state", () => {
    expect(taxRate("us")).toBe(0.08);
    expect(taxRate("us", "CA")).toBe(0.08); // "CA" here is California, not Canada
  });

  it("varies by Canadian province", () => {
    expect(taxRate("ca", "ON")).toBeCloseTo(0.13);
    expect(taxRate("ca", "QC")).toBeCloseTo(0.14975);
    expect(taxRate("ca", "AB")).toBeCloseTo(0.05);
    expect(taxRate("ca", "bc")).toBeCloseTo(0.12);
  });

  it("falls back to the default province for unknown/blank provinces", () => {
    expect(taxRate("ca", "ZZ")).toBeCloseTo(0.13); // ON default
    expect(taxRate("ca")).toBeCloseTo(0.13);
    expect(taxRate("ca", "")).toBeCloseTo(0.13);
  });
});

describe("convertToRegionCents", () => {
  it("is the identity for the US", () => {
    expect(convertToRegionCents(19999, "us")).toBe(19999);
  });

  it("applies the FX multiplier (rounded) for Canada", () => {
    expect(convertToRegionCents(10000, "ca")).toBe(13500); // 1.35x
    expect(convertToRegionCents(19999, "ca")).toBe(26999); // round(26998.65)
  });

  it("coerces non-finite input to 0", () => {
    expect(convertToRegionCents(NaN, "ca")).toBe(0);
    expect(convertToRegionCents(Infinity, "us")).toBe(0);
  });
});

describe("shippingConfig", () => {
  it("exposes the region threshold + flat cost (USD base cents)", () => {
    expect(shippingConfig("us")).toEqual({
      freeShipThresholdCents: 9900,
      shippingCents: 999,
    });
    expect(shippingConfig("ca")).toEqual({
      freeShipThresholdCents: 12900,
      shippingCents: 1499,
    });
  });
});

describe("shippingForSubtotal", () => {
  it("is free for an empty cart", () => {
    expect(shippingForSubtotal("us", 0)).toBe(0);
    expect(shippingForSubtotal("ca", 0)).toBe(0);
  });

  it("charges the flat rate below the threshold", () => {
    expect(shippingForSubtotal("us", 5000)).toBe(999);
    expect(shippingForSubtotal("ca", 5000)).toBe(1499);
  });

  it("is free once the region threshold is met", () => {
    expect(shippingForSubtotal("us", 9900)).toBe(0);
    expect(shippingForSubtotal("ca", 9900)).toBe(1499); // below CA's higher threshold
    expect(shippingForSubtotal("ca", 12900)).toBe(0);
  });
});

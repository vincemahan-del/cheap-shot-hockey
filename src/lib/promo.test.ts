import { describe, expect, it } from "vitest";
import {
  evaluatePromo,
  findPromo,
  normalizePromoCode,
  priceOrder,
  promoRejectionMessage,
  type PromoResult,
} from "./promo";

const BEFORE_EXPIRY = new Date("2026-06-01T00:00:00Z");
const AFTER_EXPIRY = new Date("2026-07-01T00:00:00Z");

function rejected(result: PromoResult) {
  if (result.ok) throw new Error("expected rejection");
  return result;
}

describe("normalizePromoCode", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizePromoCode("  hat trick ")).toBe("HATTRICK");
  });

  it("returns empty for non-strings", () => {
    expect(normalizePromoCode(undefined)).toBe("");
    expect(normalizePromoCode(42)).toBe("");
  });

  it("caps length at 32 characters", () => {
    expect(normalizePromoCode("x".repeat(50))).toHaveLength(32);
  });
});

describe("findPromo", () => {
  it("is case-insensitive", () => {
    expect(findPromo("bardown")?.code).toBe("BARDOWN");
  });

  it("returns undefined for unknown codes", () => {
    expect(findPromo("NOPE")).toBeUndefined();
  });
});

describe("evaluatePromo", () => {
  const us = { subtotalCents: 19999, region: "us" as const };

  it("applies a percent discount rounded to the cent", () => {
    const result = evaluatePromo("hattrick", us);
    expect(result).toMatchObject({ ok: true, discountCents: 3000, freeShipping: false });
  });

  it("applies a fixed amount once the minimum is met", () => {
    expect(evaluatePromo("BARDOWN", { subtotalCents: 15000, region: "us" })).toMatchObject({
      ok: true,
      discountCents: 2000,
    });
  });

  it("rejects a fixed amount below the minimum and reports it", () => {
    expect(evaluatePromo("BARDOWN", { subtotalCents: 14999, region: "us" })).toEqual({
      ok: false,
      code: "BARDOWN",
      reason: "min_subtotal",
      minSubtotalCents: 15000,
    });
  });

  it("marks free shipping without a merchandise discount", () => {
    expect(evaluatePromo("FREESHIP", us)).toMatchObject({
      ok: true,
      discountCents: 0,
      freeShipping: true,
    });
  });

  it("enforces region restrictions", () => {
    expect(rejected(evaluatePromo("EH10", us)).reason).toBe("region");
    expect(evaluatePromo("EH10", { subtotalCents: 10000, region: "ca" })).toMatchObject({
      ok: true,
      discountCents: 1000,
    });
  });

  it("honors expiry relative to now", () => {
    expect(evaluatePromo("PLAYOFFS25", { ...us, now: BEFORE_EXPIRY })).toMatchObject({ ok: true });
    expect(rejected(evaluatePromo("PLAYOFFS25", { ...us, now: AFTER_EXPIRY })).reason).toBe(
      "expired",
    );
  });

  it("defaults now to the current time", () => {
    expect(rejected(evaluatePromo("PLAYOFFS25", us)).reason).toBe("expired");
  });

  it("rejects empty and unknown codes", () => {
    expect(rejected(evaluatePromo("   ", us)).reason).toBe("empty");
    expect(rejected(evaluatePromo("SLAPSHOT", us))).toEqual({
      ok: false,
      code: "SLAPSHOT",
      reason: "unknown",
    });
  });

  it("treats non-finite or negative subtotals as zero", () => {
    expect(evaluatePromo("HATTRICK", { subtotalCents: Number.NaN, region: "us" })).toMatchObject({
      ok: true,
      discountCents: 0,
    });
    expect(evaluatePromo("HATTRICK", { subtotalCents: -500, region: "us" })).toMatchObject({
      discountCents: 0,
    });
  });
});

describe("promoRejectionMessage", () => {
  it.each([
    ["", "promo code is required"],
    ["SLAPSHOT", "promo code SLAPSHOT is not valid"],
    ["PLAYOFFS25", "promo code PLAYOFFS25 has expired"],
    ["EH10", "promo code EH10 is not available in this region"],
  ])("explains %s", (code, message) => {
    const result = rejected(evaluatePromo(code, { subtotalCents: 1000, region: "us" }));
    expect(promoRejectionMessage(result, "us")).toBe(message);
  });

  it("formats the minimum in the region's currency", () => {
    const result = rejected(evaluatePromo("BARDOWN", { subtotalCents: 1000, region: "ca" }));
    expect(promoRejectionMessage(result, "ca")).toBe(
      "promo code BARDOWN requires a subtotal of at least CA$202.50",
    );
  });

  it("falls back to zero when the minimum is missing", () => {
    expect(
      promoRejectionMessage({ ok: false, code: "X", reason: "min_subtotal" }, "us"),
    ).toBe("promo code X requires a subtotal of at least $0.00");
  });
});

describe("priceOrder", () => {
  it("matches the pre-promo math when no promo is applied", () => {
    // Same totals the newman T1 smoke asserts: $199.99 subtotal, 8% tax, free shipping.
    expect(priceOrder({ subtotalCents: 19999, region: "us" })).toEqual({
      subtotalCents: 19999,
      discountCents: 0,
      taxCents: 1600,
      shippingCents: 0,
      totalCents: 21599,
      promoCode: null,
    });
  });

  it("taxes the discounted subtotal", () => {
    const promo = evaluatePromo("HATTRICK", { subtotalCents: 19999, region: "us" });
    expect(priceOrder({ subtotalCents: 19999, region: "us", promo })).toEqual({
      subtotalCents: 19999,
      discountCents: 3000,
      taxCents: 1360,
      shippingCents: 0,
      totalCents: 18359,
      promoCode: "HATTRICK",
    });
  });

  it("keeps free shipping based on the pre-discount subtotal", () => {
    const promo = evaluatePromo("HATTRICK", { subtotalCents: 10000, region: "us" });
    expect(priceOrder({ subtotalCents: 10000, region: "us", promo }).shippingCents).toBe(0);
  });

  it("waives shipping for free-shipping codes", () => {
    const promo = evaluatePromo("FREESHIP", { subtotalCents: 5000, region: "us" });
    expect(priceOrder({ subtotalCents: 5000, region: "us", promo })).toMatchObject({
      shippingCents: 0,
      totalCents: 5400,
      promoCode: "FREESHIP",
    });
  });

  it("uses the province rate for Canada", () => {
    const promo = evaluatePromo("EH10", { subtotalCents: 10000, region: "ca" });
    expect(priceOrder({ subtotalCents: 10000, region: "ca", province: "QC", promo })).toEqual({
      subtotalCents: 10000,
      discountCents: 1000,
      taxCents: 1348,
      shippingCents: 1499,
      totalCents: 11847,
      promoCode: "EH10",
    });
  });

  it("ignores a rejected promo", () => {
    const promo = evaluatePromo("SLAPSHOT", { subtotalCents: 5000, region: "us" });
    expect(priceOrder({ subtotalCents: 5000, region: "us", promo })).toMatchObject({
      discountCents: 0,
      shippingCents: 999,
      totalCents: 6399,
      promoCode: null,
    });
  });
});

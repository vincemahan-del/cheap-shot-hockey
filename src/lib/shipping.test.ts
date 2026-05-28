import { describe, expect, it } from "vitest";
import {
  FREE_SHIP_THRESHOLD_CENTS,
  freeShippingProgress,
} from "./shipping";

describe("freeShippingProgress", () => {
  it("returns 0% / full remaining / not qualified at $0", () => {
    expect(freeShippingProgress(0)).toEqual({
      qualified: false,
      remainingCents: 9900,
      progressPercent: 0,
    });
  });

  it("returns ~100% / $0.01 remaining / not qualified at $98.99 (Math.round behavior)", () => {
    // $98.99 -> 9899 / 9900 = 0.99989... -> Math.round -> 100, but still not qualified.
    expect(freeShippingProgress(9899)).toEqual({
      qualified: false,
      remainingCents: 1,
      progressPercent: 100,
    });
  });

  it("returns not-qualified $1 below the threshold", () => {
    // $98 -> 9800 / 9900 = 0.9898... -> Math.round -> 99.
    expect(freeShippingProgress(9800)).toEqual({
      qualified: false,
      remainingCents: 100,
      progressPercent: 99,
    });
  });

  it("returns 100% / 0 remaining / qualified exactly at the threshold", () => {
    expect(freeShippingProgress(9900)).toEqual({
      qualified: true,
      remainingCents: 0,
      progressPercent: 100,
    });
  });

  it("returns 100% / 0 remaining / qualified well over the threshold", () => {
    expect(freeShippingProgress(25000)).toEqual({
      qualified: true,
      remainingCents: 0,
      progressPercent: 100,
    });
  });

  it("treats negative subtotal as zero", () => {
    expect(freeShippingProgress(-500)).toEqual({
      qualified: false,
      remainingCents: 9900,
      progressPercent: 0,
    });
  });

  it("treats NaN subtotal as zero", () => {
    expect(freeShippingProgress(Number.NaN)).toEqual({
      qualified: false,
      remainingCents: 9900,
      progressPercent: 0,
    });
  });

  it("treats non-finite subtotal as zero", () => {
    expect(freeShippingProgress(Number.POSITIVE_INFINITY)).toEqual({
      qualified: false,
      remainingCents: 9900,
      progressPercent: 0,
    });
  });

  it("accepts a custom threshold", () => {
    expect(freeShippingProgress(2500, 5000)).toEqual({
      qualified: false,
      remainingCents: 2500,
      progressPercent: 50,
    });
    expect(freeShippingProgress(5000, 5000)).toEqual({
      qualified: true,
      remainingCents: 0,
      progressPercent: 100,
    });
  });

  it("falls back to the default threshold when given a non-positive threshold", () => {
    expect(freeShippingProgress(0, 0)).toEqual({
      qualified: false,
      remainingCents: 9900,
      progressPercent: 0,
    });
    expect(freeShippingProgress(0, Number.NaN)).toEqual({
      qualified: false,
      remainingCents: 9900,
      progressPercent: 0,
    });
  });

  it("exports the canonical threshold constant", () => {
    expect(FREE_SHIP_THRESHOLD_CENTS).toBe(9900);
  });
});

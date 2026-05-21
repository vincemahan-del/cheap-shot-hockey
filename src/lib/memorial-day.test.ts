import { describe, it, expect } from "vitest";
import {
  isMemorialDayCampaignActive,
  shouldShowMemorialDayBanner,
  MEMORIAL_DAY_DISMISS_KEY,
} from "./memorial-day";

describe("isMemorialDayCampaignActive", () => {
  it("is false the day before the banner window opens", () => {
    expect(isMemorialDayCampaignActive(new Date("2026-05-20T23:00:00Z"))).toBe(
      false,
    );
  });

  it("is true at the banner-window start boundary (May 21 — teaser)", () => {
    expect(isMemorialDayCampaignActive(new Date("2026-05-21T00:00:00Z"))).toBe(
      true,
    );
  });

  it("is true on the actual sale start day (May 23)", () => {
    expect(isMemorialDayCampaignActive(new Date("2026-05-23T00:00:00Z"))).toBe(
      true,
    );
  });

  it("is true mid-campaign on Memorial Day proper", () => {
    expect(isMemorialDayCampaignActive(new Date("2026-05-25T12:00:00Z"))).toBe(
      true,
    );
  });

  it("is true at the closing-second boundary", () => {
    expect(isMemorialDayCampaignActive(new Date("2026-05-25T23:59:59Z"))).toBe(
      true,
    );
  });

  it("is false once the campaign window closes", () => {
    expect(isMemorialDayCampaignActive(new Date("2026-05-26T00:00:00Z"))).toBe(
      false,
    );
  });

  it("is false a year later — campaign is scoped to 2026", () => {
    expect(isMemorialDayCampaignActive(new Date("2027-05-24T12:00:00Z"))).toBe(
      false,
    );
  });
});

describe("MEMORIAL_DAY_DISMISS_KEY", () => {
  it("is namespaced by year so a fresh dismiss flag is needed next campaign", () => {
    expect(MEMORIAL_DAY_DISMISS_KEY).toContain("2026");
  });
});

describe("shouldShowMemorialDayBanner", () => {
  const inWindow = new Date("2026-05-24T12:00:00Z");
  const outOfWindow = new Date("2026-06-01T12:00:00Z");

  it("shows when in window and not dismissed", () => {
    expect(shouldShowMemorialDayBanner(inWindow, false)).toBe(true);
  });

  it("hides when dismissed, even in window", () => {
    expect(shouldShowMemorialDayBanner(inWindow, true)).toBe(false);
  });

  it("hides when out of window, even if not dismissed", () => {
    expect(shouldShowMemorialDayBanner(outOfWindow, false)).toBe(false);
  });

  it("hides when out of window and dismissed (defense in depth)", () => {
    expect(shouldShowMemorialDayBanner(outOfWindow, true)).toBe(false);
  });
});

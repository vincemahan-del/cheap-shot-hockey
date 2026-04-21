import { describe, it, expect } from "vitest";
import { brandColor, brandAccent } from "./brand";

describe("brandColor", () => {
  it("is case-insensitive on brand names", () => {
    expect(brandColor("Apex")).toBe(brandColor("apex"));
    expect(brandColor("APEX")).toBe(brandColor("apex"));
  });

  it("returns a valid hex for every known brand", () => {
    for (const name of [
      "Apex",
      "Ironline",
      "Glacier",
      "Coldfire",
      "Northbound",
      "Saberline",
      "Strongside",
      "Crease Guardian",
      "Cheap Shot",
    ]) {
      expect(brandColor(name)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("returns the default color for unknown brands", () => {
    expect(brandColor("Unknown Brand")).toBe("#9aa3b2");
  });
});

describe("brandAccent", () => {
  it("matches brandColor for demo purposes", () => {
    expect(brandAccent("Apex")).toBe(brandColor("Apex"));
  });
});

import { describe, it, expect } from "vitest";
import { formatPromo, getActivePromos } from "./promos";

describe("formatPromo", () => {
  it("substitutes known tokens", () => {
    expect(formatPromo("Free shipping on orders {amount}+", { amount: "$99" })).toBe(
      "Free shipping on orders $99+",
    );
  });

  it("leaves unknown tokens untouched", () => {
    expect(formatPromo("Save {pct}% on {thing}", { pct: "70" })).toBe("Save 70% on {thing}");
  });

  it("is a no-op without tokens or vars", () => {
    expect(formatPromo("30-day returns")).toBe("30-day returns");
  });
});

describe("getActivePromos", () => {
  it("returns every promo key for English in a stable order", () => {
    const promos = getActivePromos("en");
    expect(promos.map((p) => p.key)).toEqual(["freeShipping", "cupFinal", "returns"]);
    expect(promos.every((p) => p.text.length > 0)).toBe(true);
  });

  it("returns French copy for fr", () => {
    const fr = getActivePromos("fr");
    expect(fr).toHaveLength(3);
    expect(fr.find((p) => p.key === "returns")?.text).toMatch(/Retours/);
  });

  it("falls back to English for unknown or missing locales", () => {
    expect(getActivePromos("de")).toEqual(getActivePromos("en"));
    expect(getActivePromos(null)).toEqual(getActivePromos("en"));
    expect(getActivePromos(undefined)).toEqual(getActivePromos("en"));
  });

  it("applies vars to templated messages only", () => {
    const promos = getActivePromos("en", { amount: "$99" });
    expect(promos.find((p) => p.key === "freeShipping")?.text).toContain("$99+");
    expect(promos.find((p) => p.key === "returns")?.text).not.toContain("{");
  });
});

import { describe, it, expect } from "vitest";
import {
  parseLocale,
  readLocale,
  LOCALE_HEADER,
  DEFAULT_LOCALE,
  LOCALES,
} from "./locale";

describe("parseLocale", () => {
  it("recognizes fr case-insensitively and trims", () => {
    expect(parseLocale("fr")).toBe("fr");
    expect(parseLocale("FR")).toBe("fr");
    expect(parseLocale("  fr  ")).toBe("fr");
  });

  it("defaults to en for anything else", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("de")).toBe("en");
    expect(parseLocale("")).toBe("en");
    expect(parseLocale(null)).toBe("en");
    expect(parseLocale(undefined)).toBe("en");
  });
});

describe("readLocale", () => {
  it("reads the locale header set by middleware", () => {
    const h = new Headers();
    h.set(LOCALE_HEADER, "fr");
    expect(readLocale(h)).toBe("fr");
  });

  it("defaults to en when the header is absent", () => {
    expect(readLocale(new Headers())).toBe("en");
  });
});

describe("locale constants", () => {
  it("exposes en + fr with en as default", () => {
    expect(LOCALES).toEqual(["en", "fr"]);
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

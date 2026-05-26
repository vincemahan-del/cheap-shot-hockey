import { describe, it, expect } from "vitest";
import { isValidEmail } from "./email";

describe("isValidEmail", () => {
  it("accepts standard addresses", () => {
    expect(isValidEmail("coach@eagles.test")).toBe(true);
    expect(isValidEmail("a@b.co")).toBe(true);
  });

  it("accepts multi-label domains", () => {
    expect(isValidEmail("coach@team.sub.example.test")).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidEmail("  coach@eagles.test  ")).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
    expect(isValidEmail({})).toBe(false);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false); // no TLD
    expect(isValidEmail("a@.b")).toBe(false); // leading-dot domain
    expect(isValidEmail("a@b..c")).toBe(false); // empty label
    expect(isValidEmail("a b@c.d")).toBe(false); // space in local part
  });

  it("rejects over-length input (RFC 5321 254 cap)", () => {
    expect(isValidEmail(`${"a".repeat(250)}@example.test`)).toBe(false);
  });

  it("rejects a ReDoS payload in linear time", () => {
    const malicious = `a@${"a".repeat(50000)}`;
    const start = performance.now();
    const result = isValidEmail(malicious);
    const elapsedMs = performance.now() - start;
    expect(result).toBe(false);
    expect(elapsedMs).toBeLessThan(50);
  });
});

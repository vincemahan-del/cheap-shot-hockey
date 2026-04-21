import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, sign, verify } from "./auth-crypto";

describe("hashPassword / verifyPassword", () => {
  it("is deterministic for the same input", () => {
    expect(hashPassword("demo1234")).toBe(hashPassword("demo1234"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashPassword("a")).not.toBe(hashPassword("b"));
  });

  it("verifyPassword returns true for correct password", () => {
    const h = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", h)).toBe(true);
  });

  it("verifyPassword returns false for the wrong password", () => {
    const h = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong password", h)).toBe(false);
  });
});

describe("sign / verify", () => {
  it("round-trips a payload", () => {
    const signed = sign("user:u-001:1234567890");
    expect(verify(signed)).toBe("user:u-001:1234567890");
  });

  it("returns null for a tampered signature", () => {
    const signed = sign("user:u-001");
    // Tamper with the mac
    const tampered = signed.slice(0, -4) + "dead";
    expect(verify(tampered)).toBeNull();
  });

  it("returns null for a completely invalid token", () => {
    expect(verify("not-a-token")).toBeNull();
  });

  it("returns null for a token missing the separator", () => {
    expect(verify("nodotsjusttext")).toBeNull();
  });
});

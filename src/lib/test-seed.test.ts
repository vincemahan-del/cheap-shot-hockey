import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateTestUser,
  isSeedProtectedEmail,
  seedTokenConfigured,
  tokenMatches,
  DEFAULT_TEST_PASSWORD,
} from "./test-seed";

describe("generateTestUser", () => {
  it("builds a unique cheapshot.test email with the default prefix", () => {
    const u = generateTestUser({ uniqueSuffix: "abc123" });
    expect(u.email).toBe("csh-e2e-abc123@cheapshot.test");
    expect(u.password).toBe(DEFAULT_TEST_PASSWORD);
    expect(u.name).toBe("E2E User abc123");
    expect(u.role).toBe("customer");
  });

  it("produces distinct emails across calls (uniqueness per run)", () => {
    expect(generateTestUser().email).not.toBe(generateTestUser().email);
  });

  it("sanitizes a custom prefix to [a-z0-9-] and lowercases it", () => {
    const u = generateTestUser({ emailPrefix: "My Team!! 2026", uniqueSuffix: "x" });
    expect(u.email).toBe("myteam2026-x@cheapshot.test");
  });

  it("falls back to the default prefix when sanitizing empties it", () => {
    const u = generateTestUser({ emailPrefix: "!!!", uniqueSuffix: "x" });
    expect(u.email).toBe("csh-e2e-x@cheapshot.test");
  });

  it("accepts a custom password only when >= 8 chars", () => {
    expect(generateTestUser({ password: "longenough1" }).password).toBe("longenough1");
    expect(generateTestUser({ password: "short" }).password).toBe(DEFAULT_TEST_PASSWORD);
  });

  it("uses a trimmed custom name when provided", () => {
    expect(generateTestUser({ name: "  Coach Q  " }).name).toBe("Coach Q");
  });

  it("only promotes role to admin on an exact match", () => {
    expect(generateTestUser({ role: "admin" }).role).toBe("admin");
    expect(generateTestUser({ role: "customer" }).role).toBe("customer");
  });
});

describe("seed token guard", () => {
  const original = process.env.TEST_SEED_TOKEN;
  beforeEach(() => {
    delete process.env.TEST_SEED_TOKEN;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.TEST_SEED_TOKEN;
    else process.env.TEST_SEED_TOKEN = original;
  });

  it("reports unconfigured when TEST_SEED_TOKEN is unset", () => {
    expect(seedTokenConfigured()).toBe(false);
    expect(tokenMatches("anything")).toBe(false);
  });

  it("reports configured + matches the exact token", () => {
    process.env.TEST_SEED_TOKEN = "s3cr3t-token";
    expect(seedTokenConfigured()).toBe(true);
    expect(tokenMatches("s3cr3t-token")).toBe(true);
  });

  it("rejects a wrong token, null, and length mismatches", () => {
    process.env.TEST_SEED_TOKEN = "s3cr3t-token";
    expect(tokenMatches("wrong-token!")).toBe(false);
    expect(tokenMatches(null)).toBe(false);
    expect(tokenMatches("short")).toBe(false);
  });
});

describe("isSeedProtectedEmail", () => {
  it("protects the seeded demo and admin users, case-insensitively", () => {
    expect(isSeedProtectedEmail("demo@cheapshot.test")).toBe(true);
    expect(isSeedProtectedEmail("ADMIN@cheapshot.test")).toBe(true);
  });

  it("allows any other email", () => {
    expect(isSeedProtectedEmail("svc-roletest@cheapshot.test")).toBe(false);
    expect(isSeedProtectedEmail("")).toBe(false);
  });
});

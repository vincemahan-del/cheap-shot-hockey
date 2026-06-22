// Test-data seeding helpers (pure, unit-testable).
//
// Backs POST /api/test/seed-user — a token-guarded endpoint that mints a
// unique, ready-to-login user per call so mabl tests can exercise the login
// form with fresh credentials on every run. Keeping the generation + token
// logic here (no I/O, no next/server) lets the route stay a thin shell and
// keeps this covered by the unit suite.

import { randomUUID, timingSafeEqual } from "node:crypto";

export interface SeededTestUser {
  email: string;
  password: string;
  name: string;
  role: "customer" | "admin";
}

// Meets the register route's min-length rule (>= 8 chars) so a seeded user can
// also be created through the normal register flow if ever needed.
export const DEFAULT_TEST_PASSWORD = "Test1234!";

const TEST_EMAIL_DOMAIN = "cheapshot.test";

/** Lowercase, strip to [a-z0-9-], cap length. Empty/invalid → "". */
function sanitizePrefix(prefix?: string): string {
  if (!prefix) return "";
  return prefix.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
}

/**
 * Build a unique test user. `uniqueSuffix` is injectable so tests can assert
 * deterministic output; in production it defaults to a random UUID slice, which
 * is what makes each test run's user distinct.
 */
export function generateTestUser(opts?: {
  emailPrefix?: string;
  password?: string;
  name?: string;
  role?: "customer" | "admin";
  uniqueSuffix?: string;
}): SeededTestUser {
  const suffix = opts?.uniqueSuffix ?? randomUUID().slice(0, 8);
  const prefix = sanitizePrefix(opts?.emailPrefix) || "csh-e2e";
  const password =
    typeof opts?.password === "string" && opts.password.length >= 8
      ? opts.password
      : DEFAULT_TEST_PASSWORD;
  const name = opts?.name?.trim() || `E2E User ${suffix}`;
  return {
    email: `${prefix}-${suffix}@${TEST_EMAIL_DOMAIN}`,
    password,
    name,
    role: opts?.role === "admin" ? "admin" : "customer",
  };
}

/** True only when TEST_SEED_TOKEN is set — the endpoint is off otherwise. */
export function seedTokenConfigured(): boolean {
  return Boolean(process.env.TEST_SEED_TOKEN);
}

/** Constant-time compare of a provided token against TEST_SEED_TOKEN. */
export function tokenMatches(provided: string | null): boolean {
  const expected = process.env.TEST_SEED_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

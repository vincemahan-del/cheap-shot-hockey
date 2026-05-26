// Single ReDoS-safe email validator for the whole app.
//
// Domain labels use a dot-excluding class (`[^\s@.]`) so the literal `.`
// separators are unambiguous — no two adjacent unbounded quantifiers
// straddle the same character, which is what made the earlier
// /^[^\s@]+@[^\s@]+\.[^\s@]+$/ pattern polynomial (CodeQL
// js/polynomial-redos). The length cap bounds input before the regex
// runs, neutralizing backtracking regardless of regex shape.
//
// Consolidated from three inline copies (team-orders, auth/register,
// orders) — duplicating this validator is exactly what let the ReDoS
// pattern spread (TAMD-138 → TAMD-139).

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const MAX_EMAIL = 254; // RFC 5321 max total length

// Type predicate so callers narrow `unknown`/`string | undefined` to
// `string` after the guard (e.g. register/route.ts uses `email` as a
// string downstream).
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim();
  return email.length > 0 && email.length <= MAX_EMAIL && EMAIL_RE.test(email);
}

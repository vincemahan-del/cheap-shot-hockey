import type { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth-crypto";
import { createUser, getUserByEmail } from "@/lib/store";
import { badRequest, created, forbidden, notFound } from "@/lib/api";
import { generateTestUser, seedTokenConfigured, tokenMatches } from "@/lib/test-seed";

// POST /api/test/seed-user
//
// Test-only, token-guarded endpoint. Mints a UNIQUE user per call and persists
// it (Postgres when DATABASE_URL is configured — so the form login survives
// across Vercel Lambdas), then returns the plaintext credentials so a mabl test
// can immediately log in via the login form with fresh creds each run.
//
// Guard: disabled by default. With no TEST_SEED_TOKEN set the route 404s, so it
// is inert in real prod unless deliberately enabled for a test environment.
// When enabled, callers must send a matching `x-test-seed-token` header.
//
// Body (all optional): { emailPrefix, password, name, role: "customer"|"admin" }
export async function POST(req: NextRequest) {
  if (!seedTokenConfigured()) return notFound();
  if (!tokenMatches(req.headers.get("x-test-seed-token"))) {
    return forbidden("invalid or missing seed token");
  }

  let body: { emailPrefix?: string; password?: string; name?: string; role?: string } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return badRequest("invalid JSON body");
  }

  const seed = generateTestUser({
    emailPrefix: body.emailPrefix,
    password: body.password,
    name: body.name,
    role: body.role === "admin" ? "admin" : "customer",
  });

  // Vanishingly unlikely with a UUID suffix, but fail loud rather than collide.
  if (await getUserByEmail(seed.email)) {
    return badRequest("generated email collided; retry");
  }

  const user = await createUser({
    email: seed.email,
    passwordHash: hashPassword(seed.password),
    name: seed.name,
    role: seed.role,
  });

  return created({
    id: user.id,
    email: user.email,
    password: seed.password, // plaintext, by design — test consumes it to log in
    name: user.name,
    role: user.role,
  });
}

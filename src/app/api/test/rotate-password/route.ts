import type { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth-crypto";
import { getUserByEmail, updateUserPassword } from "@/lib/store";
import { badRequest, forbidden, notFound, ok } from "@/lib/api";
import {
  isSeedProtectedEmail,
  seedTokenConfigured,
  tokenMatches,
} from "@/lib/test-seed";

// POST /api/test/rotate-password
//
// Test-only, token-guarded endpoint (same guard as seed-user). Plays the
// system-under-test side of a PAM password rotation: when a vault like
// Delinea Secret Server rotates a Shared System ID, its rotation hook calls
// this to change the app-side password, then PATCHes the matching mabl
// credential so mabl tests keep logging in. See scripts/delinea/ and
// docs/DELINEA-ROTATION-POC.md.
//
// Guard: 404s when TEST_SEED_TOKEN is unset, so it is inert in real prod.
// The seeded demo/admin users are never rotatable — their documented
// passwords back every other demo flow.
export async function POST(req: NextRequest) {
  if (!seedTokenConfigured()) return notFound();
  if (!tokenMatches(req.headers.get("x-test-seed-token"))) {
    return forbidden("invalid or missing seed token");
  }

  let body: { email?: string; newPassword?: string } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return badRequest("invalid JSON body");
  }

  const { email, newPassword } = body;
  if (typeof email !== "string" || email.length === 0) {
    return badRequest("email is required");
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return badRequest("newPassword must be at least 8 characters");
  }
  if (isSeedProtectedEmail(email)) {
    return badRequest("seeded demo users cannot be rotated");
  }

  const user = await getUserByEmail(email);
  if (!user) return notFound("no user with that email");

  await updateUserPassword(user.id, hashPassword(newPassword));
  return ok({
    id: user.id,
    email: user.email,
    rotatedAt: new Date().toISOString(),
  });
}

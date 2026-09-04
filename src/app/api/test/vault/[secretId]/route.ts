import type { NextRequest } from "next/server";
import { getVaultSecret, upsertVaultSecret } from "@/lib/vault-db";
import { badRequest, forbidden, notFound, ok } from "@/lib/api";
import { seedTokenConfigured, tokenMatches } from "@/lib/test-seed";

// Mock secrets-vault API for the Delinea pull-model POC — simulates a PAM
// vault's secret-retrieval endpoint (e.g. Delinea Secret Server
// GET /api/v1/secrets/{id}). A mabl test's API step fetches the CURRENT
// credentials of a fixed Shared System ID here at run start (the "pull"
// model); the rotation script PUTs the new value on each rotation.
//
// Guard: same inert-in-prod pattern as the other /api/test/* routes — 404s
// when TEST_SEED_TOKEN is unset; callers send x-vault-token. Plaintext by
// design: a vault's job is returning secrets to authorized callers, and this
// is a fake store. See docs/DELINEA-ROTATION-POC.md.

function guard(req: NextRequest) {
  if (!seedTokenConfigured()) return notFound();
  if (!tokenMatches(req.headers.get("x-vault-token"))) {
    return forbidden("invalid or missing vault token");
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ secretId: string }> },
) {
  const denied = guard(req);
  if (denied) return denied;
  const { secretId } = await params;
  const secret = await getVaultSecret(secretId);
  if (!secret) return notFound("no secret with that id");
  return ok(secret);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ secretId: string }> },
) {
  const denied = guard(req);
  if (denied) return denied;
  const { secretId } = await params;

  let body: { username?: string; password?: string } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return badRequest("invalid JSON body");
  }
  if (typeof body.username !== "string" || body.username.length === 0) {
    return badRequest("username is required");
  }
  if (typeof body.password !== "string" || body.password.length < 8) {
    return badRequest("password must be at least 8 characters");
  }

  const secret = await upsertVaultSecret(secretId, body.username, body.password);
  return ok(secret);
}

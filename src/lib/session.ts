import { cookies, headers } from "next/headers";
import { sign, verify } from "./auth-crypto";
import { getUser } from "./store";
import type { User } from "./types";

const AUTH_COOKIE = "csh_auth";
const SESSION_COOKIE = "csh_session";
const SESSION_HEADER = "x-csh-session";
const DAY_MS = 24 * 60 * 60 * 1000;
const AUTH_TTL_MS = 7 * DAY_MS;

// ── Stateless auth payload (v2) ────────────────────────────────────────────
//
// Background: `globalThis.__CSH_STORE__` is a per-Lambda in-memory map.
// Newly-registered users only exist in the originating Lambda's memory,
// so a subsequent `/api/auth/me` request landing on a different Lambda
// would 401 even though the cookie was valid. Same class of bug as
// carts/orders (fixed in commit e080e6e by moving state into cookies).
//
// Fix: the signed `csh_auth` cookie carries the full user identity
// (id, email, name, role, exp), so `getCurrentUser` reconstructs the
// User without touching the in-memory store. The store remains the
// source of truth when present (preferred fast path) but is no longer
// required for session validation.

interface AuthPayloadV2 {
  v: 2;
  id: string;
  email: string;
  name: string;
  role: User["role"];
  exp: number; // ms since epoch
}

export function encodeAuthPayload(payload: AuthPayloadV2): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeAuthPayload(encoded: string): AuthPayloadV2 | null {
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    const obj = JSON.parse(json) as Partial<AuthPayloadV2>;
    if (
      obj.v !== 2 ||
      typeof obj.id !== "string" ||
      typeof obj.email !== "string" ||
      typeof obj.name !== "string" ||
      (obj.role !== "customer" && obj.role !== "admin") ||
      typeof obj.exp !== "number" ||
      !Number.isFinite(obj.exp)
    ) {
      return null;
    }
    return obj as AuthPayloadV2;
  } catch {
    return null;
  }
}

/**
 * Build a signed v2 auth token from a User identity.
 * Pure function — no I/O. Exported for unit tests.
 */
export function buildAuthToken(user: User, expiryMs: number): string {
  const payload: AuthPayloadV2 = {
    v: 2,
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: expiryMs,
  };
  return sign(encodeAuthPayload(payload));
}

/**
 * Parse a signed v2 auth token and return a User reconstructed from
 * the payload, or null if the token is missing/tampered/expired/v1.
 * Pure function — no I/O, no store dependency. Exported for unit tests.
 */
export function readAuthToken(token: string, nowMs: number): User | null {
  const verified = verify(token);
  if (!verified) return null;
  const payload = decodeAuthPayload(verified);
  if (!payload) return null;
  if (nowMs > payload.exp) return null;
  return {
    id: payload.id,
    email: payload.email,
    passwordHash: "", // not included in the cookie; not read by getCurrentUser consumers
    name: payload.name,
    role: payload.role,
    createdAt: new Date(payload.exp - AUTH_TTL_MS).toISOString(),
  };
}

export async function getSessionId(): Promise<string> {
  const hdrs = await headers();
  const fromHeader = hdrs.get(SESSION_HEADER);
  if (fromHeader) return fromHeader;
  const jar = await cookies();
  const fromCookie = jar.get(SESSION_COOKIE)?.value;
  return fromCookie ?? "s-transient";
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  // v2: self-contained signed JSON payload. Survives cross-Lambda
  // routing because the user identity travels in the cookie itself.
  const fromToken = readAuthToken(token, Date.now());
  if (fromToken) {
    // Prefer the in-memory user when this Lambda has one — picks up
    // any post-token changes (role escalation, name updates, etc.).
    const stored = await getUser(fromToken.id);
    return stored ?? fromToken;
  }

  // v1 legacy: `userId:expiry`. Still requires the store, so it only
  // works for pre-seeded users (Demo customer, admin). Existing v1
  // sessions in the wild auto-upgrade on next login. This branch can
  // be removed after AUTH_TTL_MS (7 days) post-deploy.
  const verified = verify(token);
  if (!verified) return null;
  const colonIdx = verified.indexOf(":");
  if (colonIdx <= 0) return null;
  const userId = verified.slice(0, colonIdx);
  const expiryStr = verified.slice(colonIdx + 1);
  const expiry = Number.parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
  return (await getUser(userId)) ?? null;
}

export async function login(userId: string): Promise<void> {
  const jar = await cookies();
  const exp = Date.now() + AUTH_TTL_MS;
  // Embed full user identity in the cookie so /api/auth/me works
  // across Lambda instances. login() is always called immediately
  // after createUser or getUserByEmail in the auth routes, so the
  // user is resolvable here (from the in-memory store, or Postgres
  // when a database is configured).
  const user = await getUser(userId);
  const token = user
    ? buildAuthToken(user, exp)
    : // Safety fallback — should never hit in normal flow. Emits the
      // legacy v1 format so a future getCurrentUser call at least has
      // the userId to attempt a store lookup.
      sign(`${userId}:${exp}`);
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Always set in code; Next strips `secure` on non-HTTPS dev requests
    // automatically, so this is safe in `next dev` against localhost:3000.
    secure: true,
    path: "/",
    maxAge: AUTH_TTL_MS / 1000,
  });
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
}

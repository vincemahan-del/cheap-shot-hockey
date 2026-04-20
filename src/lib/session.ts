import { cookies, headers } from "next/headers";
import { sign, verify } from "./auth-crypto";
import { getUser } from "./store";
import type { User } from "./types";

const AUTH_COOKIE = "csh_auth";
const SESSION_COOKIE = "csh_session";
const SESSION_HEADER = "x-csh-session";
const DAY_MS = 24 * 60 * 60 * 1000;
const AUTH_TTL_MS = 7 * DAY_MS;

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
  const payload = verify(token);
  if (!payload) return null;
  const [userId, expiryStr] = payload.split(":");
  const expiry = Number.parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
  const user = getUser(userId);
  return user ?? null;
}

export async function login(userId: string): Promise<void> {
  const jar = await cookies();
  const expiry = Date.now() + AUTH_TTL_MS;
  const token = sign(`${userId}:${expiry}`);
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_TTL_MS / 1000,
  });
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
}

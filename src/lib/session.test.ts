import { describe, expect, it } from "vitest";
import { sign } from "./auth-crypto";
import {
  buildAuthToken,
  decodeAuthPayload,
  encodeAuthPayload,
  readAuthToken,
} from "./session";
import type { User } from "./types";

const NOW = 1_780_000_000_000; // arbitrary fixed epoch ms
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const fakeUser: User = {
  id: "u-abc12345",
  email: "newbie@example.com",
  passwordHash: "h",
  name: "Test User",
  role: "customer",
  createdAt: "2026-05-21T00:00:00.000Z",
};

describe("encodeAuthPayload / decodeAuthPayload", () => {
  it("round-trips a valid v2 payload", () => {
    const encoded = encodeAuthPayload({
      v: 2,
      id: "u-1",
      email: "a@b.com",
      name: "A",
      role: "customer",
      exp: NOW + TTL_MS,
    });
    const decoded = decodeAuthPayload(encoded);
    expect(decoded).toEqual({
      v: 2,
      id: "u-1",
      email: "a@b.com",
      name: "A",
      role: "customer",
      exp: NOW + TTL_MS,
    });
  });

  it("returns null for non-base64 input", () => {
    expect(decodeAuthPayload("definitely!not!base64!")).toBeNull();
  });

  it("returns null for base64 that isn't valid JSON", () => {
    const notJson = Buffer.from("colon:separated", "utf8").toString("base64url");
    expect(decodeAuthPayload(notJson)).toBeNull();
  });

  it("returns null for a v1 (legacy) shape", () => {
    const v1Shape = Buffer.from(JSON.stringify({ id: "u-1", exp: 1 }), "utf8").toString("base64url");
    expect(decodeAuthPayload(v1Shape)).toBeNull();
  });

  it("returns null when role is invalid", () => {
    const bad = Buffer.from(
      JSON.stringify({ v: 2, id: "u-1", email: "a@b", name: "A", role: "wizard", exp: 1 }),
      "utf8",
    ).toString("base64url");
    expect(decodeAuthPayload(bad)).toBeNull();
  });

  it("returns null when exp is missing or non-finite", () => {
    const bad = Buffer.from(
      JSON.stringify({ v: 2, id: "u-1", email: "a@b", name: "A", role: "customer" }),
      "utf8",
    ).toString("base64url");
    expect(decodeAuthPayload(bad)).toBeNull();

    const infExp = Buffer.from(
      JSON.stringify({ v: 2, id: "u-1", email: "a@b", name: "A", role: "customer", exp: "soon" }),
      "utf8",
    ).toString("base64url");
    expect(decodeAuthPayload(infExp)).toBeNull();
  });
});

describe("buildAuthToken + readAuthToken (cross-Lambda survival)", () => {
  it("round-trips a User without needing any store lookup", () => {
    const token = buildAuthToken(fakeUser, NOW + TTL_MS);
    const restored = readAuthToken(token, NOW);
    expect(restored).not.toBeNull();
    expect(restored!.id).toBe(fakeUser.id);
    expect(restored!.email).toBe(fakeUser.email);
    expect(restored!.name).toBe(fakeUser.name);
    expect(restored!.role).toBe(fakeUser.role);
    // passwordHash is intentionally absent — it's not in the cookie and
    // no /api/auth/me consumer reads it.
    expect(restored!.passwordHash).toBe("");
  });

  it("preserves the admin role across the round-trip", () => {
    const admin: User = { ...fakeUser, id: "u-admin", role: "admin" };
    const token = buildAuthToken(admin, NOW + TTL_MS);
    const restored = readAuthToken(token, NOW);
    expect(restored!.role).toBe("admin");
  });

  it("rejects an expired token", () => {
    const token = buildAuthToken(fakeUser, NOW - 1);
    expect(readAuthToken(token, NOW)).toBeNull();
  });

  it("rejects a token whose payload was tampered after signing", () => {
    const token = buildAuthToken(fakeUser, NOW + TTL_MS);
    // Flip a character in the payload portion (before the signature).
    const dotIdx = token.lastIndexOf(".");
    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx);
    const tamperedPayload = payload.replace(/^./, payload[0] === "A" ? "B" : "A");
    expect(readAuthToken(tamperedPayload + sig, NOW)).toBeNull();
  });

  it("rejects a token with a tampered signature", () => {
    const token = buildAuthToken(fakeUser, NOW + TTL_MS);
    const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(readAuthToken(tampered, NOW)).toBeNull();
  });

  it("rejects an unsigned / malformed token", () => {
    expect(readAuthToken("nope", NOW)).toBeNull();
    expect(readAuthToken("", NOW)).toBeNull();
    expect(readAuthToken("no-dot-here-at-all", NOW)).toBeNull();
  });

  it("rejects a v1-shaped signed token (legacy path)", () => {
    // A v1 token isn't a base64 JSON payload; readAuthToken should
    // refuse it and signal 'fall back to legacy handling' via null.
    const v1 = sign(`u-legacy:${NOW + TTL_MS}`);
    expect(readAuthToken(v1, NOW)).toBeNull();
  });

  it("createdAt on the reconstructed user is consistent with the TTL window", () => {
    const expMs = NOW + TTL_MS;
    const token = buildAuthToken(fakeUser, expMs);
    const restored = readAuthToken(token, NOW);
    // The reconstructed createdAt is derived from exp - AUTH_TTL_MS,
    // which marks when the *session* started (not when the user was
    // originally created). Consumers that need true createdAt should
    // fall back to the store.
    expect(restored!.createdAt).toBe(new Date(NOW).toISOString());
  });
});

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const DEV_SECRET =
  process.env.AUTH_SECRET ?? "cheap-shot-dev-secret-not-for-production-use-only";

export function hashPassword(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function verifyPassword(plain: string, hashHex: string): boolean {
  const a = Buffer.from(hashPassword(plain), "hex");
  const b = Buffer.from(hashHex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sign(payload: string): string {
  const mac = createHmac("sha256", DEV_SECRET).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

export function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = createHmac("sha256", DEV_SECRET).update(payload).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? payload : null;
}

import { cookies } from "next/headers";
import type { CartLine } from "./types";

const CART_COOKIE = "csh_cart";
const MAX_LINES = 40;

export async function readCartLines(): Promise<CartLine[]> {
  const jar = await cookies();
  const raw = jar.get(CART_COOKIE)?.value;
  if (!raw) return [];
  try {
    const decoded = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (!Array.isArray(decoded)) return [];
    return decoded
      .filter(
        (l): l is CartLine =>
          l &&
          typeof l === "object" &&
          typeof l.productId === "string" &&
          typeof l.quantity === "number" &&
          Number.isFinite(l.quantity) &&
          l.quantity > 0,
      )
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

export async function writeCartLines(lines: CartLine[]): Promise<void> {
  const jar = await cookies();
  const trimmed = lines.filter((l) => l.quantity > 0).slice(0, MAX_LINES);
  if (trimmed.length === 0) {
    jar.delete(CART_COOKIE);
    return;
  }
  const encoded = Buffer.from(JSON.stringify(trimmed), "utf8").toString(
    "base64url",
  );
  jar.set(CART_COOKIE, encoded, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearCartCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(CART_COOKIE);
}

export async function setCartLineCookie(line: CartLine): Promise<CartLine[]> {
  const lines = await readCartLines();
  const idx = lines.findIndex((l) => l.productId === line.productId);
  if (line.quantity <= 0) {
    if (idx >= 0) lines.splice(idx, 1);
  } else if (idx >= 0) {
    lines[idx] = line;
  } else {
    lines.push(line);
  }
  await writeCartLines(lines);
  return lines;
}

export async function addCartLineCookie(line: CartLine): Promise<CartLine[]> {
  const lines = await readCartLines();
  const existing = lines.find((l) => l.productId === line.productId);
  const nextQty = Math.max(0, (existing?.quantity ?? 0) + line.quantity);
  return setCartLineCookie({ productId: line.productId, quantity: nextQty });
}

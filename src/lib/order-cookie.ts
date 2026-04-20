import { cookies } from "next/headers";
import type { Order } from "./types";

const ORDERS_COOKIE = "csh_recent_orders";
const MAX_ORDERS = 5;

export async function readRecentOrders(): Promise<Order[]> {
  const jar = await cookies();
  const raw = jar.get(ORDERS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const decoded = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (!Array.isArray(decoded)) return [];
    return decoded as Order[];
  } catch {
    return [];
  }
}

export async function rememberOrderInCookie(order: Order): Promise<void> {
  const jar = await cookies();
  const existing = await readRecentOrders();
  const next = [order, ...existing.filter((o) => o.id !== order.id)].slice(
    0,
    MAX_ORDERS,
  );
  const encoded = Buffer.from(JSON.stringify(next), "utf8").toString(
    "base64url",
  );
  jar.set(ORDERS_COOKIE, encoded, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function findRecentOrder(id: string): Promise<Order | null> {
  const orders = await readRecentOrders();
  return orders.find((o) => o.id === id) ?? null;
}

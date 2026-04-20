import { cookies } from "next/headers";

const GUEST_ORDERS_COOKIE = "csh_guest_orders";
const MAX_IDS = 20;

export async function getGuestOrderIds(): Promise<string[]> {
  const jar = await cookies();
  const raw = jar.get(GUEST_ORDERS_COOKIE)?.value;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function hasGuestOrder(orderId: string): Promise<boolean> {
  const ids = await getGuestOrderIds();
  return ids.includes(orderId);
}

export async function rememberGuestOrder(orderId: string): Promise<void> {
  const jar = await cookies();
  const existing = await getGuestOrderIds();
  const next = [orderId, ...existing.filter((id) => id !== orderId)].slice(0, MAX_IDS);
  jar.set(GUEST_ORDERS_COOKIE, next.join(","), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

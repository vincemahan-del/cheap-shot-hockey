import type { NextRequest } from "next/server";
import {
  clearCart,
  createOrder,
  currentPrice,
  getCart,
  getProduct,
  listOrdersByGuestEmail,
  listOrdersForUser,
} from "@/lib/store";
import { getCurrentUser, getSessionId } from "@/lib/session";
import { rememberGuestOrder } from "@/lib/guest-orders";
import { badRequest, created, ok, serviceUnavailable, unauthorized } from "@/lib/api";
import { applyDemoDelay, readDemoMode, shouldDemoFail } from "@/lib/demo";

const SHIPPING_CENTS = 999;
const FREE_SHIP_THRESHOLD_CENTS = 9900;
const TAX_RATE = 0.08;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (user) {
    const orders = listOrdersForUser(user.id);
    return ok({ count: orders.length, items: orders });
  }

  // Guest: allow lookup by email via ?email=<address>.
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email) {
    return unauthorized("log in or pass ?email=<address> to view orders");
  }
  const orders = listOrdersByGuestEmail(email);
  return ok({ count: orders.length, items: orders });
}

export async function POST(req: NextRequest) {
  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);
  if (shouldDemoFail(mode, 0.2)) {
    return serviceUnavailable("demo mode: order processor down");
  }

  const user = await getCurrentUser();

  let body: {
    customerEmail?: string;
    shippingAddress?: {
      name: string;
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  const addr = body.shippingAddress;
  if (
    !addr ||
    !addr.name ||
    !addr.street ||
    !addr.city ||
    !addr.state ||
    !addr.postalCode ||
    !addr.country
  ) {
    return badRequest(
      "shippingAddress with name, street, city, state, postalCode, country is required",
    );
  }

  let guestEmail: string | null = null;
  if (!user) {
    const rawEmail = body.customerEmail?.trim() ?? "";
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return badRequest(
        "customerEmail is required for guest checkout (must be a valid email)",
      );
    }
    guestEmail = rawEmail;
  }

  const sessionId = await getSessionId();
  const cart = getCart(sessionId);
  if (cart.lines.length === 0) return badRequest("cart is empty");

  const lines = cart.lines.map((l) => {
    const p = getProduct(l.productId);
    if (!p) throw new Error("missing product");
    return {
      productId: p.id,
      name: p.name,
      unitPriceCents: currentPrice(p),
      quantity: l.quantity,
    };
  });
  const subtotalCents = lines.reduce(
    (sum, l) => sum + l.unitPriceCents * l.quantity,
    0,
  );
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  const shippingCents =
    subtotalCents >= FREE_SHIP_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
  const totalCents = subtotalCents + taxCents + shippingCents;

  const order = createOrder({
    userId: user?.id ?? null,
    guestEmail,
    lines,
    subtotalCents,
    taxCents,
    shippingCents,
    totalCents,
    status: "paid",
    shippingAddress: addr,
  });
  clearCart(sessionId);

  if (!user) await rememberGuestOrder(order.id);

  return created(order);
}

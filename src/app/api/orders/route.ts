import type { NextRequest } from "next/server";
import {
  clearCart,
  createOrder,
  currentPrice,
  getCart,
  getProduct,
  listOrdersForUser,
} from "@/lib/store";
import { getCurrentUser, getSessionId } from "@/lib/session";
import { badRequest, created, ok, serviceUnavailable, unauthorized } from "@/lib/api";
import { applyDemoDelay, readDemoMode, shouldDemoFail } from "@/lib/demo";

const SHIPPING_CENTS = 999;
const TAX_RATE = 0.08;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized("log in to view orders");
  const orders = listOrdersForUser(user.id);
  return ok({ count: orders.length, items: orders });
}

export async function POST(req: NextRequest) {
  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);
  if (shouldDemoFail(mode, 0.2)) {
    return serviceUnavailable("demo mode: order processor down");
  }

  const user = await getCurrentUser();
  if (!user) return unauthorized("log in to place an order");

  let body: {
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
    return badRequest("shippingAddress with name, street, city, state, postalCode, country is required");
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
  const totalCents = subtotalCents + taxCents + SHIPPING_CENTS;

  const order = createOrder({
    userId: user.id,
    lines,
    subtotalCents,
    taxCents,
    shippingCents: SHIPPING_CENTS,
    totalCents,
    status: "paid",
    shippingAddress: addr,
  });
  clearCart(sessionId);
  return created(order);
}

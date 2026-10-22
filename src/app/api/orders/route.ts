import type { NextRequest } from "next/server";
import {
  createOrder,
  currentPrice,
  getProduct,
  listOrdersByGuestEmail,
  listOrdersForUser,
} from "@/lib/store";
import { getCurrentUser } from "@/lib/session";
import { clearCartCookie, readCartLines } from "@/lib/cart-cookie";
import { rememberOrderInCookie } from "@/lib/order-cookie";
import { rememberGuestOrder } from "@/lib/guest-orders";
import { badRequest, created, ok, serviceUnavailable, unauthorized } from "@/lib/api";
import { applyDemoDelay, readDemoMode, shouldDemoFail } from "@/lib/demo";
import { isValidEmail } from "@/lib/email";
import { readRegion, shippingForSubtotal, taxRate } from "@/lib/region";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (user) {
    const orders = await listOrdersForUser(user.id);
    return ok({ count: orders.length, items: orders });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email) {
    return unauthorized("log in or pass ?email=<address> to view orders");
  }
  const orders = await listOrdersByGuestEmail(email);
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
    if (!isValidEmail(rawEmail)) {
      return badRequest(
        "customerEmail is required for guest checkout (must be a valid email)",
      );
    }
    guestEmail = rawEmail;
  }

  const cartLines = await readCartLines();
  if (cartLines.length === 0) return badRequest("cart is empty");

  const lines = cartLines.map((l) => {
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
  // Amounts stay in USD base cents; region drives the tax rate (by province for
  // Canada) and shipping config. Display converts to the region's currency.
  const region = readRegion(req.headers);
  const taxCents = Math.round(subtotalCents * taxRate(region, addr.state));
  const shippingCents = shippingForSubtotal(region, subtotalCents);
  const totalCents = subtotalCents + taxCents + shippingCents;

  const order = await createOrder({
    userId: user?.id ?? null,
    guestEmail,
    lines,
    subtotalCents,
    taxCents,
    shippingCents,
    totalCents,
    region,
    status: "paid",
    shippingAddress: addr,
  });
  await clearCartCookie();
  await rememberOrderInCookie(order);
  if (!user) await rememberGuestOrder(order.id);

  return created(order);
}

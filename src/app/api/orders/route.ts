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
import { badRequest, created, ok, unauthorized } from "@/lib/api";
import { isValidEmail } from "@/lib/email";
import { readRegion } from "@/lib/region";
import { evaluatePromo, priceOrder, promoRejectionMessage, type PromoResult } from "@/lib/promo";
import { clearPromoCode, readPromoCode } from "@/lib/promo-cookie";

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
  const user = await getCurrentUser();

  let body: {
    customerEmail?: string;
    promoCode?: string;
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
  // An explicit body promoCode must be valid; a stale cookie code is ignored.
  let promo: PromoResult | null = null;
  if (body.promoCode !== undefined) {
    promo = evaluatePromo(body.promoCode, { subtotalCents, region });
    if (!promo.ok) {
      return badRequest(promoRejectionMessage(promo, region), {
        reason: promo.reason,
        code: promo.code,
        minSubtotalCents: promo.minSubtotalCents,
      });
    }
  } else {
    const cookieCode = await readPromoCode();
    if (cookieCode) promo = evaluatePromo(cookieCode, { subtotalCents, region });
  }
  const { discountCents, taxCents, shippingCents, totalCents, promoCode } = priceOrder({
    subtotalCents,
    region,
    province: addr.state,
    promo,
  });

  const order = await createOrder({
    userId: user?.id ?? null,
    guestEmail,
    lines,
    subtotalCents,
    discountCents,
    promoCode,
    taxCents,
    shippingCents,
    totalCents,
    region,
    status: "paid",
    shippingAddress: addr,
  });
  await clearCartCookie();
  await clearPromoCode();
  await rememberOrderInCookie(order);
  if (!user) await rememberGuestOrder(order.id);

  return created(order);
}

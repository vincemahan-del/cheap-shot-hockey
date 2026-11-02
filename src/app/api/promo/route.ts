import type { NextRequest } from "next/server";
import { currentPrice, getProduct } from "@/lib/store";
import { readCartLines } from "@/lib/cart-cookie";
import { clearPromoCode, readPromoCode, writePromoCode } from "@/lib/promo-cookie";
import { evaluatePromo, priceOrder, promoRejectionMessage } from "@/lib/promo";
import { badRequest, ok } from "@/lib/api";
import { CA_DEFAULT_PROVINCE, readRegion } from "@/lib/region";

async function cartSubtotal(): Promise<number> {
  const lines = await readCartLines();
  return lines.reduce((sum, l) => {
    const p = getProduct(l.productId);
    return p ? sum + currentPrice(p) * l.quantity : sum;
  }, 0);
}

function promoView(result: ReturnType<typeof evaluatePromo>) {
  if (!result.ok) return null;
  const { code, kind, value, description } = result.promo;
  return { code, kind, value, description };
}

export async function GET(req: NextRequest) {
  const region = readRegion(req.headers);
  const subtotalCents = await cartSubtotal();
  const code = await readPromoCode();
  const result = code ? evaluatePromo(code, { subtotalCents, region }) : null;
  return ok({
    promo: result ? promoView(result) : null,
    rejection: result && !result.ok ? { reason: result.reason, code: result.code } : null,
    quote: priceOrder({ subtotalCents, region, province: CA_DEFAULT_PROVINCE, promo: result }),
  });
}

export async function POST(req: NextRequest) {
  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }

  const region = readRegion(req.headers);
  const subtotalCents = await cartSubtotal();
  if (subtotalCents === 0) return badRequest("cart is empty");

  const result = evaluatePromo(body.code, { subtotalCents, region });
  if (!result.ok) {
    return badRequest(promoRejectionMessage(result, region), {
      reason: result.reason,
      code: result.code,
      minSubtotalCents: result.minSubtotalCents,
    });
  }

  await writePromoCode(result.promo.code);
  return ok({
    promo: promoView(result),
    quote: priceOrder({ subtotalCents, region, province: CA_DEFAULT_PROVINCE, promo: result }),
  });
}

export async function DELETE(req: NextRequest) {
  await clearPromoCode();
  const region = readRegion(req.headers);
  const subtotalCents = await cartSubtotal();
  return ok({
    promo: null,
    quote: priceOrder({ subtotalCents, region, province: CA_DEFAULT_PROVINCE }),
  });
}

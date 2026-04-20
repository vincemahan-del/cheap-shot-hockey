import type { NextRequest } from "next/server";
import { clearCart, currentPrice, getCart, getProduct, setCartLine } from "@/lib/store";
import { getSessionId } from "@/lib/session";
import { badRequest, ok, serviceUnavailable } from "@/lib/api";
import { applyDemoDelay, readDemoMode, shouldDemoFail } from "@/lib/demo";

async function cartResponse(sessionId: string) {
  const cart = getCart(sessionId);
  const enriched = cart.lines.map((line) => {
    const product = getProduct(line.productId);
    const unitPriceCents = product ? currentPrice(product) : 0;
    return {
      productId: line.productId,
      name: product?.name ?? "(unknown)",
      unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: unitPriceCents * line.quantity,
      inStock: (product?.stock ?? 0) >= line.quantity,
    };
  });
  const subtotalCents = enriched.reduce((sum, l) => sum + l.lineTotalCents, 0);
  return ok({
    sessionId: cart.sessionId,
    lines: enriched,
    subtotalCents,
    updatedAt: cart.updatedAt,
  });
}

export async function GET() {
  const sessionId = await getSessionId();
  return cartResponse(sessionId);
}

export async function POST(req: NextRequest) {
  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);
  if (shouldDemoFail(mode, 0.15)) {
    return serviceUnavailable("demo mode: cart write temporarily unavailable");
  }

  let body: { productId?: string; quantity?: number };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  const { productId, quantity } = body;
  if (typeof productId !== "string") return badRequest("productId is required");
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    return badRequest("quantity must be a number");
  }
  const product = getProduct(productId);
  if (!product) return badRequest("unknown productId");
  if (quantity > product.stock) {
    return badRequest(`only ${product.stock} in stock`);
  }

  const sessionId = await getSessionId();
  setCartLine(sessionId, { productId, quantity });
  return cartResponse(sessionId);
}

export async function DELETE() {
  const sessionId = await getSessionId();
  clearCart(sessionId);
  return ok({ sessionId, lines: [], subtotalCents: 0 });
}

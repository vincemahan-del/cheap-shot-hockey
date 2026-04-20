import type { NextRequest } from "next/server";
import { currentPrice, getProduct } from "@/lib/store";
import {
  addCartLineCookie,
  clearCartCookie,
  readCartLines,
  setCartLineCookie,
} from "@/lib/cart-cookie";
import { badRequest, ok, serviceUnavailable } from "@/lib/api";
import { applyDemoDelay, readDemoMode, shouldDemoFail } from "@/lib/demo";
import type { CartLine } from "@/lib/types";

function enrich(lines: CartLine[]) {
  const enriched = lines.map((line) => {
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
  return { lines: enriched, subtotalCents };
}

export async function GET() {
  const lines = await readCartLines();
  const { lines: enriched, subtotalCents } = enrich(lines);
  return ok({
    lines: enriched,
    subtotalCents,
    updatedAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);
  if (shouldDemoFail(mode, 0.15)) {
    return serviceUnavailable("demo mode: cart write temporarily unavailable");
  }

  let body: { productId?: string; quantity?: number; mode?: "add" | "set" };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  const { productId, quantity, mode: writeMode = "set" } = body;
  if (typeof productId !== "string") return badRequest("productId is required");
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    return badRequest("quantity must be a number");
  }
  if (writeMode !== "add" && writeMode !== "set") {
    return badRequest("mode must be 'add' or 'set'");
  }
  const product = getProduct(productId);
  if (!product) return badRequest("unknown productId");

  const existing = await readCartLines();
  const currentQty =
    existing.find((l) => l.productId === productId)?.quantity ?? 0;
  const targetQty = writeMode === "add" ? currentQty + quantity : quantity;
  if (targetQty > product.stock) {
    return badRequest(`only ${product.stock} in stock`);
  }

  const nextLines =
    writeMode === "add"
      ? await addCartLineCookie({ productId, quantity })
      : await setCartLineCookie({ productId, quantity });

  const { lines: enriched, subtotalCents } = enrich(nextLines);
  return ok({
    lines: enriched,
    subtotalCents,
    updatedAt: new Date().toISOString(),
  });
}

export async function DELETE() {
  await clearCartCookie();
  return ok({ lines: [], subtotalCents: 0 });
}

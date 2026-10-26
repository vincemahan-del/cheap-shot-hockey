import type { NextRequest } from "next/server";
import { listProducts } from "@/lib/store";
import { ok } from "@/lib/api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const items = listProducts({
    category: searchParams.get("category") ?? undefined,
    brand: searchParams.get("brand") ?? undefined,
    position: searchParams.get("position") ?? undefined,
    hand: searchParams.get("hand") ?? undefined,
    onSale: searchParams.get("onSale") === "true" ? true : undefined,
    search: searchParams.get("q") ?? undefined,
    minPriceCents: numOrUndef(searchParams.get("minPriceCents")),
    maxPriceCents: numOrUndef(searchParams.get("maxPriceCents")),
  });

  return ok({
    count: items.length,
    items,
  });
}

function numOrUndef(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

import type { NextRequest } from "next/server";
import { getProduct, getProductBySlug } from "@/lib/store";
import { notFound, ok } from "@/lib/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const product = getProduct(id) ?? getProductBySlug(id);
  if (!product) return notFound("product not found");
  return ok(product);
}

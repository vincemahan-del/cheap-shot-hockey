import type { NextRequest } from "next/server";
import { getOrder } from "@/lib/store";
import { getCurrentUser } from "@/lib/session";
import { forbidden, notFound, ok, unauthorized } from "@/lib/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const order = getOrder(id);
  if (!order) return notFound("order not found");
  if (order.userId !== user.id && user.role !== "admin") return forbidden();
  return ok(order);
}

import type { NextRequest } from "next/server";
import { getOrder } from "@/lib/store";
import { getCurrentUser } from "@/lib/session";
import { hasGuestOrder } from "@/lib/guest-orders";
import { findRecentOrder } from "@/lib/order-cookie";
import { forbidden, notFound, ok } from "@/lib/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = getOrder(id) ?? (await findRecentOrder(id));
  if (!order) return notFound("order not found");

  const user = await getCurrentUser();
  if (user && (order.userId === user.id || user.role === "admin")) {
    return ok(order);
  }
  if (await hasGuestOrder(id)) {
    return ok(order);
  }
  // If this order is in the caller's recent-orders cookie they can also see it.
  const inRecent = await findRecentOrder(id);
  if (inRecent) {
    return ok(inRecent);
  }
  return forbidden("you don't have access to this order");
}

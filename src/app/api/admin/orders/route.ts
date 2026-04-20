import { listAllOrders } from "@/lib/store";
import { getCurrentUser } from "@/lib/session";
import { forbidden, ok, unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden("admin access required");
  const items = listAllOrders();
  return ok({ count: items.length, items });
}

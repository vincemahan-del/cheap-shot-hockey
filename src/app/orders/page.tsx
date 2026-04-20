import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getOrder, listOrdersForUser } from "@/lib/store";
import { getGuestOrderIds } from "@/lib/guest-orders";
import { readRecentOrders } from "@/lib/order-cookie";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/types";

export default async function OrdersPage() {
  const user = await getCurrentUser();

  let orders: Order[] = [];
  let isGuest = false;

  if (user) {
    orders = listOrdersForUser(user.id);
  } else {
    isGuest = true;
    const ids = await getGuestOrderIds();
    const recent = await readRecentOrders();
    const fromStore = ids
      .map((id) => getOrder(id))
      .filter((o): o is Order => Boolean(o));
    const combined = [...fromStore, ...recent];
    const seen = new Set<string>();
    orders = combined
      .filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display mb-2 text-3xl md:text-4xl" data-testid="orders-heading">
        {isGuest ? "Your Guest Orders" : "Your Orders"}
      </h1>
      {isGuest && (
        <p className="mb-6 text-sm text-[color:var(--muted)]">
          These are the orders you&apos;ve placed on this device.{" "}
          <Link
            href="/login?next=/orders"
            className="text-[color:var(--accent)] hover:underline"
          >
            Log in
          </Link>{" "}
          to see orders across devices.
        </p>
      )}
      {orders.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-[color:var(--border)] p-10 text-center text-[color:var(--muted)]"
          data-testid="orders-empty"
        >
          You haven&apos;t placed any orders yet.
        </div>
      ) : (
        <ul className="space-y-3" data-testid="orders-list">
          {orders.map((o) => (
            <li
              key={o.id}
              data-testid={`order-row-${o.id}`}
              className="flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
            >
              <div>
                <div className="font-semibold">
                  <Link
                    href={`/orders/${o.id}`}
                    className="hover:text-[color:var(--accent)]"
                  >
                    Order {o.id}
                  </Link>
                </div>
                <div className="text-sm text-[color:var(--muted)]">
                  {new Date(o.createdAt).toLocaleString()} · {o.lines.length} item
                  {o.lines.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="rounded bg-[color:var(--accent)]/20 px-2 py-0.5 text-xs font-bold uppercase text-[color:var(--accent)]"
                  data-testid={`order-status-${o.id}`}
                >
                  {o.status}
                </span>
                <span className="font-semibold" data-testid={`order-total-${o.id}`}>
                  {formatPrice(o.totalCents)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

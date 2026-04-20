import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listOrdersForUser } from "@/lib/store";
import { formatPrice } from "@/lib/format";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");
  const orders = listOrdersForUser(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold" data-testid="orders-heading">
        Your Orders
      </h1>
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

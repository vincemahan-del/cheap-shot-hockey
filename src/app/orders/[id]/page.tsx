import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getOrder } from "@/lib/store";
import { formatPrice } from "@/lib/format";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const order = getOrder(id);
  if (!order) notFound();
  if (order.userId !== user.id && user.role !== "admin") notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {isNew === "1" && (
        <div
          data-testid="order-new-banner"
          className="mb-6 rounded bg-[color:var(--success)]/20 p-4 text-[color:var(--success)]"
        >
          🏒 Order placed! Confirmation ID {order.id}.
        </div>
      )}
      <h1 className="text-3xl font-bold" data-testid="order-id">
        Order {order.id}
      </h1>
      <div className="mt-1 text-sm text-[color:var(--muted)]">
        Placed {new Date(order.createdAt).toLocaleString()} · Status:{" "}
        <span
          className="font-semibold text-[color:var(--foreground)]"
          data-testid="order-status"
        >
          {order.status}
        </span>
      </div>

      <section className="mt-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
        <h2 className="mb-3 font-bold">Items</h2>
        <ul className="divide-y divide-[color:var(--border)]" data-testid="order-lines">
          {order.lines.map((l) => (
            <li
              key={l.productId}
              data-testid={`order-line-${l.productId}`}
              className="flex justify-between py-2 text-sm"
            >
              <span>
                {l.quantity} × {l.name}
              </span>
              <span>{formatPrice(l.unitPriceCents * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">Subtotal</span>
            <span data-testid="order-subtotal">{formatPrice(order.subtotalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">Tax</span>
            <span data-testid="order-tax">{formatPrice(order.taxCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">Shipping</span>
            <span data-testid="order-shipping">{formatPrice(order.shippingCents)}</span>
          </div>
          <div className="flex justify-between border-t border-[color:var(--border)] pt-2 font-bold">
            <span>Total</span>
            <span data-testid="order-total">{formatPrice(order.totalCents)}</span>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
        <h2 className="mb-2 font-bold">Shipping</h2>
        <address className="not-italic text-sm text-[color:var(--muted)]" data-testid="order-ship-to">
          {order.shippingAddress.name}
          <br />
          {order.shippingAddress.street}
          <br />
          {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
          <br />
          {order.shippingAddress.country}
        </address>
      </section>

      <div className="mt-6 text-sm">
        <Link
          href="/orders"
          data-testid="order-back"
          className="text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
        >
          ← Back to orders
        </Link>
      </div>
    </div>
  );
}

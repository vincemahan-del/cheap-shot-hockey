import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getOrder } from "@/lib/store";
import { hasGuestOrder } from "@/lib/guest-orders";
import { formatPrice } from "@/lib/format";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const order = getOrder(id);
  if (!order) notFound();

  const user = await getCurrentUser();
  const isOwnedByUser =
    user && (order.userId === user.id || user.role === "admin");
  const isAccessibleAsGuest = !order.userId && (await hasGuestOrder(id));
  if (!isOwnedByUser && !isAccessibleAsGuest) notFound();

  const isGuestOrder = order.guestEmail != null && order.userId == null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {isNew === "1" && (
        <div
          data-testid="order-new-banner"
          className="mb-6 rounded bg-[color:var(--success)]/20 p-4 text-[color:var(--success)]"
        >
          🏒 Order placed! Confirmation ID {order.id}.
          {isGuestOrder && order.guestEmail && (
            <span className="block text-sm">
              Confirmation sent to <strong>{order.guestEmail}</strong>.
            </span>
          )}
        </div>
      )}
      <h1 className="font-display text-3xl md:text-4xl" data-testid="order-id">
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
        {isGuestOrder && (
          <span className="ml-2 rounded bg-[color:var(--surface-2)] px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
            Guest order
          </span>
        )}
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
            <span data-testid="order-shipping">
              {order.shippingCents === 0 ? "FREE" : formatPrice(order.shippingCents)}
            </span>
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
          {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
          {order.shippingAddress.postalCode}
          <br />
          {order.shippingAddress.country}
        </address>
      </section>

      <div className="mt-6 text-sm">
        {user ? (
          <Link
            href="/orders"
            data-testid="order-back"
            className="text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            ← Back to orders
          </Link>
        ) : (
          <Link
            href="/products"
            data-testid="order-keep-shopping"
            className="text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            ← Keep shopping
          </Link>
        )}
      </div>
    </div>
  );
}

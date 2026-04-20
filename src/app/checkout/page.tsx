import Link from "next/link";
import { currentPrice, getProduct } from "@/lib/store";
import { readCartLines } from "@/lib/cart-cookie";
import { getCurrentUser } from "@/lib/session";
import { formatPrice } from "@/lib/format";
import { CheckoutForm } from "./CheckoutForm";

const FREE_SHIP_THRESHOLD_CENTS = 9900;
const SHIPPING_CENTS = 999;

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const cartLines = await readCartLines();

  const enriched = cartLines
    .map((l) => {
      const p = getProduct(l.productId);
      if (!p) return null;
      const unit = currentPrice(p);
      return { line: l, product: p, unit, lineTotal: unit * l.quantity };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
  const subtotal = enriched.reduce((s, e) => s + e.lineTotal, 0);
  const tax = Math.round(subtotal * 0.08);
  const shipping =
    subtotal >= FREE_SHIP_THRESHOLD_CENTS ? 0 : subtotal > 0 ? SHIPPING_CENTS : 0;
  const total = subtotal + tax + shipping;

  if (enriched.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="font-display text-3xl md:text-4xl">Checkout</h1>
        <p className="mt-4 text-[color:var(--muted)]">Your cart is empty.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded bg-[color:var(--primary)] px-4 py-2 font-semibold text-white"
        >
          Shop now
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display mb-2 text-3xl md:text-4xl" data-testid="checkout-heading">
        Checkout
      </h1>
      {!user && (
        <p
          className="mb-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--muted)]"
          data-testid="guest-checkout-banner"
        >
          Checking out as a guest —{" "}
          <Link
            href="/login?next=/checkout"
            data-testid="guest-checkout-login-link"
            className="font-semibold text-[color:var(--accent)] hover:underline"
          >
            log in
          </Link>{" "}
          or{" "}
          <Link
            href="/register"
            className="font-semibold text-[color:var(--accent)] hover:underline"
          >
            create an account
          </Link>{" "}
          to save your order history.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
        <CheckoutForm
          defaultName={user?.name ?? ""}
          defaultEmail={user?.email ?? ""}
          isGuest={!user}
        />
        <aside className="h-fit rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <h2 className="mb-3 font-bold">Order summary</h2>
          <ul className="space-y-1 text-sm">
            {enriched.map((e) => (
              <li key={e.product.id} className="flex justify-between">
                <span className="truncate">
                  {e.line.quantity} × {e.product.name}
                </span>
                <span data-testid={`summary-line-${e.product.id}`}>
                  {formatPrice(e.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <div className="my-3 h-px bg-[color:var(--border)]" />
          <div className="flex justify-between text-sm">
            <span className="text-[color:var(--muted)]">Subtotal</span>
            <span data-testid="checkout-subtotal">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[color:var(--muted)]">Tax</span>
            <span data-testid="checkout-tax">{formatPrice(tax)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[color:var(--muted)]">Shipping</span>
            <span data-testid="checkout-shipping">
              {shipping === 0 && subtotal > 0 ? "FREE" : formatPrice(shipping)}
            </span>
          </div>
          <div className="mt-2 flex justify-between border-t border-[color:var(--border)] pt-2 font-bold">
            <span>Total</span>
            <span data-testid="checkout-total">{formatPrice(total)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentPrice, getCart, getProduct } from "@/lib/store";
import { getCurrentUser, getSessionId } from "@/lib/session";
import { formatPrice } from "@/lib/format";
import { CheckoutForm } from "./CheckoutForm";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");

  const sessionId = await getSessionId();
  const cart = getCart(sessionId);

  const enriched = cart.lines.map((l) => {
    const p = getProduct(l.productId)!;
    const unit = currentPrice(p);
    return { line: l, product: p, unit, lineTotal: unit * l.quantity };
  });
  const subtotal = enriched.reduce((s, e) => s + e.lineTotal, 0);
  const tax = Math.round(subtotal * 0.08);
  const shipping = subtotal > 0 ? 999 : 0;
  const total = subtotal + tax + shipping;

  if (enriched.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-3xl font-bold">Checkout</h1>
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
      <h1 className="mb-6 text-3xl font-bold" data-testid="checkout-heading">
        Checkout
      </h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
        <CheckoutForm defaultName={user.name} />
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
            <span data-testid="checkout-shipping">{formatPrice(shipping)}</span>
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

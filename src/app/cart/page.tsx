import Link from "next/link";
import { currentPrice, getCart, getProduct } from "@/lib/store";
import { getSessionId } from "@/lib/session";
import { formatPrice } from "@/lib/format";
import { ProductThumb } from "@/components/ProductThumb";
import { CartLineControls } from "@/components/CartLineControls";

export default async function CartPage() {
  const sessionId = await getSessionId();
  const cart = getCart(sessionId);
  const enriched = cart.lines.map((l) => {
    const p = getProduct(l.productId)!;
    const unit = currentPrice(p);
    return { line: l, product: p, unit, lineTotal: unit * l.quantity };
  });
  const subtotal = enriched.reduce((s, e) => s + e.lineTotal, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold" data-testid="cart-heading">
        Your Cart
      </h1>
      {enriched.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-[color:var(--border)] p-10 text-center"
          data-testid="cart-empty"
        >
          <p className="text-[color:var(--muted)]">Your cart is empty.</p>
          <Link
            href="/products"
            data-testid="cart-empty-shop"
            className="mt-4 inline-block rounded bg-[color:var(--primary)] px-4 py-2 font-semibold text-white"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
          <ul className="space-y-3" data-testid="cart-lines">
            {enriched.map((e) => (
              <li
                key={e.product.id}
                data-testid={`cart-line-${e.product.id}`}
                className="flex items-center gap-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <div className="w-24 shrink-0">
                  <ProductThumb
                    slug={e.product.slug}
                    name={e.product.name}
                    category={e.product.category}
                    size="sm"
                  />
                </div>
                <div className="flex-1">
                  <Link
                    href={`/products/${e.product.slug}`}
                    className="font-semibold hover:text-[color:var(--accent)]"
                  >
                    {e.product.name}
                  </Link>
                  <div className="text-sm text-[color:var(--muted)]">
                    {e.product.brand} · {formatPrice(e.unit)} each
                  </div>
                  <div
                    className="mt-1 font-semibold"
                    data-testid={`cart-line-total-${e.product.id}`}
                  >
                    {formatPrice(e.lineTotal)}
                  </div>
                </div>
                <CartLineControls productId={e.product.id} quantity={e.line.quantity} />
              </li>
            ))}
          </ul>
          <aside className="h-fit rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <h2 className="mb-3 font-bold">Summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-[color:var(--muted)]">Subtotal</span>
              <span data-testid="cart-subtotal">{formatPrice(subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-[color:var(--muted)]">
              <span>Tax &amp; shipping</span>
              <span>calculated at checkout</span>
            </div>
            <Link
              href="/checkout"
              data-testid="cart-checkout"
              className="mt-5 block rounded bg-[color:var(--primary)] py-3 text-center font-semibold text-white hover:opacity-90"
            >
              Checkout
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

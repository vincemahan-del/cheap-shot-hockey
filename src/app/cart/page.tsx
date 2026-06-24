import Link from "next/link";
import { headers } from "next/headers";
import { currentPrice, getProduct } from "@/lib/store";
import { readCartLines } from "@/lib/cart-cookie";
import { formatPrice } from "@/lib/format";
import { freeShippingProgress } from "@/lib/shipping";
import { readRegion, shippingConfig } from "@/lib/region";
import { ProductThumb } from "@/components/ProductThumb";
import { CartLineControls } from "@/components/CartLineControls";

export default async function CartPage() {
  const region = readRegion(await headers());
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
  const shipping = freeShippingProgress(
    subtotal,
    shippingConfig(region).freeShipThresholdCents,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display mb-6 text-4xl" data-testid="cart-heading">
        Your Cart
      </h1>
      {enriched.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-14 text-center"
          data-testid="cart-empty"
        >
          <div className="mb-4 text-5xl">🏒</div>
          <p className="text-[color:var(--muted)]">Your cart is empty. Time to load up.</p>
          <Link
            href="/products"
            data-testid="cart-empty-shop"
            className="mt-5 inline-block rounded-md bg-[color:var(--primary)] px-5 py-2.5 font-bold text-white"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_340px]">
          <div>
            <div
              className="mb-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              data-testid="free-shipping-progress"
              data-free-ship-meter
              data-qualified={shipping.qualified ? "true" : "false"}
              id="free-ship-meter"
            >
              {/* Backwards-compat alias for the prior testid */}
              <span hidden data-testid="free-ship-meter" />
              {shipping.qualified ? (
                <div
                  className="flex items-center justify-between text-xs font-bold"
                  data-testid="free-shipping-qualified"
                >
                  <span className="text-[color:var(--accent)]">
                    You qualify for FREE shipping
                  </span>
                  <span>100%</span>
                </div>
              ) : (
                <div className="flex justify-between text-xs font-bold text-[color:var(--muted)]">
                  <span data-testid="free-shipping-remaining">
                    Add {formatPrice(shipping.remainingCents, region)} more for{" "}
                    <span className="text-[color:var(--accent)]">FREE shipping</span>
                  </span>
                  <span>{shipping.progressPercent}%</span>
                </div>
              )}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-[color:var(--surface-2)]">
                <div
                  className="h-full rounded bg-[color:var(--accent)] transition-all"
                  data-testid="free-shipping-progress-bar"
                  style={{ width: `${shipping.progressPercent}%` }}
                />
              </div>
            </div>
            <ul className="space-y-3" data-testid="cart-lines">
              {enriched.map((e) => (
                <li
                  key={e.product.id}
                  data-testid={`cart-line-${e.product.id}`}
                  className="flex items-center gap-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
                >
                  <div className="w-24 shrink-0">
                    <ProductThumb
                      slug={e.product.slug}
                      name={e.product.name}
                      category={e.product.category}
                      brand={e.product.brand}
                      size="sm"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                      {e.product.brand}
                    </div>
                    <Link
                      href={`/products/${e.product.slug}`}
                      className="font-bold hover:text-[color:var(--accent)]"
                    >
                      {e.product.name}
                    </Link>
                    <div className="text-sm text-[color:var(--muted)]">
                      {formatPrice(e.unit, region)} each
                    </div>
                    <div
                      className="mt-1 font-black"
                      data-testid={`cart-line-total-${e.product.id}`}
                    >
                      {formatPrice(e.lineTotal, region)}
                    </div>
                  </div>
                  <CartLineControls productId={e.product.id} quantity={e.line.quantity} />
                </li>
              ))}
            </ul>
          </div>
          <aside className="h-fit rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <h2 className="mb-3 font-black uppercase tracking-wider text-[color:var(--muted)]">
              Summary
            </h2>
            <div className="flex justify-between text-sm">
              <span className="text-[color:var(--muted)]">Subtotal</span>
              <span className="font-bold" data-testid="cart-subtotal">
                {formatPrice(subtotal, region)}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-[color:var(--muted)]">
              <span>Tax &amp; shipping</span>
              <span>calculated at checkout</span>
            </div>
            <Link
              href="/checkout"
              data-testid="cart-checkout"
              className="mt-5 block rounded-md bg-[color:var(--primary)] py-3 text-center font-black uppercase tracking-wider text-white hover:opacity-90"
            >
              Checkout
            </Link>
            <Link
              href="/products"
              className="mt-2 block text-center text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              ← Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { currentPrice, getProduct } from "@/lib/store";
import { readCartLines } from "@/lib/cart-cookie";
import { getCurrentUser } from "@/lib/session";
import { formatPrice } from "@/lib/format";
import { CA_DEFAULT_PROVINCE, readRegion, shippingForSubtotal, taxRate } from "@/lib/region";
import { CheckoutForm } from "./CheckoutForm";

export default async function CheckoutPage() {
  const t = await getTranslations("checkout");
  const region = readRegion(await headers());
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
  // Summary preview: province isn't known until the form is submitted, so the
  // Canadian preview uses the default province rate. The order route recomputes
  // tax from the entered province on submit.
  const tax = Math.round(subtotal * taxRate(region, CA_DEFAULT_PROVINCE));
  const shipping = shippingForSubtotal(region, subtotal);
  const total = subtotal + tax + shipping;

  if (enriched.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="font-display text-3xl md:text-4xl">{t("heading")}</h1>
        <p className="mt-4 text-[color:var(--muted)]">{t("empty")}</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded bg-[color:var(--primary)] px-4 py-2 font-semibold text-white"
        >
          {t("shopNow")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display mb-2 text-3xl md:text-4xl" data-testid="checkout-heading">
        {t("heading")}
      </h1>
      {!user && (
        <p
          className="mb-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--muted)]"
          data-testid="guest-checkout-banner"
        >
          {t("guestBannerPrefix")}{" "}
          <Link
            href="/login?next=/checkout"
            data-testid="guest-checkout-login-link"
            className="font-semibold text-[color:var(--accent)] hover:underline"
          >
            {t("guestLogin")}
          </Link>{" "}
          {t("guestOr")}{" "}
          <Link
            href="/register"
            className="font-semibold text-[color:var(--accent)] hover:underline"
          >
            {t("guestRegister")}
          </Link>{" "}
          {t("guestBannerSuffix")}
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
        <CheckoutForm
          defaultName={user?.name ?? ""}
          defaultEmail={user?.email ?? ""}
          isGuest={!user}
          region={region}
        />
        <aside className="h-fit rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <h2 className="mb-3 font-bold">{t("orderSummary")}</h2>
          <ul className="space-y-1 text-sm">
            {enriched.map((e) => (
              <li key={e.product.id} className="flex justify-between">
                <span className="truncate">
                  {e.line.quantity} × {e.product.name}
                </span>
                <span data-testid={`summary-line-${e.product.id}`}>
                  {formatPrice(e.lineTotal, region)}
                </span>
              </li>
            ))}
          </ul>
          <div className="my-3 h-px bg-[color:var(--border)]" />
          <div className="flex justify-between text-sm">
            <span className="text-[color:var(--muted)]">{t("subtotal")}</span>
            <span data-testid="checkout-subtotal">{formatPrice(subtotal, region)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[color:var(--muted)]">{t("tax")}</span>
            <span data-testid="checkout-tax">{formatPrice(tax, region)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[color:var(--muted)]">{t("shipping")}</span>
            <span data-testid="checkout-shipping">
              {shipping === 0 && subtotal > 0 ? t("free") : formatPrice(shipping, region)}
            </span>
          </div>
          <div className="mt-2 flex justify-between border-t border-[color:var(--border)] pt-2 font-bold">
            <span>{t("total")}</span>
            <span data-testid="checkout-total">{formatPrice(total, region)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

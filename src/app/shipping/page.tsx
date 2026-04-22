import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Returns | Cheap Shot Hockey",
};

export default function ShippingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10" data-testid="shipping-page">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 text-xs text-[color:var(--muted)]"
        data-testid="shipping-breadcrumbs"
      >
        <Link href="/" className="hover:text-[color:var(--foreground)]">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[color:var(--foreground)]">Shipping &amp; Returns</span>
      </nav>

      <h1
        className="mb-8 font-black text-3xl"
        data-testid="shipping-heading"
      >
        Shipping &amp; Returns
      </h1>

      {/* Shipping */}
      <section className="mb-10" data-testid="shipping-policy">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Shipping
        </h2>

        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <div data-testid="shipping-free-threshold">
            <p className="font-semibold text-[color:var(--foreground)]">Free shipping on orders over $99</p>
            <p>All orders of $99 or more ship free via standard ground shipping within the contiguous US.</p>
          </div>

          <div data-testid="shipping-rates">
            <p className="font-semibold text-[color:var(--foreground)]">Standard rates</p>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-left text-[color:var(--muted)]">
                  <th className="py-2 pr-4 font-semibold">Method</th>
                  <th className="py-2 pr-4 font-semibold">Estimated delivery</th>
                  <th className="py-2 font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[color:var(--border)]" data-testid="shipping-row-standard">
                  <td className="py-2 pr-4">Standard ground</td>
                  <td className="py-2 pr-4">5–7 business days</td>
                  <td className="py-2">$7.99</td>
                </tr>
                <tr className="border-b border-[color:var(--border)]" data-testid="shipping-row-express">
                  <td className="py-2 pr-4">Express (2-day)</td>
                  <td className="py-2 pr-4">2 business days</td>
                  <td className="py-2">$14.99</td>
                </tr>
                <tr data-testid="shipping-row-overnight">
                  <td className="py-2 pr-4">Overnight</td>
                  <td className="py-2 pr-4">Next business day</td>
                  <td className="py-2">$24.99</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div data-testid="shipping-processing">
            <p className="font-semibold text-[color:var(--foreground)]">Order processing</p>
            <p>Orders placed before 2 PM ET on a business day ship the same day. Orders placed after 2 PM or on weekends ship the next business day.</p>
          </div>
        </div>
      </section>

      {/* Returns */}
      <section className="mb-10" data-testid="returns-policy">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Returns
        </h2>

        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <div data-testid="returns-window">
            <p className="font-semibold text-[color:var(--foreground)]">30-day return window</p>
            <p>We accept returns within 30 days of delivery on most items. Items must be unused, in original packaging, with all tags attached.</p>
          </div>

          <div data-testid="returns-exceptions">
            <p className="font-semibold text-[color:var(--foreground)]">Non-returnable items</p>
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>Custom or team-printed jerseys</li>
              <li>Skate blades that have been sharpened</li>
              <li>Clearance items marked final sale</li>
            </ul>
          </div>

          <div data-testid="returns-process">
            <p className="font-semibold text-[color:var(--foreground)]">How to return</p>
            <ol className="mt-1 list-decimal pl-5 space-y-1">
              <li>Find your order in <Link href="/orders" className="text-[color:var(--accent)] hover:opacity-80">My Orders</Link></li>
              <li>Select the item(s) you want to return</li>
              <li>Print the prepaid return label (free for defective items; $5.99 deducted for all other returns)</li>
              <li>Drop off at any UPS location</li>
            </ol>
          </div>

          <div data-testid="returns-refund">
            <p className="font-semibold text-[color:var(--foreground)]">Refunds</p>
            <p>Refunds are issued to the original payment method within 5–7 business days of us receiving your return.</p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section data-testid="shipping-contact">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Questions?
        </h2>
        <p className="text-sm text-[color:var(--muted)]">
          Reach our pro shop team at{" "}
          <a
            href="mailto:support@cheapshot.test"
            className="text-[color:var(--accent)] hover:opacity-80"
            data-testid="shipping-contact-email"
          >
            support@cheapshot.test
          </a>
          {" "}or use the contact form linked in the footer.
        </p>
      </section>
    </div>
  );
}

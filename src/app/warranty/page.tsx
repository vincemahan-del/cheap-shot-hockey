import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Warranty & Guarantee | Cheap Shot Hockey",
};

export default function WarrantyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10" data-testid="warranty-page">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 text-xs text-[color:var(--muted)]"
        data-testid="warranty-breadcrumbs"
      >
        <Link href="/" className="hover:text-[color:var(--foreground)]">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[color:var(--foreground)]">Warranty &amp; Guarantee</span>
      </nav>

      <h1 className="mb-2 font-black text-3xl" data-testid="warranty-heading">
        Warranty &amp; Guarantee
      </h1>
      <p className="mb-8 text-sm text-[color:var(--muted)]">
        Every piece of gear we sell is backed against manufacturing defects.
        Here is what is covered, for how long, and how to file a claim.
      </p>

      {/* Coverage */}
      <section className="mb-10" data-testid="warranty-coverage">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          What&apos;s covered
        </h2>
        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <div data-testid="warranty-coverage-defects">
            <p className="font-semibold text-[color:var(--foreground)]">Manufacturing defects</p>
            <p>Cracked blades, failed welds, separated boots, broken buckles, and stitching failures that occur under normal use are covered at no cost to you.</p>
          </div>

          <div data-testid="warranty-coverage-terms">
            <p className="font-semibold text-[color:var(--foreground)]">Coverage period by category</p>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-left text-[color:var(--muted)]">
                  <th className="py-2 pr-4 font-semibold">Category</th>
                  <th className="py-2 pr-4 font-semibold">Warranty period</th>
                  <th className="py-2 font-semibold">Covers</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[color:var(--border)]" data-testid="warranty-row-sticks">
                  <td className="py-2 pr-4">Sticks</td>
                  <td className="py-2 pr-4">30 days</td>
                  <td className="py-2">Blade &amp; shaft breakage</td>
                </tr>
                <tr className="border-b border-[color:var(--border)]" data-testid="warranty-row-skates">
                  <td className="py-2 pr-4">Skates</td>
                  <td className="py-2 pr-4">1 year</td>
                  <td className="py-2">Boot, holder &amp; rivets</td>
                </tr>
                <tr className="border-b border-[color:var(--border)]" data-testid="warranty-row-protective">
                  <td className="py-2 pr-4">Protective &amp; goalie</td>
                  <td className="py-2 pr-4">90 days</td>
                  <td className="py-2">Straps, buckles &amp; shells</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Exclusions */}
      <section className="mb-10" data-testid="warranty-exclusions">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          What&apos;s not covered
        </h2>
        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <div data-testid="warranty-exclusions-list">
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>Normal wear — sharpening, scuffs, lace and blade-tape replacement</li>
              <li>Damage from misuse, alteration, or improper sizing</li>
              <li>Clearance items marked final sale</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Claims */}
      <section className="mb-10" data-testid="warranty-claims">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          How to file a claim
        </h2>
        <div className="space-y-4 text-sm text-[color:var(--muted)]">
          <div data-testid="warranty-claims-process">
            <ol className="mt-1 list-decimal pl-5 space-y-1">
              <li>Find your order in <Link href="/orders" className="text-[color:var(--accent)] hover:opacity-80">My Orders</Link></li>
              <li>Select the affected item and choose &ldquo;File a warranty claim&rdquo;</li>
              <li>Upload a photo of the defect — most claims are reviewed within 2 business days</li>
              <li>Approved claims ship a replacement free of charge</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section data-testid="warranty-contact">
        <h2 className="mb-4 text-xl font-bold border-b border-[color:var(--border)] pb-2">
          Questions?
        </h2>
        <p className="text-sm text-[color:var(--muted)]">
          Reach our pro shop team at{" "}
          <a
            href="mailto:support@cheapshot.test"
            className="text-[color:var(--accent)] hover:opacity-80"
            data-testid="warranty-contact-email"
          >
            support@cheapshot.test
          </a>
          {" "}and we&apos;ll help you sort out a claim.
        </p>
      </section>
    </div>
  );
}

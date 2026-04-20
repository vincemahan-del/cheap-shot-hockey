import Link from "next/link";
import { brandColor } from "@/lib/brand";

const BRANDS = [
  "Apex",
  "Ironline",
  "Glacier",
  "Coldfire",
  "Northbound",
  "Saberline",
  "Strongside",
  "Crease Guardian",
];

export function BrandRow() {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[color:var(--muted)]">
          Top Brands
        </h2>
        <Link
          href="/products"
          className="text-xs text-[color:var(--muted)] hover:text-[color:var(--accent)]"
        >
          All brands →
        </Link>
      </div>
      <div
        className="grid grid-cols-4 gap-2 md:grid-cols-8"
        data-testid="brand-row"
      >
        {BRANDS.map((b) => (
          <Link
            key={b}
            href={`/products?brand=${encodeURIComponent(b)}`}
            data-testid={`brand-${b.toLowerCase().replace(/\s+/g, "-")}`}
            className="flex h-14 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-2)] px-2 text-center text-xs font-black uppercase tracking-wider transition hover:border-[color:var(--accent)]"
            style={{ color: brandColor(b) }}
          >
            {b}
          </Link>
        ))}
      </div>
    </section>
  );
}

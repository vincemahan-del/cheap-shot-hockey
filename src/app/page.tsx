import Link from "next/link";
import { listProducts } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import { categoryLabel } from "@/lib/format";

export default function Home() {
  const onSale = listProducts({ onSale: true }).slice(0, 8);
  const categories = [
    "sticks",
    "skates",
    "helmets",
    "gloves",
    "pads",
    "jerseys",
    "pucks",
    "goalie-gear",
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section
        className="mb-10 overflow-hidden rounded-xl border border-[color:var(--border)] bg-gradient-to-br from-[#1a2130] via-[#121826] to-[#0b0f16] p-8"
        data-testid="hero"
      >
        <div className="flex flex-col items-start gap-3">
          <span className="rounded-full bg-[color:var(--primary)]/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[color:var(--primary)]">
            Hockey gear at a fighting price
          </span>
          <h1 className="text-4xl font-black leading-tight md:text-5xl">
            Drop the gloves.
            <br />
            <span className="text-[color:var(--accent)]">Not your budget.</span>
          </h1>
          <p className="max-w-xl text-[color:var(--muted)]">
            Sticks, skates, pads, and goalie gear — marked down hard, shipped fast. Built for
            weekend warriors, junior leagues, and pros who like keeping money in the bank.
          </p>
          <div className="mt-2 flex gap-3">
            <Link
              href="/products?onSale=true"
              data-testid="hero-shop-deals"
              className="rounded bg-[color:var(--primary)] px-5 py-2.5 font-semibold text-white hover:opacity-90"
            >
              Shop the deals
            </Link>
            <Link
              href="/products"
              data-testid="hero-shop-all"
              className="rounded border border-[color:var(--border)] px-5 py-2.5 font-semibold hover:border-[color:var(--accent)]"
            >
              Browse all gear
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-bold">Shop by category</h2>
        <div
          className="grid grid-cols-2 gap-2 md:grid-cols-4"
          data-testid="category-grid"
        >
          {categories.map((c) => (
            <Link
              key={c}
              href={`/products?category=${c}`}
              data-testid={`category-${c}`}
              className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm font-semibold hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              {categoryLabel(c)}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">On sale now</h2>
          <Link
            href="/products?onSale=true"
            data-testid="see-all-deals"
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--accent)]"
          >
            See all →
          </Link>
        </div>
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-testid="featured-grid"
        >
          {onSale.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

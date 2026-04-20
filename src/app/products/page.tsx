import Link from "next/link";
import { listProducts } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import { categoryLabel } from "@/lib/format";

const CATEGORIES = [
  "sticks",
  "skates",
  "helmets",
  "gloves",
  "pads",
  "jerseys",
  "pucks",
  "goalie-gear",
  "accessories",
];

const POSITIONS: { value: string; label: string }[] = [
  { value: "player", label: "Players" },
  { value: "goalie", label: "Goalies" },
  { value: "any", label: "Any" },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    position?: string;
    brand?: string;
    q?: string;
    onSale?: string;
  }>;
}) {
  const sp = await searchParams;
  const items = listProducts({
    category: sp.category,
    position: sp.position,
    brand: sp.brand,
    search: sp.q,
    onSale: sp.onSale === "true" ? true : undefined,
  });
  const brands = Array.from(new Set(listProducts().map((p) => p.brand))).sort();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-3xl font-bold" data-testid="catalog-heading">
          {sp.category
            ? categoryLabel(sp.category)
            : sp.onSale === "true"
              ? "All Deals"
              : "All Products"}
        </h1>
        <span className="text-sm text-[color:var(--muted)]" data-testid="catalog-count">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        <aside className="space-y-6" data-testid="filters">
          <form action="/products" method="get">
            <label className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
              Search
            </label>
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="brand, name, keyword…"
              data-testid="filter-search-input"
              className="mt-1 w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm"
            />
            {sp.category && <input type="hidden" name="category" value={sp.category} />}
            {sp.position && <input type="hidden" name="position" value={sp.position} />}
            <button
              type="submit"
              data-testid="filter-search-submit"
              className="mt-2 w-full rounded bg-[color:var(--primary)] py-2 text-sm font-semibold text-white"
            >
              Search
            </button>
          </form>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
              Category
            </div>
            <ul className="space-y-1 text-sm">
              <li>
                <Link
                  href="/products"
                  data-testid="filter-category-all"
                  className={!sp.category ? "font-semibold text-[color:var(--accent)]" : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"}
                >
                  All categories
                </Link>
              </li>
              {CATEGORIES.map((c) => (
                <li key={c}>
                  <Link
                    href={`/products?category=${c}`}
                    data-testid={`filter-category-${c}`}
                    className={sp.category === c ? "font-semibold text-[color:var(--accent)]" : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"}
                  >
                    {categoryLabel(c)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
              Position
            </div>
            <ul className="space-y-1 text-sm">
              {POSITIONS.map((p) => (
                <li key={p.value}>
                  <Link
                    href={`/products?${new URLSearchParams({ ...(sp.category ? { category: sp.category } : {}), position: p.value }).toString()}`}
                    data-testid={`filter-position-${p.value}`}
                    className={sp.position === p.value ? "font-semibold text-[color:var(--accent)]" : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"}
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
              Brand
            </div>
            <ul className="space-y-1 text-sm">
              {brands.map((b) => (
                <li key={b}>
                  <Link
                    href={`/products?brand=${encodeURIComponent(b)}`}
                    data-testid={`filter-brand-${b.toLowerCase().replace(/\s+/g, "-")}`}
                    className={sp.brand === b ? "font-semibold text-[color:var(--accent)]" : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"}
                  >
                    {b}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <Link
            href="/products?onSale=true"
            data-testid="filter-on-sale"
            className="block rounded bg-[color:var(--primary)]/10 px-3 py-2 text-sm font-bold text-[color:var(--primary)] hover:bg-[color:var(--primary)]/20"
          >
            Show only sale items →
          </Link>
        </aside>

        <div>
          {items.length === 0 ? (
            <div
              className="rounded border border-dashed border-[color:var(--border)] p-8 text-center text-[color:var(--muted)]"
              data-testid="no-results"
            >
              No products match those filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

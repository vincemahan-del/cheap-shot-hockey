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
  const activeFilters: { label: string; href: string }[] = [];
  if (sp.category) activeFilters.push({ label: categoryLabel(sp.category), href: removeParam(sp, "category") });
  if (sp.brand) activeFilters.push({ label: sp.brand, href: removeParam(sp, "brand") });
  if (sp.position) activeFilters.push({ label: sp.position, href: removeParam(sp, "position") });
  if (sp.onSale === "true") activeFilters.push({ label: "On sale", href: removeParam(sp, "onSale") });
  if (sp.q) activeFilters.push({ label: `"${sp.q}"`, href: removeParam(sp, "q") });

  const title = sp.category
    ? categoryLabel(sp.category)
    : sp.onSale === "true"
      ? "All Deals"
      : sp.q
        ? `Results for "${sp.q}"`
        : "All Products";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Page header */}
      <div
        className="mb-6 rounded-xl border border-[color:var(--border)] bg-gradient-to-br from-[#131822] via-[#131822] to-[#0a0d13] p-6"
        data-testid="catalog-header"
      >
        <nav className="mb-2 text-xs text-[color:var(--muted)]">
          <Link href="/" className="hover:text-[color:var(--foreground)]">
            Home
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-[color:var(--foreground)]">{title}</span>
        </nav>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl md:text-4xl" data-testid="catalog-heading">
            {title}
          </h1>
          <span
            className="text-sm font-bold text-[color:var(--muted)]"
            data-testid="catalog-count"
          >
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </div>
        {activeFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="active-filters">
            {activeFilters.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-2)] px-3 py-1 text-xs font-semibold hover:bg-[color:var(--primary)]/20"
              >
                {f.label} <span aria-hidden>×</span>
              </Link>
            ))}
            <Link
              href="/products"
              className="text-xs font-semibold text-[color:var(--muted)] underline-offset-4 hover:text-[color:var(--primary)] hover:underline"
            >
              Clear all
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        <aside
          className="h-fit space-y-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
          data-testid="filters"
        >
          <form action="/products" method="get">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Search
            </label>
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="brand, name, keyword…"
              data-testid="filter-search-input"
              className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
            />
            {sp.category && <input type="hidden" name="category" value={sp.category} />}
            {sp.position && <input type="hidden" name="position" value={sp.position} />}
            <button
              type="submit"
              data-testid="filter-search-submit"
              className="mt-2 w-full rounded-md bg-[color:var(--primary)] py-2 text-sm font-bold uppercase tracking-wider text-white"
            >
              Search
            </button>
          </form>

          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Category
            </div>
            <ul className="space-y-1 text-sm">
              <li>
                <Link
                  href="/products"
                  data-testid="filter-category-all"
                  className={
                    !sp.category
                      ? "font-bold text-[color:var(--accent)]"
                      : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                  }
                >
                  All categories
                </Link>
              </li>
              {CATEGORIES.map((c) => (
                <li key={c}>
                  <Link
                    href={`/products?category=${c}`}
                    data-testid={`filter-category-${c}`}
                    className={
                      sp.category === c
                        ? "font-bold text-[color:var(--accent)]"
                        : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                    }
                  >
                    {categoryLabel(c)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Position
            </div>
            <ul className="space-y-1 text-sm">
              {POSITIONS.map((p) => (
                <li key={p.value}>
                  <Link
                    href={`/products?${new URLSearchParams({ ...(sp.category ? { category: sp.category } : {}), position: p.value }).toString()}`}
                    data-testid={`filter-position-${p.value}`}
                    className={
                      sp.position === p.value
                        ? "font-bold text-[color:var(--accent)]"
                        : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                    }
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Brand
            </div>
            <ul className="space-y-1 text-sm">
              {brands.map((b) => (
                <li key={b}>
                  <Link
                    href={`/products?brand=${encodeURIComponent(b)}`}
                    data-testid={`filter-brand-${b.toLowerCase().replace(/\s+/g, "-")}`}
                    className={
                      sp.brand === b
                        ? "font-bold text-[color:var(--accent)]"
                        : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                    }
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
            className="block rounded-md bg-[color:var(--primary)]/10 px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-[color:var(--primary)] hover:bg-[color:var(--primary)]/20"
          >
            Show only sale items →
          </Link>
        </aside>

        <div>
          {items.length === 0 ? (
            <div
              className="rounded-xl border border-dashed border-[color:var(--border)] p-14 text-center text-[color:var(--muted)]"
              data-testid="no-results"
            >
              <div className="mb-3 text-4xl">🔍</div>
              No products match those filters.
              <div className="mt-3">
                <Link
                  href="/products"
                  className="text-sm font-bold text-[color:var(--accent)] hover:underline"
                >
                  Clear filters
                </Link>
              </div>
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

function removeParam(
  sp: Record<string, string | undefined>,
  key: string,
): string {
  const rest = Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => k !== key && v != null),
  ) as Record<string, string>;
  const qs = new URLSearchParams(rest).toString();
  return qs ? `/products?${qs}` : "/products";
}

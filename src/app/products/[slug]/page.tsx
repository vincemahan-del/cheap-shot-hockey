import { notFound } from "next/navigation";
import Link from "next/link";
import { currentPrice, getProductBySlug, listProducts } from "@/lib/store";
import { ProductThumb } from "@/components/ProductThumb";
import { ProductCard } from "@/components/ProductCard";
import { AddToCartButton } from "@/components/AddToCartButton";
import { StarRating } from "@/components/StarRating";
import { categoryLabel, formatPrice } from "@/lib/format";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const onSale = product.salePriceCents != null;
  const priceNow = currentPrice(product);
  const savingsPct = onSale
    ? Math.round(((product.priceCents - product.salePriceCents!) / product.priceCents) * 100)
    : 0;
  const related = listProducts({ category: product.category })
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav
        aria-label="Breadcrumb"
        className="mb-5 text-xs text-[color:var(--muted)]"
        data-testid="breadcrumbs"
      >
        <Link href="/" className="hover:text-[color:var(--foreground)]">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <Link
          href={`/products?category=${product.category}`}
          className="hover:text-[color:var(--foreground)]"
        >
          {categoryLabel(product.category)}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[color:var(--foreground)]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.1fr_1fr]">
        {/* Gallery */}
        <div className="space-y-3">
          <ProductThumb
            slug={product.slug}
            name={product.name}
            category={product.category}
            brand={product.brand}
            size="lg"
          />
          {/* Thumbnail row — same illustration at different angles could be added, keep simple */}
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-2 opacity-75"
                data-testid={`gallery-thumb-${i}`}
              >
                <ProductThumb
                  slug={`${product.slug}-${i}`}
                  name={product.name}
                  category={product.category}
                  brand={product.brand}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Details */}
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
            <span className="text-[color:var(--accent)]">{product.brand}</span>
            <span>·</span>
            <span>{categoryLabel(product.category)}</span>
            {product.stock <= 6 && product.stock > 0 && (
              <span className="ml-auto rounded bg-amber-500/20 px-2 py-0.5 text-amber-400">
                Only {product.stock} left
              </span>
            )}
          </div>
          <h1
            className="font-display mt-2 text-3xl leading-tight md:text-4xl"
            data-testid="product-name"
          >
            {product.name}
          </h1>
          <div className="mt-2">
            <StarRating value={product.rating} count={Math.round(product.rating * 20)} />
          </div>
          <p
            className="mt-4 text-[color:var(--muted)]"
            data-testid="product-description"
          >
            {product.description}
          </p>

          <div className="mt-5 flex items-baseline gap-3">
            {onSale ? (
              <>
                <span
                  className="font-display text-4xl text-[color:var(--primary)]"
                  data-testid="product-price"
                >
                  {formatPrice(priceNow)}
                </span>
                <span className="text-lg text-[color:var(--muted)] line-through">
                  {formatPrice(product.priceCents)}
                </span>
                <span
                  className="rounded bg-[color:var(--primary)]/20 px-2 py-1 text-xs font-black uppercase tracking-wider text-[color:var(--primary)]"
                  data-testid="product-savings"
                >
                  SAVE {savingsPct}%
                </span>
              </>
            ) : (
              <span
                className="font-display text-4xl"
                data-testid="product-price"
              >
                {formatPrice(priceNow)}
              </span>
            )}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                Position
              </dt>
              <dd className="mt-0.5 capitalize" data-testid="product-position">
                {product.position}
              </dd>
            </div>
            {product.hand !== "n/a" && (
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                  Hand
                </dt>
                <dd className="mt-0.5 capitalize" data-testid="product-hand">
                  {product.hand}
                </dd>
              </div>
            )}
            {product.size && (
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                  Size
                </dt>
                <dd className="mt-0.5" data-testid="product-size">
                  {product.size}
                </dd>
              </div>
            )}
            {product.flex != null && (
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                  Flex
                </dt>
                <dd className="mt-0.5" data-testid="product-flex">
                  {product.flex}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                Rating
              </dt>
              <dd className="mt-0.5" data-testid="product-rating">
                {product.rating.toFixed(1)} / 5
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                In stock
              </dt>
              <dd className="mt-0.5" data-testid="product-stock">
                {product.stock}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <AddToCartButton productId={product.id} disabled={product.stock === 0} />
          </div>

          <ul className="mt-6 grid grid-cols-2 gap-3 text-xs text-[color:var(--muted)]">
            <li className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
              <div className="font-bold text-[color:var(--foreground)]">🚚 Free shipping</div>
              on orders over $99
            </li>
            <li className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
              <div className="font-bold text-[color:var(--foreground)]">↩️ Easy returns</div>
              30-day return window
            </li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display mb-4 text-2xl">You might also like</h2>
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            data-testid="related-grid"
          >
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

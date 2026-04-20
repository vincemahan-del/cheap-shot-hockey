import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/lib/store";
import { ProductThumb } from "@/components/ProductThumb";
import { AddToCartButton } from "@/components/AddToCartButton";
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
  const savingsPct = onSale
    ? Math.round(((product.priceCents - product.salePriceCents!) / product.priceCents) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 text-sm text-[color:var(--muted)]">
        <Link href="/products" className="hover:text-[color:var(--foreground)]">
          ← Back to all products
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <ProductThumb slug={product.slug} name={product.name} category={product.category} size="lg" />
        <div>
          <div className="text-sm uppercase tracking-wide text-[color:var(--muted)]">
            {product.brand} · {categoryLabel(product.category)}
          </div>
          <h1
            className="mt-1 text-3xl font-bold leading-tight"
            data-testid="product-name"
          >
            {product.name}
          </h1>
          <p
            className="mt-3 text-[color:var(--muted)]"
            data-testid="product-description"
          >
            {product.description}
          </p>

          <div className="mt-4 flex items-baseline gap-3">
            {onSale ? (
              <>
                <span
                  className="text-3xl font-black text-[color:var(--primary)]"
                  data-testid="product-price"
                >
                  {formatPrice(product.salePriceCents!)}
                </span>
                <span className="text-lg text-[color:var(--muted)] line-through">
                  {formatPrice(product.priceCents)}
                </span>
                <span
                  className="rounded bg-[color:var(--primary)]/20 px-2 py-0.5 text-xs font-bold text-[color:var(--primary)]"
                  data-testid="product-savings"
                >
                  SAVE {savingsPct}%
                </span>
              </>
            ) : (
              <span
                className="text-3xl font-black"
                data-testid="product-price"
              >
                {formatPrice(product.priceCents)}
              </span>
            )}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase text-[color:var(--muted)]">Position</dt>
              <dd className="capitalize" data-testid="product-position">
                {product.position}
              </dd>
            </div>
            {product.hand !== "n/a" && (
              <div>
                <dt className="text-xs uppercase text-[color:var(--muted)]">Hand</dt>
                <dd className="capitalize" data-testid="product-hand">
                  {product.hand}
                </dd>
              </div>
            )}
            {product.size && (
              <div>
                <dt className="text-xs uppercase text-[color:var(--muted)]">Size</dt>
                <dd data-testid="product-size">{product.size}</dd>
              </div>
            )}
            {product.flex != null && (
              <div>
                <dt className="text-xs uppercase text-[color:var(--muted)]">Flex</dt>
                <dd data-testid="product-flex">{product.flex}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase text-[color:var(--muted)]">Rating</dt>
              <dd data-testid="product-rating">{product.rating.toFixed(1)} / 5</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[color:var(--muted)]">In stock</dt>
              <dd data-testid="product-stock">{product.stock}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <AddToCartButton productId={product.id} disabled={product.stock === 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

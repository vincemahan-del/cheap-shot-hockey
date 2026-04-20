import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ProductThumb } from "./ProductThumb";
import { StarRating } from "./StarRating";

export function ProductCard({ product }: { product: Product }) {
  const onSale = product.salePriceCents != null;
  const savingsPct = onSale
    ? Math.round(
        ((product.priceCents - product.salePriceCents!) / product.priceCents) * 100,
      )
    : 0;
  return (
    <Link
      href={`/products/${product.slug}`}
      data-testid={`product-card-${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[0_1px_0_rgba(255,255,255,0.02)] transition hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)]"
    >
      {onSale && (
        <span
          className="absolute right-3 top-3 z-10 rounded-md bg-[color:var(--primary)] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg"
          data-testid={`sale-badge-${product.slug}`}
        >
          −{savingsPct}%
        </span>
      )}
      {product.stock <= 6 && product.stock > 0 && (
        <span className="absolute left-3 top-3 z-10 rounded-md bg-amber-500/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
          Low stock
        </span>
      )}
      <div className="px-3 pt-3">
        <ProductThumb
          slug={product.slug}
          name={product.name}
          category={product.category}
          brand={product.brand}
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
          <span className="font-bold">{product.brand}</span>
          {product.position !== "any" && (
            <span className="rounded bg-[color:var(--surface-2)] px-1.5 py-0.5">
              {product.position}
            </span>
          )}
        </div>
        <div className="mt-1 line-clamp-2 min-h-[2.75rem] font-bold leading-snug group-hover:text-[color:var(--accent)]">
          {product.name}
        </div>
        <div className="mt-2">
          <StarRating value={product.rating} />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          {onSale ? (
            <>
              <span
                className="text-lg font-black text-[color:var(--primary)]"
                data-testid={`price-${product.slug}`}
              >
                {formatPrice(product.salePriceCents!)}
              </span>
              <span className="text-sm text-[color:var(--muted)] line-through">
                {formatPrice(product.priceCents)}
              </span>
            </>
          ) : (
            <span
              className="text-lg font-black"
              data-testid={`price-${product.slug}`}
            >
              {formatPrice(product.priceCents)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

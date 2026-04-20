import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ProductThumb } from "./ProductThumb";

export function ProductCard({ product }: { product: Product }) {
  const onSale = product.salePriceCents != null;
  return (
    <Link
      href={`/products/${product.slug}`}
      data-testid={`product-card-${product.slug}`}
      className="group flex flex-col rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 transition hover:border-[color:var(--accent)]"
    >
      <ProductThumb slug={product.slug} name={product.name} category={product.category} />
      <div className="mt-3 flex-1">
        <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
          {product.brand}
        </div>
        <div className="mt-0.5 line-clamp-2 font-semibold group-hover:text-[color:var(--accent)]">
          {product.name}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {onSale ? (
          <>
            <span
              className="text-lg font-bold text-[color:var(--primary)]"
              data-testid={`price-${product.slug}`}
            >
              {formatPrice(product.salePriceCents!)}
            </span>
            <span className="text-sm text-[color:var(--muted)] line-through">
              {formatPrice(product.priceCents)}
            </span>
            <span className="ml-auto rounded bg-[color:var(--primary)]/20 px-1.5 py-0.5 text-xs font-bold text-[color:var(--primary)]">
              SALE
            </span>
          </>
        ) : (
          <span
            className="text-lg font-bold"
            data-testid={`price-${product.slug}`}
          >
            {formatPrice(product.priceCents)}
          </span>
        )}
      </div>
    </Link>
  );
}

import type { Category } from "@/lib/types";
import { categoryLabel } from "@/lib/format";
import { brandColor } from "@/lib/brand";

export function ProductThumb({
  slug,
  name,
  category,
  brand,
  size = "md",
}: {
  slug: string;
  name: string;
  category: Category;
  brand?: string;
  size?: "sm" | "md" | "lg";
}) {
  const color = brand ? brandColor(brand) : "#9aa3b2";
  const label = categoryLabel(category);
  const height = size === "sm" ? 120 : size === "lg" ? 420 : 220;
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-[color:var(--border)] bg-[#0f1420]"
      style={{ height }}
      aria-label={`${name} photo`}
      data-testid={`thumb-${slug}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/product-photos/${category}.jpg`}
        alt={name}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: "brightness(0.92) saturate(1.05) contrast(1.03)" }}
      />
      {/* Gradient overlay for polish */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent"
        aria-hidden="true"
      />
      {/* Brand color accent glow */}
      <div
        className="absolute -top-10 -right-10 h-28 w-28 rounded-full blur-3xl"
        style={{ background: color, opacity: 0.35 }}
        aria-hidden="true"
      />
      {/* Category badge */}
      <div
        className="absolute bottom-2 left-2 rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
        style={{ background: `${color}e6`, color: "#0a0d13" }}
      >
        {label}
      </div>
    </div>
  );
}

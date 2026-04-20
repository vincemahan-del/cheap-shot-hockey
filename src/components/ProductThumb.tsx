import type { Category } from "@/lib/types";
import { categoryLabel } from "@/lib/format";
import { brandColor } from "@/lib/brand";
import { ProductIllustration } from "./ProductIllustration";

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
  const height = size === "sm" ? 120 : size === "lg" ? 380 : 220;
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-[color:var(--border)]"
      style={{
        height,
        background:
          "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.06), rgba(0,0,0,0) 60%), linear-gradient(180deg, #151b27 0%, #0b0f16 100%)",
      }}
      aria-label={`${name} illustration`}
      data-testid={`thumb-${slug}`}
    >
      {/* subtle corner accent */}
      <div
        className="absolute -top-8 -left-8 h-32 w-32 rounded-full blur-3xl"
        style={{ background: color, opacity: 0.18 }}
        aria-hidden="true"
      />
      <div className="absolute inset-4 flex items-center justify-center">
        <ProductIllustration category={category} color={color} accent="#0b0f16" />
      </div>
      <div
        className="absolute bottom-2 left-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ background: `${color}25`, color }}
      >
        {label}
      </div>
    </div>
  );
}

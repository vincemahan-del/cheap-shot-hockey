import { categoryColor, categoryLabel } from "@/lib/format";

export function ProductThumb({
  slug,
  name,
  category,
  size = "md",
}: {
  slug: string;
  name: string;
  category: string;
  size?: "sm" | "md" | "lg";
}) {
  const color = categoryColor(category);
  const label = categoryLabel(category);
  const height = size === "sm" ? 120 : size === "lg" ? 320 : 200;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{
        height,
        background: `linear-gradient(135deg, ${color}22, ${color}66)`,
        border: `1px solid ${color}44`,
      }}
      aria-label={`${name} thumbnail`}
      data-testid={`thumb-${slug}`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-6xl font-black tracking-tight"
          style={{ color: `${color}cc` }}
        >
          {initials}
        </span>
      </div>
      <div
        className="absolute bottom-2 left-2 rounded px-2 py-0.5 text-xs font-medium"
        style={{ background: `${color}33`, color }}
      >
        {label}
      </div>
    </div>
  );
}

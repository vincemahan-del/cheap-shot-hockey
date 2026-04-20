import Link from "next/link";
import type { Category } from "@/lib/types";
import { ProductIllustration } from "./ProductIllustration";

const TILES: { category: Category; label: string; blurb: string; color: string }[] = [
  { category: "sticks", label: "Sticks", blurb: "Composite · Wood · Youth → Senior", color: "#f03e3e" },
  { category: "skates", label: "Skates", blurb: "Player · Goalie · Every fit", color: "#4a78b5" },
  { category: "helmets", label: "Helmets", blurb: "HECC certified · Cage-ready", color: "#e8783a" },
  { category: "gloves", label: "Gloves", blurb: "Protection · Grip · Mobility", color: "#7b5fd6" },
  { category: "pads", label: "Protective", blurb: "Shin · Shoulder · Elbow", color: "#3d8f6b" },
  { category: "jerseys", label: "Jerseys", blurb: "Home · Away · Practice", color: "#d63d3d" },
  { category: "pucks", label: "Pucks", blurb: "Game · Practice · Novelty", color: "#9aa3b2" },
  { category: "goalie-gear", label: "Goalie Gear", blurb: "Pads · Mask · Catcher · Blocker", color: "#f0cb44" },
];

export function CategoryTiles() {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
      data-testid="category-grid"
    >
      {TILES.map((t) => (
        <Link
          key={t.category}
          href={`/products?category=${t.category}`}
          data-testid={`category-${t.category}`}
          className="group relative flex flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--accent)]"
        >
          <div className="h-28 w-full">
            <ProductIllustration category={t.category} color={t.color} />
          </div>
          <div className="mt-3">
            <div className="font-bold group-hover:text-[color:var(--accent)]">
              {t.label}
            </div>
            <div className="text-xs text-[color:var(--muted)]">{t.blurb}</div>
          </div>
          <span
            className="absolute right-3 top-3 text-xs text-[color:var(--muted)] transition group-hover:text-[color:var(--accent)]"
            aria-hidden="true"
          >
            →
          </span>
        </Link>
      ))}
    </div>
  );
}

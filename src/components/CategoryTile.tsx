import Link from "next/link";
import type { Category } from "@/lib/types";

const TILES: { category: Category; label: string; blurb: string }[] = [
  { category: "sticks", label: "Sticks", blurb: "Composite · Wood · Youth → Senior" },
  { category: "skates", label: "Skates", blurb: "Player · Goalie · Every fit" },
  { category: "helmets", label: "Helmets", blurb: "HECC certified · Cage-ready" },
  { category: "gloves", label: "Gloves", blurb: "Protection · Grip · Mobility" },
  { category: "pads", label: "Protective", blurb: "Shin · Shoulder · Elbow" },
  { category: "jerseys", label: "Jerseys", blurb: "Home · Away · Practice" },
  { category: "pucks", label: "Pucks", blurb: "Game · Practice · Novelty" },
  { category: "goalie-gear", label: "Goalie Gear", blurb: "Pads · Mask · Catcher · Blocker" },
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
          className="group relative flex flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] transition hover:-translate-y-0.5 hover:border-[color:var(--accent)]"
        >
          <div className="relative h-36 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/product-photos/${t.category}.jpg`}
              alt={t.label}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              style={{ filter: "brightness(0.85) saturate(1.05)" }}
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
              aria-hidden="true"
            />
            <span
              className="absolute right-3 top-3 text-sm text-white/80 transition group-hover:text-[color:var(--accent)]"
              aria-hidden="true"
            >
              →
            </span>
          </div>
          <div className="p-4">
            <div className="font-black group-hover:text-[color:var(--accent)]">
              {t.label}
            </div>
            <div className="mt-0.5 text-xs text-[color:var(--muted)]">
              {t.blurb}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

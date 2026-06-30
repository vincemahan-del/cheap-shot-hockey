import { convertToRegionCents, regionConfig, type Region } from "./region";

/**
 * Format a USD base-cents amount as currency for the given region.
 *
 * Region drives display only: the amount is converted to the region's currency
 * (FX multiplier) and formatted with that currency + number locale. Defaults to
 * the US ("$199.99"); Canada renders the disambiguating "CA$" symbol. See
 * src/lib/region.ts for why CAD is formatted with an en-US base locale.
 */
export function formatPrice(usdCents: number, region: Region = "us"): string {
  const cfg = regionConfig(region);
  const amount = convertToRegionCents(usdCents, region) / 100;
  return new Intl.NumberFormat(cfg.numberLocale, {
    style: "currency",
    currency: cfg.currency,
  }).format(amount);
}

export function categoryLabel(category: string): string {
  switch (category) {
    case "goalie-gear":
      return "Goalie Gear";
    case "sticks":
      return "Sticks";
    case "skates":
      return "Skates";
    case "helmets":
      return "Helmets";
    case "gloves":
      return "Gloves";
    case "pads":
      return "Pads";
    case "jerseys":
      return "Jerseys";
    case "pucks":
      return "Pucks";
    case "accessories":
      return "Accessories";
    default:
      return category;
  }
}

export function categoryColor(category: string): string {
  switch (category) {
    case "sticks":
      return "#ffc857";
    case "skates":
      return "#60a5fa";
    case "helmets":
      return "#f97316";
    case "gloves":
      return "#a78bfa";
    case "pads":
      return "#34d399";
    case "jerseys":
      return "#f87171";
    case "pucks":
      return "#94a3b8";
    case "goalie-gear":
      return "#22d3ee";
    case "accessories":
      return "#fbbf24";
    default:
      return "#9aa3b2";
  }
}

// throwaway: CI re-validation of clean engine comment (TAMD-186) — DO NOT MERGE

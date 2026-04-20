export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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

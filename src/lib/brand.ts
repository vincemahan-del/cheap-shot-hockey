export function brandColor(brand: string): string {
  switch (brand.toLowerCase()) {
    case "apex":
      return "#d63d3d";
    case "ironline":
      return "#4a78b5";
    case "glacier":
      return "#5abfd6";
    case "coldfire":
      return "#e8783a";
    case "northbound":
      return "#3d8f6b";
    case "saberline":
      return "#7b5fd6";
    case "strongside":
      return "#d6a23d";
    case "crease guardian":
      return "#f0cb44";
    case "cheap shot":
      return "#f03e3e";
    default:
      return "#9aa3b2";
  }
}

export function brandAccent(brand: string): string {
  return `${brandColor(brand)}`;
}

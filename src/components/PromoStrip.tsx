import { headers } from "next/headers";
import { formatPrice } from "@/lib/format";
import { readRegion, shippingConfig } from "@/lib/region";

// Seasonal copy: rotate the desktop-only badge each season (TAMD-155).
export async function PromoStrip() {
  const region = readRegion(await headers());
  const freeShip = formatPrice(shippingConfig(region).freeShipThresholdCents, region);
  return (
    <div
      data-testid="promo-strip"
      className="w-full border-b border-[color:var(--border)] bg-[color:var(--surface-2)]"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
        <span>🏒 Free shipping on orders {freeShip}+</span>
        <span className="hidden md:inline">🏆 Cup Final — orders ship in 24h</span>
        <span>30-day returns · Easy exchanges</span>
      </div>
    </div>
  );
}

// Dual-region (US + Canada) configuration and money math.
//
// Design (TAMD-171): every price and order amount is stored and computed in
// **USD base cents**. Region affects only three things at the edges:
//   1. the sales-tax RATE (US flat vs Canadian GST/PST by province),
//   2. the shipping config (flat cost + free-ship threshold), and
//   3. DISPLAY — an FX multiplier + currency + number locale.
//
// Because tax is a percentage, converting at display time is consistent:
//   display_tax = (subtotal_usd * rate) * fx === (subtotal_usd * fx) * rate
// so there is never a double-conversion hazard. Orders persist `region` so
// historical orders render in the currency they were placed in.

import type { Region } from "./types";
export type { Region };

export const REGION_HEADER = "x-csh-region";
export const REGION_COOKIE = "csh_region";

export interface RegionConfig {
  region: Region;
  /** ISO 4217 currency code used for Intl formatting. */
  currency: string;
  /**
   * Locale passed to Intl.NumberFormat for currency display. We deliberately
   * format CAD with an en-US base so the symbol disambiguates as "CA$1,234.56"
   * — Canada's own en-CA locale renders CAD as a bare "$", which is
   * indistinguishable from USD and defeats the i18n demo. The bilingual ticket
   * (TAMD-172) switches this to fr-CA ("1 234,56 $") when language === "fr".
   */
  numberLocale: string;
  /** Multiplier applied to USD base cents for display only. */
  fxMultiplier: number;
  /** Free-shipping threshold, expressed in USD base cents. */
  freeShipThresholdCents: number;
  /** Flat shipping cost, expressed in USD base cents. */
  shippingCents: number;
}

export const REGIONS: Record<Region, RegionConfig> = {
  us: {
    region: "us",
    currency: "USD",
    numberLocale: "en-US",
    fxMultiplier: 1,
    freeShipThresholdCents: 9900,
    shippingCents: 999,
  },
  ca: {
    region: "ca",
    currency: "CAD",
    numberLocale: "en-US",
    fxMultiplier: 1.35,
    freeShipThresholdCents: 12900,
    shippingCents: 1499,
  },
};

export const DEFAULT_REGION: Region = "us";

const US_TAX_RATE = 0.08;

/**
 * Combined sales tax (GST + PST, or HST) by Canadian province/territory code.
 * Demo values — close enough to be believable, not legal advice.
 */
const CA_TAX_RATES: Record<string, number> = {
  AB: 0.05, // GST only
  BC: 0.12,
  MB: 0.12,
  NB: 0.15,
  NL: 0.15,
  NS: 0.15,
  NT: 0.05,
  NU: 0.05,
  ON: 0.13,
  PE: 0.15,
  QC: 0.14975,
  SK: 0.11,
  YT: 0.05,
};

/** Province used for the checkout-summary preview before an address is entered. */
export const CA_DEFAULT_PROVINCE = "ON";

/** Coerce arbitrary header/cookie/query input to a known Region. */
export function parseRegion(value: string | null | undefined): Region {
  return (value ?? "").trim().toLowerCase() === "ca" ? "ca" : "us";
}

/** Read the region resolved by middleware from the request headers. */
export function readRegion(headers: Headers): Region {
  return parseRegion(headers.get(REGION_HEADER));
}

export function regionConfig(region: Region): RegionConfig {
  return REGIONS[region] ?? REGIONS[DEFAULT_REGION];
}

export function normalizeProvince(input: string | null | undefined): string {
  return (input ?? "").trim().toUpperCase();
}

/**
 * Sales-tax rate for a region. For Canada, the province (an address `state`
 * code) selects the GST/PST rate; an unknown/blank province falls back to the
 * default province so the math never NaNs.
 */
export function taxRate(region: Region, province?: string | null): number {
  if (region !== "ca") return US_TAX_RATE;
  const code = normalizeProvince(province);
  return CA_TAX_RATES[code] ?? CA_TAX_RATES[CA_DEFAULT_PROVINCE];
}

/** Convert USD base cents to the region's display cents (display only). */
export function convertToRegionCents(usdCents: number, region: Region): number {
  const safe = Number.isFinite(usdCents) ? usdCents : 0;
  return Math.round(safe * regionConfig(region).fxMultiplier);
}

/** Free-ship threshold and flat shipping cost, in USD base cents. */
export function shippingConfig(region: Region): {
  freeShipThresholdCents: number;
  shippingCents: number;
} {
  const cfg = regionConfig(region);
  return {
    freeShipThresholdCents: cfg.freeShipThresholdCents,
    shippingCents: cfg.shippingCents,
  };
}

/**
 * Shipping charge (USD base cents) for a subtotal: free once the region's
 * threshold is met, free for an empty cart, otherwise the flat rate.
 */
export function shippingForSubtotal(region: Region, subtotalCents: number): number {
  if (subtotalCents <= 0) return 0;
  const { freeShipThresholdCents, shippingCents } = shippingConfig(region);
  return subtotalCents >= freeShipThresholdCents ? 0 : shippingCents;
}

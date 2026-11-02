// Promo codes (TAMD-245). Codes are evaluated against the USD base-cents
// subtotal; region gates eligibility and drives tax/shipping like region.ts.
// The applied code lives in the `csh_promo` cookie (see promo-cookie.ts) and
// is re-evaluated on every read, so a cart change can invalidate it.

import type { Region } from "./types";
import { formatPrice } from "./format";
import { shippingForSubtotal, taxRate } from "./region";

export type PromoKind = "percent" | "amount" | "free_shipping";

export interface PromoDefinition {
  code: string;
  kind: PromoKind;
  /** Percent off (0–100) for "percent"; USD base cents for "amount"; unused for "free_shipping". */
  value: number;
  description: string;
  minSubtotalCents?: number;
  regions?: Region[];
  expiresAt?: string;
}

export const PROMOS: PromoDefinition[] = [
  { code: "HATTRICK", kind: "percent", value: 15, description: "15% off your order" },
  {
    code: "BARDOWN",
    kind: "amount",
    value: 2000,
    minSubtotalCents: 15000,
    description: "$20 off orders of $150 or more",
  },
  { code: "FREESHIP", kind: "free_shipping", value: 0, description: "Free shipping" },
  {
    code: "EH10",
    kind: "percent",
    value: 10,
    regions: ["ca"],
    description: "10% off for Canadian orders",
  },
  {
    code: "PLAYOFFS25",
    kind: "percent",
    value: 25,
    expiresAt: "2026-06-30T23:59:59Z",
    description: "25% off playoff gear",
  },
];

export type PromoRejection = "empty" | "unknown" | "expired" | "region" | "min_subtotal";

export type PromoResult =
  | { ok: true; promo: PromoDefinition; discountCents: number; freeShipping: boolean }
  | { ok: false; code: string; reason: PromoRejection; minSubtotalCents?: number };

const MAX_CODE_LENGTH = 32;

/** Uppercase and strip whitespace so " hat trick " matches HATTRICK. */
export function normalizePromoCode(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/\s+/g, "").toUpperCase().slice(0, MAX_CODE_LENGTH);
}

export function findPromo(code: string): PromoDefinition | undefined {
  const normalized = normalizePromoCode(code);
  return PROMOS.find((p) => p.code === normalized);
}

export function evaluatePromo(
  rawCode: unknown,
  ctx: { subtotalCents: number; region: Region; now?: Date },
): PromoResult {
  const code = normalizePromoCode(rawCode);
  if (!code) return { ok: false, code, reason: "empty" };

  const promo = findPromo(code);
  if (!promo) return { ok: false, code, reason: "unknown" };

  const now = ctx.now ?? new Date();
  if (promo.expiresAt && now.getTime() > Date.parse(promo.expiresAt)) {
    return { ok: false, code, reason: "expired" };
  }
  if (promo.regions && !promo.regions.includes(ctx.region)) {
    return { ok: false, code, reason: "region" };
  }

  const subtotal = Number.isFinite(ctx.subtotalCents) ? Math.max(0, ctx.subtotalCents) : 0;
  if (promo.minSubtotalCents && subtotal < promo.minSubtotalCents) {
    return { ok: false, code, reason: "min_subtotal", minSubtotalCents: promo.minSubtotalCents };
  }

  let discountCents = 0;
  if (promo.kind === "percent") discountCents = Math.round((subtotal * promo.value) / 100);
  if (promo.kind === "amount") discountCents = Math.min(promo.value, subtotal);

  return { ok: true, promo, discountCents, freeShipping: promo.kind === "free_shipping" };
}

/** English message for API responses; the UI localizes from `reason` instead. */
export function promoRejectionMessage(
  result: Extract<PromoResult, { ok: false }>,
  region: Region,
): string {
  switch (result.reason) {
    case "empty":
      return "promo code is required";
    case "unknown":
      return `promo code ${result.code} is not valid`;
    case "expired":
      return `promo code ${result.code} has expired`;
    case "region":
      return `promo code ${result.code} is not available in this region`;
    case "min_subtotal":
      return `promo code ${result.code} requires a subtotal of at least ${formatPrice(
        result.minSubtotalCents ?? 0,
        region,
      )}`;
  }
}

export interface PriceQuote {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  promoCode: string | null;
}

/**
 * Single source of truth for order math (USD base cents). Tax applies to the
 * discounted subtotal; the free-shipping threshold uses the pre-discount
 * subtotal so a code never pushes a customer back into paid shipping.
 */
export function priceOrder(input: {
  subtotalCents: number;
  region: Region;
  province?: string | null;
  promo?: PromoResult | null;
}): PriceQuote {
  const { subtotalCents, region, province } = input;
  const applied = input.promo?.ok ? input.promo : null;
  const discountCents = applied?.discountCents ?? 0;
  const taxCents = Math.round((subtotalCents - discountCents) * taxRate(region, province));
  const shippingCents = applied?.freeShipping ? 0 : shippingForSubtotal(region, subtotalCents);
  return {
    subtotalCents,
    discountCents,
    taxCents,
    shippingCents,
    totalCents: subtotalCents - discountCents + taxCents + shippingCents,
    promoCode: applied?.promo.code ?? null,
  };
}

export const FREE_SHIP_THRESHOLD_CENTS = 9900;

export interface FreeShippingProgress {
  qualified: boolean;
  remainingCents: number;
  progressPercent: number;
}

/**
 * Compute progress toward the free-shipping threshold.
 *
 * Boundaries (matches the inline math previously in src/app/cart/page.tsx):
 *   subtotal 0          -> 0%, $99 remaining, not qualified
 *   subtotal $98.99     -> ~100% (Math.round of 99.989%), $0.01 remaining, not qualified
 *   subtotal $99        -> 100%, $0 remaining, qualified
 *   subtotal > $99      -> 100%, $0 remaining, qualified
 *
 * Non-finite / negative / NaN subtotals are coerced to 0 so the bar never goes
 * negative or NaN — mirrors how the inline expression `Math.min(100, ...)`
 * combined with `Math.max(0, ...)` was already absorbing odd inputs.
 */
export function freeShippingProgress(
  subtotalCents: number,
  thresholdCents: number = FREE_SHIP_THRESHOLD_CENTS,
): FreeShippingProgress {
  const safeSubtotal =
    Number.isFinite(subtotalCents) && subtotalCents > 0 ? subtotalCents : 0;
  const safeThreshold =
    Number.isFinite(thresholdCents) && thresholdCents > 0
      ? thresholdCents
      : FREE_SHIP_THRESHOLD_CENTS;

  const qualified = safeSubtotal >= safeThreshold;
  const remainingCents = qualified ? 0 : safeThreshold - safeSubtotal;
  const progressPercent = qualified
    ? 100
    : Math.min(100, Math.round((safeSubtotal / safeThreshold) * 100));

  return { qualified, remainingCents, progressPercent };
}

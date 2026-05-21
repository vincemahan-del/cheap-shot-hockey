// Banner visibility window. The actual sale runs May 23–25, but the
// announcement goes live as a teaser from May 21 (ship date). Auto-takedown
// closes the window at 23:59:59 on May 25 — no manual revert needed.
//
// The render decision is split into two pure helpers so future seasonal
// banners (July 4th, Black Friday, Christmas, etc.) can reuse the same
// (window + dismiss-flag) → boolean pattern without dragging React into
// the unit test layer.

export const MEMORIAL_DAY_DISMISS_KEY = "csh_memday_dismissed_2026";

const CAMPAIGN_START = Date.UTC(2026, 4, 21, 0, 0, 0);
const CAMPAIGN_END = Date.UTC(2026, 4, 25, 23, 59, 59);

export function isMemorialDayCampaignActive(now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= CAMPAIGN_START && t <= CAMPAIGN_END;
}

export function shouldShowMemorialDayBanner(
  now: Date,
  dismissed: boolean,
): boolean {
  if (dismissed) return false;
  return isMemorialDayCampaignActive(now);
}

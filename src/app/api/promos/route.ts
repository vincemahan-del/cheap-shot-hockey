import type { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { parseLocale, readLocale } from "@/lib/locale";
import { getActivePromos } from "@/lib/promos";
import { FREE_SHIP_THRESHOLD_CENTS } from "@/lib/shipping";

/**
 * GET /api/promos?locale=en|fr
 * Active promo-strip messages. Locale comes from the query string, else the
 * request's locale header/cookie, else English.
 */
export async function GET(req: NextRequest) {
  const locale = parseLocale(req.nextUrl.searchParams.get("locale") ?? readLocale(req.headers));
  const promos = getActivePromos(locale, { amount: `$${FREE_SHIP_THRESHOLD_CENTS / 100}` });
  return ok({ locale, count: promos.length, promos });
}

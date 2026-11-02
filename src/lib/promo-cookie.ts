import { cookies } from "next/headers";
import { normalizePromoCode } from "./promo";

const PROMO_COOKIE = "csh_promo";

export async function readPromoCode(): Promise<string | null> {
  const jar = await cookies();
  const code = normalizePromoCode(jar.get(PROMO_COOKIE)?.value);
  return code || null;
}

export async function writePromoCode(code: string): Promise<void> {
  const jar = await cookies();
  jar.set(PROMO_COOKIE, normalizePromoCode(code), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearPromoCode(): Promise<void> {
  const jar = await cookies();
  jar.delete(PROMO_COOKIE);
}

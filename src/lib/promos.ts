import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { parseLocale, type Locale } from "./locale";

export interface PromoMessage {
  key: string;
  text: string;
}

const MESSAGES: Record<Locale, Record<string, string>> = {
  en: en.promo,
  fr: fr.promo,
};

/** Replace `{name}` tokens with values from `vars`; unknown tokens are left as-is. */
export function formatPromo(text: string, vars: Record<string, string> = {}): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match,
  );
}

/**
 * Active promo-strip messages for a locale, in display order.
 * Unknown locales fall back to English via parseLocale.
 */
export function getActivePromos(
  locale: string | null | undefined,
  vars: Record<string, string> = {},
): PromoMessage[] {
  const resolved = parseLocale(locale);
  return Object.entries(MESSAGES[resolved]).map(([key, text]) => ({
    key,
    text: formatPromo(text, vars),
  }));
}

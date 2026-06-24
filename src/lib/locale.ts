// Language axis (TAMD-172), independent of region (TAMD-171).
//
// Region drives currency/tax; locale drives the next-intl message catalog.
// They are decoupled because Quebec breaks a single toggle: QC = region "ca" +
// locale "fr" (CAD + French), while Ontario = region "ca" + locale "en" (CAD +
// English). Same query→cookie→header plumbing as region and demo mode.

export type Locale = "en" | "fr";

export const LOCALE_HEADER = "x-csh-lang";
export const LOCALE_COOKIE = "csh_lang";
export const LOCALES: Locale[] = ["en", "fr"];
export const DEFAULT_LOCALE: Locale = "en";

/** Coerce arbitrary header/cookie/query input to a supported Locale. */
export function parseLocale(value: string | null | undefined): Locale {
  return (value ?? "").trim().toLowerCase() === "fr" ? "fr" : "en";
}

/** Read the locale resolved by middleware from the request headers. */
export function readLocale(headers: Headers): Locale {
  return parseLocale(headers.get(LOCALE_HEADER));
}

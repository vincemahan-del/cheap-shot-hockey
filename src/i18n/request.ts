import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { readLocale } from "@/lib/locale";

// next-intl "without i18n routing" setup: the active locale is resolved from
// the x-csh-lang header that middleware sets (query→cookie→Quebec geo→Accept-
// Language→en). No [locale] route segment, so the whole app stays on flat URLs
// and the same query→cookie→header plumbing as region/demo mode.
export default getRequestConfig(async () => {
  const locale = readLocale(await headers());
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

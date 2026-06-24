"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/locale";

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "en", label: "EN" },
  { locale: "fr", label: "FR" },
];

/**
 * Language toggle (TAMD-172). Writes `?lang=` onto the current URL; middleware
 * reads it, persists the `csh_lang` cookie, and next-intl re-renders the app in
 * that language. Independent of region — Quebec is region=ca + lang=fr. The
 * explicit override always beats geo/Accept-Language, keeping the demo and mabl
 * runs deterministic.
 */
export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(locale: Locale) {
    if (locale === current) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", locale);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <div
      data-testid="lang-switcher"
      className="inline-flex overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-xs font-bold"
    >
      {OPTIONS.map((o) => {
        const active = o.locale === current;
        return (
          <button
            key={o.locale}
            type="button"
            onClick={() => select(o.locale)}
            data-testid={`lang-option-${o.locale}`}
            aria-pressed={active}
            className={
              active
                ? "bg-[color:var(--accent)] px-2 py-1 text-white"
                : "px-2 py-1 text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

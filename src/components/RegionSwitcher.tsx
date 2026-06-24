"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Region } from "@/lib/types";

const OPTIONS: { region: Region; label: string; flag: string }[] = [
  { region: "us", label: "US", flag: "🇺🇸" },
  { region: "ca", label: "CA", flag: "🇨🇦" },
];

/**
 * Region toggle (TAMD-171). Writes `?region=` onto the current URL; middleware
 * reads it, persists the `csh_region` cookie, and re-renders the app in that
 * region (currency + tax). The explicit override always beats geo-IP, which is
 * what makes the live demo and mabl runs deterministic.
 */
export function RegionSwitcher({ current }: { current: Region }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(region: Region) {
    if (region === current) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("region", region);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <div
      data-testid="region-switcher"
      className="inline-flex overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-xs font-bold"
    >
      {OPTIONS.map((o) => {
        const active = o.region === current;
        return (
          <button
            key={o.region}
            type="button"
            onClick={() => select(o.region)}
            data-testid={`region-option-${o.region}`}
            aria-pressed={active}
            className={
              active
                ? "bg-[color:var(--primary)] px-2 py-1 text-white"
                : "px-2 py-1 text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            }
          >
            <span aria-hidden="true">{o.flag}</span> {o.label}
          </button>
        );
      })}
    </div>
  );
}

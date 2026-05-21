"use client";

import { useSyncExternalStore } from "react";
import {
  shouldShowMemorialDayBanner,
  MEMORIAL_DAY_DISMISS_KEY,
} from "@/lib/memorial-day";

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readDismissed() {
  return window.localStorage.getItem(MEMORIAL_DAY_DISMISS_KEY) === "1";
}

// SSR + first client render: treat as dismissed so nothing renders until
// React swaps to the real client snapshot post-hydration. Avoids the
// flash-of-banner-then-hide and avoids set-state-in-effect.
function readDismissedServer() {
  return true;
}

export function MemorialDayBanner() {
  const dismissed = useSyncExternalStore(
    subscribeToStorage,
    readDismissed,
    readDismissedServer,
  );

  if (!shouldShowMemorialDayBanner(new Date(), dismissed)) return null;

  const dismiss = () => {
    window.localStorage.setItem(MEMORIAL_DAY_DISMISS_KEY, "1");
    // useSyncExternalStore listens for "storage" events, which only fire
    // across tabs — dispatch one manually so this tab re-renders too.
    window.dispatchEvent(new StorageEvent("storage"));
  };

  return (
    <div
      data-testid="memorial-day-banner"
      role="region"
      aria-label="Memorial Day sale announcement"
      className="w-full border-b border-white/15 text-white"
      style={{
        background:
          "linear-gradient(90deg, #b22234 0%, #b22234 22%, #ffffff 22%, #ffffff 28%, #3c3b6e 28%, #3c3b6e 72%, #ffffff 72%, #ffffff 78%, #b22234 78%, #b22234 100%)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <div
          data-testid="memorial-day-banner-headline"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)] sm:text-base"
        >
          <span aria-hidden className="text-base">🇺🇸</span>
          <span className="font-display uppercase tracking-wide">
            Memorial Day Sale
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[#b22234]">
            30% OFF
          </span>
          <span>Skates &amp; Helmets · May 23–25</span>
        </div>
        <button
          type="button"
          data-testid="memorial-day-banner-dismiss"
          aria-label="Dismiss Memorial Day sale banner"
          onClick={dismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
        >
          <span aria-hidden className="text-base leading-none">×</span>
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";
import type { PromoRejection } from "@/lib/promo";
import type { Region } from "@/lib/types";

export function PromoCodeForm({
  appliedCode,
  stale,
  region,
}: {
  appliedCode: string | null;
  stale: { reason: PromoRejection; minSubtotalCents?: number } | null;
  region: Region;
}) {
  const t = useTranslations("checkout.promo");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const reasonMessage = (reason: PromoRejection, minSubtotalCents?: number) =>
    t(`reasons.${reason}`, { min: formatPrice(minSubtotalCents ?? 0, region) });
  const [error, setError] = useState<string | null>(
    stale ? reasonMessage(stale.reason, stale.minSubtotalCents) : null,
  );

  async function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const reason = body?.details?.reason as PromoRejection | undefined;
        setError(
          reason
            ? reasonMessage(reason, body.details.minSubtotalCents)
            : (body?.message ?? t("failed")),
        );
        return;
      }
      setCode("");
      router.refresh();
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    await fetch("/api/promo", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  if (appliedCode && !stale) {
    return (
      <div
        data-testid="checkout-promo-applied"
        className="mt-3 flex items-center justify-between rounded border border-[color:var(--border)] px-3 py-2 text-sm"
      >
        <span>
          {t("applied")} <strong data-testid="checkout-promo-applied-code">{appliedCode}</strong>
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          data-testid="checkout-promo-remove"
          className="text-xs font-semibold text-[color:var(--accent)] hover:underline disabled:opacity-50"
        >
          {t("remove")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={apply} data-testid="checkout-promo-form" className="mt-3">
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
          {t("label")}
        </span>
        <div className="flex gap-2">
          <input
            name="promoCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("placeholder")}
            autoComplete="off"
            data-testid="checkout-promo-input"
            className="min-w-0 flex-1 rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm uppercase"
          />
          <button
            type="submit"
            disabled={busy || code.trim() === ""}
            data-testid="checkout-promo-apply"
            className="rounded border border-[color:var(--border)] px-3 py-2 text-sm font-semibold hover:bg-[color:var(--background)] disabled:opacity-50"
          >
            {t("apply")}
          </button>
        </div>
      </label>
      {error && (
        <p data-testid="checkout-promo-error" className="mt-2 text-xs text-[color:var(--primary)]">
          {error}
        </p>
      )}
    </form>
  );
}

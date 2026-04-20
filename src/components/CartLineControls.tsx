"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CartLineControls({
  productId,
  quantity,
}: {
  productId: string;
  quantity: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function set(next: number) {
    setError(null);
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity: next }),
    });
    if (!res.ok) {
      let msg = `update failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.message) msg = body.message;
      } catch {}
      setError(msg);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1 rounded border border-[color:var(--border)]">
        <button
          onClick={() => set(Math.max(0, quantity - 1))}
          disabled={pending}
          data-testid={`qty-dec-${productId}`}
          className="px-2 py-1 hover:bg-[color:var(--surface-2)]"
          aria-label="Decrease"
        >
          −
        </button>
        <span
          className="min-w-8 text-center text-sm font-semibold"
          data-testid={`qty-${productId}`}
        >
          {quantity}
        </span>
        <button
          onClick={() => set(quantity + 1)}
          disabled={pending}
          data-testid={`qty-inc-${productId}`}
          className="px-2 py-1 hover:bg-[color:var(--surface-2)]"
          aria-label="Increase"
        >
          +
        </button>
      </div>
      <button
        onClick={() => set(0)}
        disabled={pending}
        data-testid={`qty-remove-${productId}`}
        className="text-xs text-[color:var(--muted)] hover:text-[color:var(--primary)]"
      >
        Remove
      </button>
      {error && (
        <span
          className="text-xs text-[color:var(--primary)]"
          data-testid={`qty-error-${productId}`}
        >
          {error}
        </span>
      )}
    </div>
  );
}

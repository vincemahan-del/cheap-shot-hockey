"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AddToCartButton({
  productId,
  disabled,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "added" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function add() {
    setState("idle");
    setMessage(null);
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity: 1, mode: "add" }),
    });
    if (!res.ok) {
      let msg = `request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.message) msg = body.message;
      } catch {}
      setState("error");
      setMessage(msg);
      return;
    }
    const body = await res.json();
    const line = body.lines?.find?.(
      (l: { productId: string; quantity: number }) => l.productId === productId,
    );
    const qty = line?.quantity ?? 1;
    setState("added");
    setMessage(qty > 1 ? `${qty} in cart` : "Added to cart");
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={add}
        disabled={disabled || pending}
        data-testid={`add-to-cart-${productId}`}
        className="rounded bg-[color:var(--primary)] px-4 py-2 font-semibold text-[color:var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Adding…" : disabled ? "Out of stock" : "Add to cart"}
      </button>
      {message && (
        <span
          data-testid={`add-to-cart-feedback-${productId}`}
          className={
            state === "error"
              ? "text-sm text-[color:var(--primary)]"
              : "text-sm text-[color:var(--success)]"
          }
        >
          {message}
        </span>
      )}
    </div>
  );
}

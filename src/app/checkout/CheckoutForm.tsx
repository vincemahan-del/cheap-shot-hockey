"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CheckoutForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const shippingAddress = {
      name: String(data.get("name") ?? ""),
      street: String(data.get("street") ?? ""),
      city: String(data.get("city") ?? ""),
      state: String(data.get("state") ?? ""),
      postalCode: String(data.get("postalCode") ?? ""),
      country: String(data.get("country") ?? ""),
    };
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress }),
      });
      if (!res.ok) {
        let msg = `checkout failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.message) msg = body.message;
        } catch {}
        setError(msg);
        setSubmitting(false);
        return;
      }
      const body = await res.json();
      router.push(`/orders/${body.id}?new=1`);
    } catch {
      setError("network error");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="checkout-form"
      className="space-y-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
    >
      <h2 className="font-bold">Shipping address</h2>
      <Field label="Full name" name="name" defaultValue={defaultName} required />
      <Field label="Street" name="street" required />
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" name="city" required />
        <Field label="State" name="state" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Postal code" name="postalCode" required />
        <Field label="Country" name="country" defaultValue="US" required />
      </div>
      {error && (
        <div
          data-testid="checkout-error"
          className="rounded bg-[color:var(--primary)]/10 px-3 py-2 text-sm text-[color:var(--primary)]"
        >
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        data-testid="checkout-submit"
        className="w-full rounded bg-[color:var(--primary)] py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Placing order…" : "Place order"}
      </button>
      <p className="text-center text-xs text-[color:var(--muted)]">
        No real payment is taken — this is a demo store.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        data-testid={`checkout-${name}`}
        className="w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
      />
    </label>
  );
}

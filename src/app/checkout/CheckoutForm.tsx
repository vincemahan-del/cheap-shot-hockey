"use client";

import { useState } from "react";

export function CheckoutForm({
  defaultName,
  defaultEmail,
  isGuest,
}: {
  defaultName: string;
  defaultEmail: string;
  isGuest: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const data = new FormData(e.currentTarget);
    const shippingAddress = {
      name: String(data.get("name") ?? ""),
      street: String(data.get("street") ?? ""),
      city: String(data.get("city") ?? ""),
      state: String(data.get("state") ?? ""),
      postalCode: String(data.get("postalCode") ?? ""),
      country: String(data.get("country") ?? ""),
    };
    const customerEmail = String(data.get("customerEmail") ?? "").trim();

    const payload: Record<string, unknown> = { shippingAddress };
    if (isGuest) payload.customerEmail = customerEmail;

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      // Hard nav so the guest-order cookie + session state are honored.
      window.location.assign(`/orders/${body.id}?new=1`);
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
      {isGuest && (
        <section>
          <h2 className="font-bold">Contact</h2>
          <p className="mb-3 text-xs text-[color:var(--muted)]">
            We&apos;ll send your confirmation here.
          </p>
          <Field
            label="Email"
            name="customerEmail"
            type="email"
            required
            defaultValue={defaultEmail}
            testId="checkout-customer-email"
          />
        </section>
      )}
      <section>
        <h2 className="font-bold">Shipping address</h2>
        <div className="mt-3 space-y-4">
          <Field
            label="Full name"
            name="name"
            defaultValue={defaultName}
            required
            testId="checkout-name"
          />
          <Field label="Street" name="street" required testId="checkout-street" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" name="city" required testId="checkout-city" />
            <Field label="State" name="state" required testId="checkout-state" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Postal code"
              name="postalCode"
              required
              testId="checkout-postalCode"
            />
            <Field
              label="Country"
              name="country"
              defaultValue="US"
              required
              testId="checkout-country"
            />
          </div>
        </div>
      </section>
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
        {submitting ? "Placing order…" : isGuest ? "Place guest order" : "Place order"}
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
  type = "text",
  defaultValue,
  required,
  testId,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  testId: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        data-testid={testId}
        className="w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
      />
    </label>
  );
}

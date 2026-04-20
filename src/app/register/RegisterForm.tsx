"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      }),
    });
    if (!res.ok) {
      let msg = "Registration failed";
      try {
        const body = await res.json();
        if (body?.message) msg = body.message;
      } catch {}
      setError(msg);
      setSubmitting(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="register-form"
      className="space-y-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
    >
      <Field label="Name" name="name" testId="register-name" required />
      <Field label="Email" name="email" type="email" testId="register-email" required />
      <Field
        label="Password (min 8 chars)"
        name="password"
        type="password"
        testId="register-password"
        required
      />
      {error && (
        <div
          data-testid="register-error"
          className="rounded bg-[color:var(--primary)]/10 px-3 py-2 text-sm text-[color:var(--primary)]"
        >
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        data-testid="register-submit"
        className="w-full rounded bg-[color:var(--primary)] py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  testId,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  testId: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        data-testid={testId}
        className="w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
      />
    </label>
  );
}

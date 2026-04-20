"use client";

import { useState } from "react";

export function LoginForm({ next }: { next?: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      }),
    });
    if (!res.ok) {
      let msg = "Login failed";
      try {
        const body = await res.json();
        if (body?.message) msg = body.message;
      } catch {}
      setError(msg);
      setSubmitting(false);
      return;
    }
    // Hard navigation so the browser picks up the new httpOnly auth
    // cookie on the next request. router.push races with Set-Cookie.
    window.location.assign(next || "/");
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="login-form"
      className="space-y-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
          Email
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          data-testid="login-email"
          className="w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
          Password
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          data-testid="login-password"
          className="w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
        />
      </label>
      {error && (
        <div
          data-testid="login-error"
          className="rounded bg-[color:var(--primary)]/10 px-3 py-2 text-sm text-[color:var(--primary)]"
        >
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        data-testid="login-submit"
        className="w-full rounded bg-[color:var(--primary)] py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

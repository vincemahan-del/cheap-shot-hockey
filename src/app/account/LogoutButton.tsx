"use client";

import { useState } from "react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    // Hard nav so the cleared auth cookie actually takes effect.
    window.location.assign("/");
  }

  return (
    <button
      onClick={logout}
      disabled={pending}
      data-testid="logout-button"
      className="rounded bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Log out"}
    </button>
  );
}

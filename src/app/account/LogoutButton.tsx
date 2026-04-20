"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
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

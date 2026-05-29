"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DeploymentState } from "@/lib/deployments";

type State =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "error"; message: string };

export default function DeploymentsLauncherPage() {
  const router = useRouter();
  const [durationSec, setDurationSec] = useState(8);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function deploy() {
    if (state.kind === "creating") return;
    setState({ kind: "creating" });
    try {
      const res = await fetch(`/api/deployments?duration=${durationSec}`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({
          kind: "error",
          message: body?.message ?? `Request failed (${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as { deployment: DeploymentState };
      router.push(`/deployments/${body.deployment.label}`);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12" data-testid="deployments-launcher-page">
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--primary)]">
          Catalog Deployments
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">
          Create a deployment.
        </h1>
        <p className="mt-3 text-[color:var(--muted)]">
          Kick off a deployment of catalog changes. It moves from{" "}
          <strong>queued → in progress → successful/failure</strong>, and the
          status page polls until it resolves.{" "}
          <strong>You don&apos;t choose the outcome</strong> — the system decides
          when it runs, so you have to poll and handle whichever result comes
          back. That&apos;s the point: write a loop, exit on either terminal
          state.
        </p>
      </header>

      <div className="space-y-5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <div>
          <label
            htmlFor="duration"
            className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]"
          >
            Processing duration (seconds)
          </label>
          <input
            id="duration"
            data-testid="deployment-duration"
            type="number"
            min={1}
            max={180}
            value={durationSec}
            onChange={(e) => setDurationSec(Number.parseInt(e.target.value, 10) || 1)}
            className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
          />
        </div>

        {state.kind === "error" && (
          <p
            data-testid="deployments-launcher-error"
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {state.message}
          </p>
        )}

        <button
          type="button"
          data-testid="create-deployment"
          disabled={state.kind === "creating"}
          onClick={deploy}
          className="w-full rounded-md bg-[color:var(--primary)] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {state.kind === "creating" ? "Deploying…" : "Deploy"}
        </button>
      </div>
    </div>
  );
}

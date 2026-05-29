"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  isTerminal,
  type DeploymentState,
  type DeploymentStatus,
  type DeploymentRecord,
} from "@/lib/deployments";

const POLL_MS = 1000;

const STATUS_LABEL: Record<DeploymentStatus, string> = {
  queued: "Queued",
  in_progress: "In progress",
  successful: "Successful",
  failure: "Failure",
};

type View =
  | { kind: "loading" }
  | { kind: "polling"; deployment: DeploymentState; polls: number }
  | { kind: "error"; message: string };

export default function DeploymentTracker({ label }: { label: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const pollsRef = useRef(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/deployments/${encodeURIComponent(label)}`, {
          cache: "no-store",
        });
        if (!active) return;
        if (!res.ok) {
          setView({ kind: "error", message: `Poll failed (${res.status})` });
          timer = setTimeout(poll, POLL_MS);
          return;
        }
        const body = (await res.json()) as { deployment: DeploymentState };
        pollsRef.current += 1;
        setView({ kind: "polling", deployment: body.deployment, polls: pollsRef.current });
        if (!isTerminal(body.deployment.status)) {
          timer = setTimeout(poll, POLL_MS);
        }
      } catch (err) {
        if (!active) return;
        setView({
          kind: "error",
          message: err instanceof Error ? err.message : "Network error",
        });
        timer = setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [label]);

  if (view.kind === "loading") {
    return (
      <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <p data-testid="deployment-loading" className="text-[color:var(--muted)]">
          Loading deployment…
        </p>
      </div>
    );
  }

  if (view.kind === "error") {
    return (
      <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <p
          data-testid="deployment-poll-error"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {view.message}
        </p>
      </div>
    );
  }

  const { deployment, polls } = view;
  const terminal = isTerminal(deployment.status);

  return (
    <div className="space-y-6">
      <div
        className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
        data-testid="deployment-panel"
        data-deployment-status={deployment.status}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
            Status
          </span>
          <span
            data-testid="deployment-status"
            data-status={deployment.status}
            className={`rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wider ${badgeClass(deployment.status)}`}
          >
            <span data-testid={`deployment-state-${deployment.status}`}>
              {STATUS_LABEL[deployment.status]}
            </span>
          </span>
        </div>

        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[color:var(--surface-2)]">
          <div
            data-testid="deployment-progress-bar"
            data-progress={deployment.progress}
            className={`h-full transition-all duration-500 ${barClass(deployment.status)}`}
            style={{ width: `${deployment.progress}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-[color:var(--muted)]">
          <span data-testid="deployment-progress-value">{deployment.progress}</span>%
        </p>

        {terminal && (
          <div
            data-testid={`deployment-result-${deployment.status}`}
            className={`mt-5 rounded-md px-4 py-3 text-sm font-semibold ${
              deployment.status === "successful"
                ? "border border-green-500/30 bg-green-500/10 text-green-400"
                : "border border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            {deployment.status === "successful"
              ? "Deployment completed successfully."
              : "Deployment failed. No record was created."}
          </div>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-2 text-xs text-[color:var(--muted)]">
          <dt>Deployment label</dt>
          <dd className="text-right font-mono" data-testid="deployment-label">
            {deployment.label}
          </dd>
          <dt>Polls</dt>
          <dd className="text-right" data-testid="deployment-poll-count">
            {polls}
          </dd>
        </dl>
      </div>

      {/* Success-only step: search by label and assert the record ("Saved").
          On failure this is skipped entirely. */}
      {deployment.status === "successful" && (
        <DeploymentSearch defaultLabel={deployment.label} />
      )}

      {/* Convergence: BOTH outcomes proceed to the next action regardless. */}
      {terminal && (
        <Link
          href={`/deployments/${encodeURIComponent(deployment.label)}/next`}
          data-testid="deployment-acknowledge"
          className="block rounded-md bg-[color:var(--primary)] px-5 py-2.5 text-center text-sm font-bold uppercase tracking-wider text-white transition hover:opacity-90"
        >
          Acknowledge &amp; continue →
        </Link>
      )}
    </div>
  );
}

// The downstream "search by deployment label" step. On a successful deployment
// the search returns a record (containing "Saved") to assert on; on a failed
// deployment there is no record — the empty state is shown and downstream
// assertions are skipped.
function DeploymentSearch({ defaultLabel }: { defaultLabel: string }) {
  const [labelInput, setLabelInput] = useState(defaultLabel);
  const [result, setResult] = useState<
    | { kind: "idle" }
    | { kind: "searching" }
    | { kind: "found"; record: DeploymentRecord }
    | { kind: "empty" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function search() {
    if (result.kind === "searching") return;
    setResult({ kind: "searching" });
    try {
      const res = await fetch(
        `/api/deployments/search?label=${encodeURIComponent(labelInput)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setResult({ kind: "error", message: `Search failed (${res.status})` });
        return;
      }
      const body = (await res.json()) as { record: DeploymentRecord | null };
      setResult(body.record ? { kind: "found", record: body.record } : { kind: "empty" });
    } catch (err) {
      setResult({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return (
    <div
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
      data-testid="deployment-search-section"
    >
      <h2 className="mb-3 font-display text-lg font-black uppercase tracking-tight">
        Search deployment label
      </h2>
      <div className="flex gap-3">
        <input
          data-testid="deployment-search-label"
          type="text"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          placeholder="DEP-…"
          className="flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--primary)]"
        />
        <button
          type="button"
          data-testid="deployment-search-submit"
          disabled={result.kind === "searching"}
          onClick={search}
          className="rounded-md bg-[color:var(--primary)] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {result.kind === "searching" ? "Searching…" : "Search"}
        </button>
      </div>

      {result.kind === "found" && (
        <div
          data-testid="deployment-search-result"
          className="mt-4 rounded-md border border-green-500/30 bg-green-500/10 p-4 text-sm"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[color:var(--muted)]">{result.record.label}</span>
            <span
              data-testid="deployment-search-status"
              className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-green-400"
            >
              {result.record.status}
            </span>
          </div>
          <p data-testid="deployment-search-saved" className="mt-2 font-semibold text-green-400">
            {result.record.summary}
          </p>
        </div>
      )}

      {result.kind === "empty" && (
        <p
          data-testid="deployment-search-empty"
          className="mt-4 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2 text-sm text-[color:var(--muted)]"
        >
          No deployment record found for that label.
        </p>
      )}

      {result.kind === "error" && (
        <p
          data-testid="deployment-search-error"
          className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

function badgeClass(status: DeploymentStatus): string {
  switch (status) {
    case "queued":
      return "bg-[color:var(--surface-2)] text-[color:var(--muted)]";
    case "in_progress":
      return "bg-blue-500/15 text-blue-400";
    case "successful":
      return "bg-green-500/15 text-green-400";
    case "failure":
      return "bg-red-500/15 text-red-400";
  }
}

function barClass(status: DeploymentStatus): string {
  switch (status) {
    case "failure":
      return "bg-red-500";
    case "successful":
      return "bg-green-500";
    default:
      return "bg-[color:var(--primary)]";
  }
}

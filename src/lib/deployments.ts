// Deployment-job simulation for the polling-status demo surface.
//
// This mirrors the workflow an AutoRABIT user described: a deployment is
// created with a label, its status auto-updates in place
// (queued → in progress → successful | failure), and once it reaches a
// terminal state the user searches by the deployment label to find the
// resulting record — which appears on success and is absent on failure
// (so downstream steps are skipped).
//
// IMPORTANT: state is derived PURELY from elapsed time + the label. There is
// NO server-side store. That's deliberate — Vercel's serverless instances
// don't share in-memory state (see CLAUDE.md: the cart/orders cookie fix), so
// a polled deployment backed by an in-memory Map would transition unreliably
// across Lambdas. Encoding everything in the label makes every poll and every
// search deterministic and stateless, and lets a test force a success vs.
// failure run on demand.

export type DeploymentStatus = "queued" | "in_progress" | "successful" | "failure";
export type DeploymentOutcome = "success" | "fail";

export interface DeploymentState {
  /** The searchable deployment label, e.g. "DEP-1780000000000-success-8". */
  label: string;
  status: DeploymentStatus;
  /** 0–100, monotonic across queued → in progress → terminal. */
  progress: number;
  createdAt: string;
  /** Set only once the deployment reaches a terminal state. */
  completedAt?: string;
}

/** The record returned by a label search — present only for successful deploys. */
export interface DeploymentRecord {
  label: string;
  status: "successful";
  deployedAt: string;
  /** Human summary; contains "Saved" so a test can assert on it. */
  summary: string;
}

export interface DecodedLabel {
  createdAtMs: number;
  outcome: DeploymentOutcome;
  durationSec: number;
}

const LABEL_PREFIX = "DEP";
// Time spent in the "queued" phase before "in progress" begins.
export const QUEUED_MS = 3000;
export const MIN_DURATION_SEC = 1;
export const MAX_DURATION_SEC = 180;
export const DEFAULT_DURATION_SEC = 10;

export function parseOutcome(value: string | null | undefined): DeploymentOutcome {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "fail" || v === "failed" || v === "failure" || v === "error") {
    return "fail";
  }
  return "success";
}

export function clampDuration(value: number | string | null | undefined): number {
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_DURATION_SEC;
  return Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, Math.trunc(n)));
}

export function encodeLabel(parts: DecodedLabel): string {
  return `${LABEL_PREFIX}-${parts.createdAtMs}-${parts.outcome}-${parts.durationSec}`;
}

export function decodeLabel(label: string): DecodedLabel | null {
  if (typeof label !== "string") return null;
  const segments = label.split("-");
  if (segments.length !== 4) return null;
  const [prefix, createdRaw, outcomeRaw, durationRaw] = segments;
  if (prefix !== LABEL_PREFIX) return null;

  const createdAtMs = Number.parseInt(createdRaw, 10);
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return null;

  if (outcomeRaw !== "success" && outcomeRaw !== "fail") return null;

  const durationSec = Number.parseInt(durationRaw, 10);
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;

  return { createdAtMs, outcome: outcomeRaw, durationSec };
}

/**
 * Compute the deployment's state at a given moment. Pure function of
 * (label, now).
 */
export function computeDeploymentState(label: string, nowMs: number): DeploymentState | null {
  const decoded = decodeLabel(label);
  if (!decoded) return null;

  const { createdAtMs, outcome, durationSec } = decoded;
  const processingMs = durationSec * 1000;
  const terminalAtMs = createdAtMs + QUEUED_MS + processingMs;
  const elapsedMs = nowMs - createdAtMs;
  const createdAt = new Date(createdAtMs).toISOString();

  if (elapsedMs < QUEUED_MS) {
    return { label, status: "queued", progress: 0, createdAt };
  }

  if (nowMs < terminalAtMs) {
    const ratio = (elapsedMs - QUEUED_MS) / processingMs;
    // Clamp to 1–99 so "in progress" never reads as 0% or a misleading 100%.
    const progress = Math.min(99, Math.max(1, Math.round(ratio * 100)));
    return { label, status: "in_progress", progress, createdAt };
  }

  return {
    label,
    status: outcome === "fail" ? "failure" : "successful",
    progress: 100,
    createdAt,
    completedAt: new Date(terminalAtMs).toISOString(),
  };
}

export function isTerminal(status: DeploymentStatus): boolean {
  return status === "successful" || status === "failure";
}

/**
 * Search for a deployment record by label. Mirrors the customer's flow: the
 * record is found only once the deployment has SUCCEEDED. While it's still
 * running, has failed, or the label is unknown, there is no record — so
 * downstream steps are skipped.
 */
export function searchDeployment(label: string, nowMs: number): DeploymentRecord | null {
  const state = computeDeploymentState(label, nowMs);
  if (!state || state.status !== "successful") return null;
  return {
    label: state.label,
    status: "successful",
    deployedAt: state.completedAt ?? state.createdAt,
    summary: "Saved — deployment completed successfully",
  };
}

/**
 * Create a new deployment starting "now". Returns its label and initial
 * (queued) state.
 */
export function createDeployment(opts: {
  outcome: DeploymentOutcome;
  durationSec: number;
  nowMs: number;
}): DeploymentState {
  const label = encodeLabel({
    createdAtMs: opts.nowMs,
    outcome: opts.outcome,
    durationSec: clampDuration(opts.durationSec),
  });
  // Non-null: we just encoded a valid label.
  return computeDeploymentState(label, opts.nowMs)!;
}

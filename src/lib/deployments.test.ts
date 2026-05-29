import { describe, it, expect } from "vitest";
import {
  outcomeForSequence,
  clampDuration,
  encodeLabel,
  decodeLabel,
  computeDeploymentState,
  isTerminal,
  searchDeployment,
  createDeployment,
  QUEUED_MS,
  DEFAULT_DURATION_SEC,
  MIN_DURATION_SEC,
  MAX_DURATION_SEC,
} from "./deployments";

const T0 = 1_700_000_000_000; // fixed base time

describe("outcomeForSequence", () => {
  it("alternates: even → success, odd → failure", () => {
    expect(outcomeForSequence(0)).toBe("success");
    expect(outcomeForSequence(1)).toBe("fail");
    expect(outcomeForSequence(2)).toBe("success");
    expect(outcomeForSequence(3)).toBe("fail");
  });

  it("guards against invalid sequences (defaults to success)", () => {
    expect(outcomeForSequence(-1)).toBe("success");
    expect(outcomeForSequence(Number.NaN)).toBe("success");
    expect(outcomeForSequence(2.9)).toBe("success"); // truncates to 2
  });
});

describe("clampDuration", () => {
  it("returns the default for non-numeric input", () => {
    expect(clampDuration(undefined)).toBe(DEFAULT_DURATION_SEC);
    expect(clampDuration(null)).toBe(DEFAULT_DURATION_SEC);
    expect(clampDuration("abc")).toBe(DEFAULT_DURATION_SEC);
  });

  it("clamps to the allowed range", () => {
    expect(clampDuration(0)).toBe(MIN_DURATION_SEC);
    expect(clampDuration(-5)).toBe(MIN_DURATION_SEC);
    expect(clampDuration(9999)).toBe(MAX_DURATION_SEC);
    expect(clampDuration(8)).toBe(8);
  });

  it("accepts numeric strings and truncates floats", () => {
    expect(clampDuration("15")).toBe(15);
    expect(clampDuration(12.9)).toBe(12);
  });
});

describe("encodeLabel / decodeLabel", () => {
  it("round-trips", () => {
    const label = encodeLabel({ createdAtMs: T0, outcome: "fail", durationSec: 12 });
    expect(label).toBe(`DEP-${T0}-fail-12`);
    expect(decodeLabel(label)).toEqual({ createdAtMs: T0, outcome: "fail", durationSec: 12 });
  });

  it("rejects malformed labels", () => {
    expect(decodeLabel("")).toBeNull();
    expect(decodeLabel("nope")).toBeNull();
    expect(decodeLabel("XXX-1700-success-10")).toBeNull(); // wrong prefix
    expect(decodeLabel(`DEP-${T0}-success`)).toBeNull(); // too few segments
    expect(decodeLabel(`DEP-${T0}-success-10-extra`)).toBeNull(); // too many
    expect(decodeLabel(`DEP-notanumber-success-10`)).toBeNull();
    expect(decodeLabel(`DEP-${T0}-maybe-10`)).toBeNull(); // bad outcome
    expect(decodeLabel(`DEP-${T0}-success-0`)).toBeNull(); // bad duration
    expect(decodeLabel(`DEP-0-success-10`)).toBeNull(); // non-positive created
  });

  it("returns null for non-string input", () => {
    // @ts-expect-error exercising the runtime guard
    expect(decodeLabel(42)).toBeNull();
  });
});

describe("computeDeploymentState", () => {
  const ok = encodeLabel({ createdAtMs: T0, outcome: "success", durationSec: 10 });
  const bad = encodeLabel({ createdAtMs: T0, outcome: "fail", durationSec: 10 });
  // queued: 0–3s, in progress: 3–13s, terminal at +13s

  it("returns null for an undecodable label", () => {
    expect(computeDeploymentState("garbage", T0)).toBeNull();
  });

  it("is 'queued' during the queue window", () => {
    const s = computeDeploymentState(ok, T0 + 1000)!;
    expect(s.status).toBe("queued");
    expect(s.progress).toBe(0);
    expect(s.completedAt).toBeUndefined();
    expect(s.createdAt).toBe(new Date(T0).toISOString());
  });

  it("is 'in_progress' with clamped progress mid-run", () => {
    const justStarted = computeDeploymentState(ok, T0 + QUEUED_MS + 10)!;
    expect(justStarted.status).toBe("in_progress");
    expect(justStarted.progress).toBeGreaterThanOrEqual(1);

    const half = computeDeploymentState(ok, T0 + QUEUED_MS + 5000)!;
    expect(half.status).toBe("in_progress");
    expect(half.progress).toBe(50);

    const almost = computeDeploymentState(ok, T0 + QUEUED_MS + 9990)!;
    expect(almost.status).toBe("in_progress");
    expect(almost.progress).toBeLessThanOrEqual(99);
  });

  it("resolves to 'successful' for a success deploy past the terminal point", () => {
    const s = computeDeploymentState(ok, T0 + QUEUED_MS + 10_000 + 1)!;
    expect(s.status).toBe("successful");
    expect(s.progress).toBe(100);
    expect(s.completedAt).toBe(new Date(T0 + QUEUED_MS + 10_000).toISOString());
  });

  it("resolves to 'failure' for a fail deploy past the terminal point", () => {
    const s = computeDeploymentState(bad, T0 + 999_999)!;
    expect(s.status).toBe("failure");
    expect(s.progress).toBe(100);
    expect(s.completedAt).toBeDefined();
  });
});

describe("isTerminal", () => {
  it("is true only for successful/failure", () => {
    expect(isTerminal("successful")).toBe(true);
    expect(isTerminal("failure")).toBe(true);
    expect(isTerminal("queued")).toBe(false);
    expect(isTerminal("in_progress")).toBe(false);
  });
});

describe("searchDeployment", () => {
  const ok = encodeLabel({ createdAtMs: T0, outcome: "success", durationSec: 10 });
  const bad = encodeLabel({ createdAtMs: T0, outcome: "fail", durationSec: 10 });
  const terminalMs = T0 + QUEUED_MS + 10_000 + 1;

  it("returns a record containing 'Saved' for a successful deployment", () => {
    const rec = searchDeployment(ok, terminalMs)!;
    expect(rec).not.toBeNull();
    expect(rec.status).toBe("successful");
    expect(rec.label).toBe(ok);
    expect(rec.summary).toContain("Saved");
    expect(rec.deployedAt).toBeDefined();
  });

  it("returns null for a failed deployment (nothing to show → skip)", () => {
    expect(searchDeployment(bad, terminalMs)).toBeNull();
  });

  it("returns null while still running", () => {
    expect(searchDeployment(ok, T0 + 1000)).toBeNull(); // queued
    expect(searchDeployment(ok, T0 + QUEUED_MS + 2000)).toBeNull(); // in progress
  });

  it("returns null for an unknown label", () => {
    expect(searchDeployment("DEP-nope", terminalMs)).toBeNull();
  });
});

describe("createDeployment", () => {
  it("creates a queued deployment whose outcome is derived from the sequence", () => {
    const even = createDeployment({ sequence: 0, durationSec: 10, nowMs: T0 });
    expect(even.status).toBe("queued");
    expect(even.progress).toBe(0);
    expect(decodeLabel(even.label)).toEqual({
      createdAtMs: T0,
      outcome: "success",
      durationSec: 10,
    });

    const odd = createDeployment({ sequence: 1, durationSec: 10, nowMs: T0 });
    expect(decodeLabel(odd.label)!.outcome).toBe("fail");
  });

  it("clamps the duration when creating", () => {
    const d = createDeployment({ sequence: 1, durationSec: 99999, nowMs: T0 });
    expect(decodeLabel(d.label)!.durationSec).toBe(MAX_DURATION_SEC);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseDemoMode,
  readDemoMode,
  shouldDemoFail,
  applyDemoDelay,
  sleep,
} from "./demo";

describe("readDemoMode", () => {
  it("reads the x-demo-mode header injected by middleware", async () => {
    const hdrs = new Headers({ "x-demo-mode": "flaky" });
    expect(await readDemoMode(hdrs)).toBe("flaky");
  });

  it("falls back to 'normal' when the header is absent", async () => {
    expect(await readDemoMode(new Headers())).toBe("normal");
  });

  it("falls back to 'normal' for an unrecognized value", async () => {
    const hdrs = new Headers({ "x-demo-mode": "definitely-not-a-mode" });
    expect(await readDemoMode(hdrs)).toBe("normal");
  });
});


describe("parseDemoMode", () => {
  it.each([
    ["normal", "normal"],
    ["slow", "slow"],
    ["flaky", "flaky"],
    ["broken", "broken"],
    ["SLOW", "slow"],
    ["Flaky", "flaky"],
  ])("maps %s → %s", (input, expected) => {
    expect(parseDemoMode(input)).toBe(expected);
  });

  it("returns 'normal' for null / undefined / unknown values", () => {
    expect(parseDemoMode(null)).toBe("normal");
    expect(parseDemoMode(undefined)).toBe("normal");
    expect(parseDemoMode("")).toBe("normal");
    expect(parseDemoMode("typo")).toBe("normal");
  });
});

describe("shouldDemoFail", () => {
  beforeEach(() => vi.spyOn(Math, "random"));
  afterEach(() => vi.restoreAllMocks());

  it("always fails in 'broken' mode", () => {
    vi.mocked(Math.random).mockReturnValue(0.99);
    expect(shouldDemoFail("broken")).toBe(true);
  });

  it("never fails in 'normal' or 'slow' mode", () => {
    vi.mocked(Math.random).mockReturnValue(0);
    expect(shouldDemoFail("normal")).toBe(false);
    expect(shouldDemoFail("slow")).toBe(false);
  });

  it("fails probabilistically in 'flaky' mode", () => {
    vi.mocked(Math.random).mockReturnValue(0.1);
    expect(shouldDemoFail("flaky", 0.2)).toBe(true);
    vi.mocked(Math.random).mockReturnValue(0.5);
    expect(shouldDemoFail("flaky", 0.2)).toBe(false);
  });
});

describe("applyDemoDelay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits ~2.5s in 'slow' mode", async () => {
    const p = applyDemoDelay("slow");
    vi.advanceTimersByTime(2500);
    await p;
  });

  it("doesn't wait in 'normal' or 'broken' mode", async () => {
    const start = Date.now();
    await applyDemoDelay("normal");
    await applyDemoDelay("broken");
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("occasionally waits in 'flaky' mode", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const p = applyDemoDelay("flaky");
    vi.advanceTimersByTime(2000);
    await p;
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    await applyDemoDelay("flaky");
  });
});

describe("sleep", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves after the specified number of ms", async () => {
    const p = sleep(500);
    vi.advanceTimersByTime(500);
    await p;
  });
});

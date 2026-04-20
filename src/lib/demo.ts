import type { DemoMode } from "./types";

const DEMO_HEADER = "x-demo-mode";
const DEMO_COOKIE = "csh_demo";

export function parseDemoMode(value: string | null | undefined): DemoMode {
  const v = (value ?? "").toLowerCase();
  if (v === "slow" || v === "flaky" || v === "broken") return v;
  return "normal";
}

export async function readDemoMode(headers: Headers): Promise<DemoMode> {
  return parseDemoMode(headers.get(DEMO_HEADER));
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function applyDemoDelay(mode: DemoMode): Promise<void> {
  if (mode === "slow") {
    await sleep(2500);
  } else if (mode === "flaky") {
    if (Math.random() < 0.25) await sleep(2000);
  }
}

export function shouldDemoFail(mode: DemoMode, probability = 0.2): boolean {
  if (mode === "broken") return true;
  if (mode === "flaky") return Math.random() < probability;
  return false;
}

export const DEMO_HEADER_NAME = DEMO_HEADER;
export const DEMO_COOKIE_NAME = DEMO_COOKIE;

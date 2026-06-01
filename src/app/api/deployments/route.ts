import type { NextRequest } from "next/server";
import { created, serviceUnavailable } from "@/lib/api";
import { applyDemoDelay, readDemoMode, shouldDemoFail } from "@/lib/demo";
import { createDeployment, clampDuration, type DeploymentOutcome } from "@/lib/deployments";

// POST /api/deployments?duration=<seconds>
//
// Kicks off a deployment. The outcome is NOT selectable — it's chosen at RANDOM
// (~50/50 success|failure) the moment the deployment is created, mirroring a
// real deployment tool where a given deploy is genuinely success-or-failure and
// the user can't pick which. The decided outcome is baked into the returned
// label, so every subsequent poll/search is deterministic and serverless-safe
// (no shared server state — the label is self-describing).
export async function POST(req: NextRequest) {
  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);
  if (shouldDemoFail(mode, 0.15)) {
    return serviceUnavailable("demo mode: deployment intake temporarily unavailable");
  }

  const outcome: DeploymentOutcome = Math.random() < 0.5 ? "success" : "fail";

  const deployment = createDeployment({
    outcome,
    durationSec: clampDuration(req.nextUrl.searchParams.get("duration")),
    nowMs: Date.now(),
  });

  return created({ deployment });
}

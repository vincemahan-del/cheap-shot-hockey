import type { NextRequest } from "next/server";
import { created, serviceUnavailable } from "@/lib/api";
import { applyDemoDelay, readDemoMode, shouldDemoFail } from "@/lib/demo";
import { createDeployment, parseOutcome, clampDuration } from "@/lib/deployments";

// POST /api/deployments?outcome=success|fail&duration=<seconds>
//
// Kicks off a simulated deployment. The returned label encodes the start time,
// the (forced) outcome, and the duration, so subsequent status polls and label
// searches are fully deterministic and stateless — see src/lib/deployments.ts.
// `outcome` lets a test drive a success run vs. a failure run on demand.
export async function POST(req: NextRequest) {
  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);
  if (shouldDemoFail(mode, 0.15)) {
    return serviceUnavailable("demo mode: deployment intake temporarily unavailable");
  }

  const params = req.nextUrl.searchParams;
  const deployment = createDeployment({
    outcome: parseOutcome(params.get("outcome")),
    durationSec: clampDuration(params.get("duration")),
    nowMs: Date.now(),
  });

  return created({ deployment });
}

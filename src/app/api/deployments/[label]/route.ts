import type { NextRequest } from "next/server";
import { ok, notFound, serviceUnavailable } from "@/lib/api";
import { applyDemoDelay, readDemoMode, shouldDemoFail } from "@/lib/demo";
import { computeDeploymentState } from "@/lib/deployments";

// GET /api/deployments/{label}
//
// Returns the deployment's current state, computed purely from the label + now.
// This is the endpoint a UI (or a mabl test) polls on an interval until the
// status is terminal. Demo mode still layers on top: ?demo=slow adds latency to
// each poll, ?demo=broken returns 503 (simulating a flaky polling endpoint).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ label: string }> },
) {
  const { label } = await params;

  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);
  if (shouldDemoFail(mode, 0.1)) {
    return serviceUnavailable("demo mode: deployment status poll failed");
  }

  const deployment = computeDeploymentState(label, Date.now());
  if (!deployment) return notFound("deployment not found");

  return ok({ deployment });
}

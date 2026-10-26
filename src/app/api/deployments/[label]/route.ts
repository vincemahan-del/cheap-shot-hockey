import type { NextRequest } from "next/server";
import { ok, notFound } from "@/lib/api";
import { computeDeploymentState } from "@/lib/deployments";

// GET /api/deployments/{label}
//
// Returns the deployment's current state, computed purely from the label + now.
// This is the endpoint a UI (or a mabl test) polls on an interval until the
// status is terminal.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ label: string }> },
) {
  const { label } = await params;

  const deployment = computeDeploymentState(label, Date.now());
  if (!deployment) return notFound("deployment not found");

  return ok({ deployment });
}

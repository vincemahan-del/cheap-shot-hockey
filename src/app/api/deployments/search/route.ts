import type { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { applyDemoDelay, readDemoMode } from "@/lib/demo";
import { searchDeployment } from "@/lib/deployments";

// GET /api/deployments/search?label=<label>
//
// Mirrors the customer's "search by deployment label" step. Returns the
// deployment record ONLY when the deployment has succeeded; for a failed,
// still-running, or unknown label the record is null (nothing to show → the
// caller's downstream steps are skipped). Always 200 so the UI can render an
// empty state without treating "not found" as an error.
export async function GET(req: NextRequest) {
  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);

  const label = req.nextUrl.searchParams.get("label") ?? "";
  const record = searchDeployment(label, Date.now());

  return ok({ record });
}

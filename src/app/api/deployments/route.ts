import type { NextRequest } from "next/server";
import { created, serviceUnavailable } from "@/lib/api";
import { applyDemoDelay, readDemoMode, shouldDemoFail } from "@/lib/demo";
import { createDeployment, clampDuration } from "@/lib/deployments";

const SEQ_COOKIE = "csh_deploy_seq";

// POST /api/deployments?duration=<seconds>
//
// Kicks off a deployment. The outcome is NOT selectable — it alternates by a
// per-session sequence counter held in the `csh_deploy_seq` cookie (even →
// success, odd → failure), mirroring a real deployment tool where the user
// can't choose whether a deploy passes. The decided outcome is baked into the
// returned label, so every subsequent poll is deterministic and serverless-safe
// (no shared server state — the counter rides in the cookie, like cart/orders).
export async function POST(req: NextRequest) {
  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);
  if (shouldDemoFail(mode, 0.15)) {
    return serviceUnavailable("demo mode: deployment intake temporarily unavailable");
  }

  const rawSeq = Number.parseInt(req.cookies.get(SEQ_COOKIE)?.value ?? "", 10);
  const sequence = Number.isFinite(rawSeq) && rawSeq >= 0 ? rawSeq : 0;

  const deployment = createDeployment({
    sequence,
    durationSec: clampDuration(req.nextUrl.searchParams.get("duration")),
    nowMs: Date.now(),
  });

  const res = created({ deployment });
  res.cookies.set(SEQ_COOKIE, String(sequence + 1), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour
  });
  return res;
}

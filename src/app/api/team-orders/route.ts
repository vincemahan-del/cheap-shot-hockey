import type { NextRequest } from "next/server";
import {
  validateTeamOrderInput,
  createTeamOrderQuote,
  type TeamOrderQuoteInput,
} from "@/lib/team-orders";
import { badRequest, created, serviceUnavailable } from "@/lib/api";
import { applyDemoDelay, readDemoMode, shouldDemoFail } from "@/lib/demo";

export async function POST(req: NextRequest) {
  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);
  if (shouldDemoFail(mode, 0.15)) {
    return serviceUnavailable("demo mode: team-orders intake temporarily unavailable");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }

  const errors = validateTeamOrderInput(body);
  if (errors.length > 0) {
    return badRequest("validation failed", { errors });
  }

  // Body is already validated; the cast is safe because validateTeamOrderInput
  // would have rejected anything that doesn't satisfy this shape.
  const quote = createTeamOrderQuote(body as TeamOrderQuoteInput);
  return created({ quote });
}

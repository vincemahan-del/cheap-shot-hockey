import { ok } from "@/lib/api";

export async function GET() {
  return ok({
    status: "ok",
    service: "cheap-shot-hockey",
    time: new Date().toISOString(),
  });
}

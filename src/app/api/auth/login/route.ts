import type { NextRequest } from "next/server";
import { verifyPassword } from "@/lib/auth-crypto";
import { getUserByEmail } from "@/lib/store";
import { login } from "@/lib/session";
import { badRequest, ok, unauthorized } from "@/lib/api";
import { applyDemoDelay, readDemoMode } from "@/lib/demo";

export async function POST(req: NextRequest) {
  const mode = await readDemoMode(req.headers);
  await applyDemoDelay(mode);

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  const { email, password } = body;
  if (typeof email !== "string" || typeof password !== "string") {
    return badRequest("email and password are required");
  }
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return unauthorized("invalid email or password");
  }
  await login(user.id);
  return ok({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

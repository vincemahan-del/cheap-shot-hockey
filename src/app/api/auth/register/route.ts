import type { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth-crypto";
import { createUser, getUserByEmail } from "@/lib/store";
import { login } from "@/lib/session";
import { badRequest, created } from "@/lib/api";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  const { email, password, name } = body;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest("a valid email is required");
  }
  if (typeof password !== "string" || password.length < 8) {
    return badRequest("password must be at least 8 characters");
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    return badRequest("name is required");
  }
  if (getUserByEmail(email)) {
    return badRequest("an account with this email already exists");
  }
  const user = createUser({
    email,
    passwordHash: hashPassword(password),
    name: name.trim(),
  });
  await login(user.id);
  return created({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

import type { NextRequest } from "next/server";
import {
  validateContactInput,
  createContactMessage,
  type ContactMessageInput,
} from "@/lib/contact";
import { badRequest, created } from "@/lib/api";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }

  const errors = validateContactInput(body);
  if (errors.length > 0) {
    return badRequest("validation failed", { errors });
  }

  const message = createContactMessage(body as ContactMessageInput);
  return created({ message });
}

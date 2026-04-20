import { getCurrentUser } from "@/lib/session";
import { ok, unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return ok({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

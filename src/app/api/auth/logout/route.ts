import { logout } from "@/lib/session";
import { ok } from "@/lib/api";

export async function POST() {
  await logout();
  return ok({ loggedOut: true });
}

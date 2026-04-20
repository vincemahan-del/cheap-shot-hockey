import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { LogoutButton } from "./LogoutButton";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold" data-testid="account-heading">
        Account
      </h1>
      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
        <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
          <dt className="text-[color:var(--muted)]">Name</dt>
          <dd data-testid="account-name">{user.name}</dd>
          <dt className="text-[color:var(--muted)]">Email</dt>
          <dd data-testid="account-email">{user.email}</dd>
          <dt className="text-[color:var(--muted)]">Role</dt>
          <dd data-testid="account-role" className="capitalize">
            {user.role}
          </dd>
          <dt className="text-[color:var(--muted)]">Member since</dt>
          <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
        </dl>
        <div className="mt-5 flex gap-3">
          <Link
            href="/orders"
            data-testid="account-orders-link"
            className="rounded border border-[color:var(--border)] px-4 py-2 text-sm font-semibold hover:border-[color:var(--accent)]"
          >
            View orders
          </Link>
          {user.role === "admin" && (
            <Link
              href="/admin"
              data-testid="account-admin-link"
              className="rounded border border-[color:var(--border)] px-4 py-2 text-sm font-semibold hover:border-[color:var(--accent)]"
            >
              Admin dashboard
            </Link>
          )}
          <LogoutButton />
        </div>
      </section>
    </div>
  );
}

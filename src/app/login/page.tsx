import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold" data-testid="login-heading">
        Log in
      </h1>
      <LoginForm next={next} />
      <div className="mt-4 text-sm text-[color:var(--muted)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          data-testid="login-register-link"
          className="text-[color:var(--accent)] hover:underline"
        >
          Register
        </Link>
      </div>
      <div className="mt-6 rounded bg-[color:var(--surface)] p-3 text-xs text-[color:var(--muted)]">
        <div className="font-bold text-[color:var(--foreground)]">Demo credentials</div>
        <div>demo@cheapshot.test / demo1234 (customer)</div>
        <div>admin@cheapshot.test / admin1234 (admin)</div>
      </div>
    </div>
  );
}

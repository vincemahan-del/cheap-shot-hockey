import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold" data-testid="register-heading">
        Create account
      </h1>
      <RegisterForm />
      <div className="mt-4 text-sm text-[color:var(--muted)]">
        Already have an account?{" "}
        <Link
          href="/login"
          data-testid="register-login-link"
          className="text-[color:var(--accent)] hover:underline"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[color:var(--border)] bg-[color:var(--surface)]/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-[color:var(--muted)] md:flex-row md:items-center md:justify-between">
        <div>
          © 2026 Cheap Shot Hockey · <span className="italic">Fake store, real puck deals.</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="/api/openapi" data-testid="footer-openapi" className="hover:text-[color:var(--foreground)]">
            API spec
          </a>
          <a href="/api/health" data-testid="footer-health" className="hover:text-[color:var(--foreground)]">
            Health
          </a>
          <span>Demo creds: demo@cheapshot.test / demo1234</span>
        </div>
      </div>
    </footer>
  );
}

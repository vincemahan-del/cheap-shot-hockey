export function Footer() {
  return (
    <footer className="mt-20 border-t border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="inline-flex size-8 items-center justify-center rounded-md font-black text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #f03e3e 0%, #b52528 100%)",
                }}
              >
                CS
              </span>
              <span className="font-black">
                Cheap Shot <span className="text-[color:var(--primary)]">Hockey</span>
              </span>
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              Hockey gear at a fighting price. Player and goalie equipment shipped
              fast from our pro shop.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Shop
            </h3>
            <ul className="space-y-1.5 text-sm">
              <li>
                <a href="/products?category=sticks" className="hover:text-[color:var(--accent)]">
                  Sticks
                </a>
              </li>
              <li>
                <a href="/products?category=skates" className="hover:text-[color:var(--accent)]">
                  Skates
                </a>
              </li>
              <li>
                <a href="/products?category=goalie-gear" className="hover:text-[color:var(--accent)]">
                  Goalie gear
                </a>
              </li>
              <li>
                <a href="/products?onSale=true" className="text-[color:var(--primary)] hover:opacity-80">
                  Deals & clearance
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Help
            </h3>
            <ul className="space-y-1.5 text-sm text-[color:var(--muted)]">
              <li>Shipping & returns</li>
              <li>Size guide</li>
              <li>Team orders</li>
              <li>Contact us</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Get the deals
            </h3>
            <p className="mb-2 text-sm text-[color:var(--muted)]">
              Be the first to know about new drops and markdowns.
            </p>
            <form
              action="/"
              method="get"
              data-testid="footer-newsletter"
              className="flex"
            >
              <input
                type="email"
                placeholder="you@cheapshot.test"
                data-testid="footer-newsletter-email"
                className="w-full rounded-l-md border border-r-0 border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
                aria-label="Email address"
              />
              <button
                type="submit"
                data-testid="footer-newsletter-submit"
                className="rounded-r-md bg-[color:var(--primary)] px-3 text-sm font-bold text-white hover:opacity-90"
              >
                Join
              </button>
            </form>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-[color:var(--border)] pt-5 text-xs text-[color:var(--muted)] md:flex-row md:items-center">
          <div>
            © 2026 Cheap Shot Hockey, LLC ·{" "}
            <span className="italic">Fake store, real puck deals.</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="/api/openapi" data-testid="footer-openapi" className="hover:text-[color:var(--foreground)]">
              API spec
            </a>
            <a href="/api/health" data-testid="footer-health" className="hover:text-[color:var(--foreground)]">
              Status
            </a>
            <span>Demo: demo@cheapshot.test / demo1234</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

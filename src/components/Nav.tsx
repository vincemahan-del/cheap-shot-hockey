import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { readCartLines } from "@/lib/cart-cookie";

const CATEGORY_LINKS = [
  { label: "Sticks", href: "/products?category=sticks" },
  { label: "Skates", href: "/products?category=skates" },
  { label: "Protective", href: "/products?category=pads" },
  { label: "Goalies", href: "/products?category=goalie-gear" },
  { label: "Apparel", href: "/products?category=jerseys" },
  { label: "Deals", href: "/products?onSale=true", accent: true },
];

export async function Nav() {
  const user = await getCurrentUser();
  const cartLines = await readCartLines();
  const cartCount = cartLines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--background)]/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2"
            data-testid="nav-home"
          >
            <span
              className="inline-flex size-9 items-center justify-center rounded-md font-black text-white"
              style={{
                background:
                  "linear-gradient(135deg, #f03e3e 0%, #b52528 100%)",
                boxShadow: "0 2px 10px -2px rgba(240, 62, 62, 0.6)",
              }}
            >
              CS
            </span>
            <span className="text-lg font-black tracking-tight leading-none">
              Cheap Shot
              <span className="ml-1 text-[color:var(--primary)]">Hockey</span>
              <span className="block text-[9px] font-semibold tracking-[0.3em] text-[color:var(--muted)]">
                PRO SHOP
              </span>
            </span>
          </Link>

          <form
            action="/products"
            method="get"
            role="search"
            className="hidden flex-1 max-w-xl md:flex"
          >
            <div className="relative flex w-full">
              <input
                type="search"
                name="q"
                placeholder="Search sticks, skates, jerseys…"
                data-testid="nav-search-input"
                className="w-full rounded-l-md border border-r-0 border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none"
              />
              <button
                type="submit"
                data-testid="nav-search-submit"
                aria-label="Search"
                className="rounded-r-md bg-[color:var(--primary)] px-4 text-sm font-bold text-white hover:opacity-90"
              >
                Search
              </button>
            </div>
          </form>

          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <Link
                href="/account"
                data-testid="nav-account"
                className="hidden text-[color:var(--muted)] hover:text-[color:var(--foreground)] sm:inline"
              >
                Hi, {user.name.split(" ")[0]}
              </Link>
            ) : (
              <Link
                href="/login"
                data-testid="nav-login"
                className="hidden text-[color:var(--muted)] hover:text-[color:var(--foreground)] sm:inline"
              >
                Log in
              </Link>
            )}
            <Link
              href="/cart"
              data-testid="nav-cart"
              className="relative inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 hover:border-[color:var(--accent)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M3 5h2l2.3 11.5a2 2 0 0 0 2 1.5h7.4a2 2 0 0 0 2-1.5L21 8H6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="10" cy="20.5" r="1.5" fill="currentColor" />
                <circle cx="17" cy="20.5" r="1.5" fill="currentColor" />
              </svg>
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span
                  data-testid="nav-cart-count"
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-[color:var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-white"
                >
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        <nav
          className="flex items-center gap-6 overflow-x-auto pb-2 text-sm font-semibold"
          data-testid="nav-categories"
        >
          {CATEGORY_LINKS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              data-testid={`nav-cat-${c.label.toLowerCase()}`}
              className={
                c.accent
                  ? "whitespace-nowrap text-[color:var(--primary)] hover:opacity-80"
                  : "whitespace-nowrap text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
              }
            >
              {c.label}
            </Link>
          ))}
          <Link
            href="/orders"
            data-testid="nav-orders"
            className="ml-auto whitespace-nowrap text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
          >
            My Orders
          </Link>
        </nav>
      </div>
    </header>
  );
}

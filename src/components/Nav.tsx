import Link from "next/link";
import { getCurrentUser, getSessionId } from "@/lib/session";
import { getCart } from "@/lib/store";

export async function Nav() {
  const user = await getCurrentUser();
  const sessionId = await getSessionId();
  const cart = getCart(sessionId);
  const cartCount = cart.lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--background)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2" data-testid="nav-home">
          <span className="inline-block size-7 rounded bg-[color:var(--primary)] text-center font-black leading-7 text-white">
            C
          </span>
          <span className="text-lg font-bold tracking-tight">
            Cheap Shot <span className="text-[color:var(--primary)]">Hockey</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm md:flex">
          <Link href="/products" data-testid="nav-shop" className="hover:text-[color:var(--accent)]">
            Shop
          </Link>
          <Link
            href="/products?onSale=true"
            data-testid="nav-deals"
            className="hover:text-[color:var(--accent)]"
          >
            Deals
          </Link>
          <Link
            href="/products?category=goalie-gear"
            data-testid="nav-goalie"
            className="hover:text-[color:var(--accent)]"
          >
            Goalies
          </Link>
          <Link href="/orders" data-testid="nav-orders" className="hover:text-[color:var(--accent)]">
            Orders
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <Link href="/account" data-testid="nav-account" className="text-[color:var(--muted)] hover:text-[color:var(--foreground)]">
              {user.name.split(" ")[0]}
            </Link>
          ) : (
            <Link href="/login" data-testid="nav-login" className="text-[color:var(--muted)] hover:text-[color:var(--foreground)]">
              Log in
            </Link>
          )}
          <Link
            href="/cart"
            data-testid="nav-cart"
            className="relative rounded border border-[color:var(--border)] px-3 py-1.5 hover:border-[color:var(--accent)]"
          >
            Cart
            {cartCount > 0 && (
              <span
                data-testid="nav-cart-count"
                className="ml-1 rounded bg-[color:var(--primary)] px-1.5 py-0.5 text-xs font-bold text-white"
              >
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import { listProducts } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import { CategoryTiles } from "@/components/CategoryTile";
import { BrandRow } from "@/components/BrandRow";

export default function Home() {
  const onSale = listProducts({ onSale: true }).slice(0, 8);
  const goalieGear = listProducts({ category: "goalie-gear" }).slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-[color:var(--border)]"
        data-testid="hero"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(1200px 500px at 80% 0%, rgba(240, 62, 62, 0.22), transparent 60%), radial-gradient(900px 500px at 10% 100%, rgba(74, 120, 181, 0.18), transparent 60%), linear-gradient(180deg, #0a0d13 0%, #0a0d13 100%)",
          }}
        />
        {/* Rink line decoration */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-32 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(90deg, transparent 0%, transparent 49.5%, rgba(240,62,62,0.8) 49.5%, rgba(240,62,62,0.8) 50.5%, transparent 50.5%, transparent 100%), radial-gradient(400px 80px at 50% 100%, rgba(74,120,181,0.45), transparent 70%)",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <span className="inline-block rounded-full bg-[color:var(--primary)]/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-[color:var(--primary)]">
              🏒 Slapshot Special · Up to 60% off
            </span>
            <h1 className="font-display mt-4 text-5xl leading-[0.95] text-white md:text-7xl">
              DROP THE GLOVES.
              <br />
              <span className="text-[color:var(--accent)]">NOT YOUR BUDGET.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-[color:var(--muted)] md:text-lg">
              Pro-grade sticks, skates, pads, and goalie gear — marked down hard, shipped
              fast. Weekend warriors, junior leagues, and pros alike.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/products?onSale=true"
                data-testid="hero-shop-deals"
                className="rounded-md bg-[color:var(--primary)] px-6 py-3 font-bold text-white shadow-lg hover:opacity-90"
              >
                Shop the Deals
              </Link>
              <Link
                href="/products"
                data-testid="hero-shop-all"
                className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-3 font-bold hover:border-[color:var(--accent)]"
              >
                Browse all gear →
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-5 text-xs text-[color:var(--muted)]">
              <span>✓ Free shipping over $99</span>
              <span>✓ 30-day returns</span>
              <span>✓ Team pricing</span>
            </div>
          </div>
          <div className="relative hidden md:block">
            <div
              className="relative mx-auto h-full w-full max-w-md overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 shadow-2xl"
              style={{ aspectRatio: "1 / 1" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/product-photos/sticks.jpg"
                alt="Apex Velocity Pro Stick"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ filter: "brightness(0.9) saturate(1.08) contrast(1.05)" }}
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"
                aria-hidden="true"
              />
              <div className="absolute left-4 top-4 rounded bg-[color:var(--primary)] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                Featured
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--accent)]">
                  Apex · Pro Series
                </div>
                <div className="font-black text-white">Apex Velocity Pro Stick</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-black text-white">$199.99</span>
                  <span className="text-xs text-white/60 line-through">$289.99</span>
                  <span className="ml-auto rounded bg-[color:var(--primary)] px-1.5 py-0.5 text-[10px] font-black text-white">
                    SAVE 31%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 space-y-14">
        {/* Value prop bar */}
        <section
          className="grid grid-cols-2 gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 md:grid-cols-4"
          data-testid="value-bar"
        >
          <ValueStat icon="🚚" title="Free shipping" body="On orders over $99" />
          <ValueStat icon="↩️" title="30-day returns" body="Easy exchanges" />
          <ValueStat icon="🥅" title="Pro-tested" body="Approved by goalies" />
          <ValueStat icon="💳" title="Team pricing" body="Bulk discounts" />
        </section>

        {/* Shop by category */}
        <section>
          <SectionHeader title="Shop by category" href="/products" />
          <CategoryTiles />
        </section>

        {/* Deals grid */}
        <section>
          <SectionHeader title="Deals of the week" href="/products?onSale=true" accent />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {onSale.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Top brands */}
        <BrandRow />

        {/* Goalie gear spotlight */}
        <section>
          <SectionHeader
            title="Goalie gear worth bragging about"
            href="/products?category=goalie-gear"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {goalieGear.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section
          className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-gradient-to-br from-[#131822] via-[#131822] to-[#0a0d13] p-8 text-center md:p-12"
          data-testid="cta-block"
        >
          <h2 className="font-display text-3xl md:text-4xl">
            Still shopping? <span className="text-[color:var(--primary)]">Drop the mitts.</span>
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[color:var(--muted)]">
            Our team pricing gets your whole roster outfitted without benching the budget.
            Reach out for a custom quote.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/products"
              className="rounded-md bg-[color:var(--primary)] px-5 py-2.5 font-bold text-white"
            >
              Shop everything
            </Link>
            <Link
              href="/register"
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-2.5 font-bold"
            >
              Create account
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  href,
  accent = false,
}: {
  title: string;
  href?: string;
  accent?: boolean;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2
        className={
          accent
            ? "font-display text-2xl text-[color:var(--accent)]"
            : "font-display text-2xl"
        }
      >
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--accent)]"
        >
          See all →
        </Link>
      )}
    </div>
  );
}

function ValueStat({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-[color:var(--muted)]">{body}</div>
      </div>
    </div>
  );
}

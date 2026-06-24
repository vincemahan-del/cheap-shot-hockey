import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { listProducts } from "@/lib/store";
import { formatPrice } from "@/lib/format";
import { readRegion, shippingConfig } from "@/lib/region";
import { ProductCard } from "@/components/ProductCard";
import { CategoryTiles } from "@/components/CategoryTile";
import { BrandRow } from "@/components/BrandRow";

export default async function Home() {
  const t = await getTranslations("home");
  const region = readRegion(await headers());
  const onSale = listProducts({ onSale: true }).slice(0, 8);
  const goalieGear = listProducts({ category: "goalie-gear" }).slice(0, 4);
  const freeShipDisplay = formatPrice(
    shippingConfig(region).freeShipThresholdCents,
    region,
  );

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
              {t("saleBadge")}
            </span>
            <h1 className="font-display mt-4 text-5xl uppercase leading-[0.95] text-white md:text-7xl">
              {t("heroTitleLine1")}
              <br />
              <span className="text-[color:var(--accent)]">{t("heroTitleLine2")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-[color:var(--muted)] md:text-lg">
              {t("heroSubtitle")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/products?onSale=true"
                data-testid="hero-shop-deals"
                className="rounded-md bg-[color:var(--primary)] px-6 py-3 font-bold text-white shadow-lg hover:opacity-90"
              >
                {t("shopDeals")}
              </Link>
              <Link
                href="/products"
                data-testid="hero-shop-all"
                className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-3 font-bold hover:border-[color:var(--accent)]"
              >
                {t("browseAll")}
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-5 text-xs text-[color:var(--muted)]">
              <span>✓ {t("perkShipping", { amount: freeShipDisplay })}</span>
              <span>✓ {t("perkReturns")}</span>
              <span>✓ {t("perkTeam")}</span>
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
                {t("cardFeatured")}
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--accent)]">
                  Apex · Pro Series
                </div>
                <div className="font-black text-white">Apex Velocity Pro Stick</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-black text-white">
                    {formatPrice(19999, region)}
                  </span>
                  <span className="text-xs text-white/60 line-through">
                    {formatPrice(28999, region)}
                  </span>
                  <span className="ml-auto rounded bg-[color:var(--primary)] px-1.5 py-0.5 text-[10px] font-black text-white">
                    {t("heroSave", { pct: 31 })}
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
          <ValueStat
            icon="🚚"
            title={t("valueShippingTitle")}
            body={t("valueShippingBody", { amount: freeShipDisplay })}
          />
          <ValueStat
            icon="↩️"
            title={t("valueReturnsTitle")}
            body={t("valueReturnsBody")}
          />
          <ValueStat
            icon="🥅"
            title={t("valueProTitle")}
            body={t("valueProBody")}
          />
          <ValueStat
            icon="💳"
            title={t("valueTeamTitle")}
            body={t("valueTeamBody")}
          />
        </section>

        {/* Shop by category */}
        <section>
          <SectionHeader title={t("shopByCategory")} href="/products" seeAll={t("seeAll")} />
          <CategoryTiles />
        </section>

        {/* Deals grid */}
        <section>
          <SectionHeader title={t("dealsOfWeek")} href="/products?onSale=true" seeAll={t("seeAll")} accent />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {onSale.map((p) => (
              <ProductCard key={p.id} product={p} region={region} />
            ))}
          </div>
        </section>

        {/* Top brands */}
        <BrandRow />

        {/* Goalie gear spotlight */}
        <section>
          <SectionHeader
            title={t("goalieSpotlight")}
            href="/products?category=goalie-gear"
            seeAll={t("seeAll")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {goalieGear.map((p) => (
              <ProductCard key={p.id} product={p} region={region} />
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section
          className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-gradient-to-br from-[#131822] via-[#131822] to-[#0a0d13] p-8 text-center md:p-12"
          data-testid="cta-block"
        >
          <h2 className="font-display text-3xl md:text-4xl">
            {t("ctaTitle")}{" "}
            <span className="text-[color:var(--primary)]">{t("ctaTitleAccent")}</span>
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[color:var(--muted)]">
            {t("ctaBody")}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/products"
              className="rounded-md bg-[color:var(--primary)] px-5 py-2.5 font-bold text-white"
            >
              {t("shopEverything")}
            </Link>
            <Link
              href="/register"
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-2.5 font-bold"
            >
              {t("createAccount")}
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
  seeAll,
  accent = false,
}: {
  title: string;
  href?: string;
  seeAll?: string;
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
          {seeAll ?? "See all →"}
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

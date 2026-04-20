export function PromoStrip() {
  return (
    <div
      data-testid="promo-strip"
      className="w-full border-b border-[color:var(--border)] bg-[color:var(--surface-2)]"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
        <span>🏒 Free shipping on orders $99+</span>
        <span className="hidden md:inline">Team orders — bulk pricing available</span>
        <span>30-day returns · Easy exchanges</span>
      </div>
    </div>
  );
}

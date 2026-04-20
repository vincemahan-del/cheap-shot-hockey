import { cookies } from "next/headers";

export async function DemoBanner() {
  const jar = await cookies();
  const mode = jar.get("csh_demo")?.value ?? "normal";
  if (mode === "normal") return null;
  const color =
    mode === "slow"
      ? "#60a5fa"
      : mode === "flaky"
        ? "#fbbf24"
        : "#f03e3e";
  const label =
    mode === "slow"
      ? "Demo mode: SLOW — APIs respond with 2.5s delay"
      : mode === "flaky"
        ? "Demo mode: FLAKY — APIs intermittently fail or stall"
        : "Demo mode: BROKEN — APIs return 503 errors";
  return (
    <div
      data-testid="demo-banner"
      className="w-full border-b border-[color:var(--border)] px-4 py-2 text-center text-sm font-semibold"
      style={{ background: `${color}22`, color }}
    >
      ⚠ {label} — append <code>?demo=normal</code> to reset
    </div>
  );
}

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
    // Keep the unit layer fast — UI components that need a DOM go under
    // mabl (UI) and Playwright/Jest later.
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/seed.ts",
        "src/lib/types.ts",
        "src/lib/session.ts",
        "src/lib/cart-cookie.ts",
        "src/lib/order-cookie.ts",
        "src/lib/guest-orders.ts",
      ],
      // Coverage gate — if any of these drop below threshold, the unit
      // job fails and the PR is blocked by branch protection. Current
      // coverage ~98% lines/stmts/funcs, ~96% branches — the 90% gate
      // is a canary, not a stretch goal. Tune up later if drift tolerated.
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});

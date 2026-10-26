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
        "src/lib/orders-db.ts",
        "src/lib/users-db.ts",
        "src/lib/vault-db.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});

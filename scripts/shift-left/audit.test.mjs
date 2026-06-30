// Unit tests for the area-coverage engine.  Run: node --test scripts/shift-left/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { buildMaps, areaOfTestid, tidClassified, normRoute, deriveAreas, resolveFiles, filterSurfaces, tidCovered, surfaceCoverage } from "./engine.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const manifest = yaml.load(fs.readFileSync(path.join(HERE, "coverage.map.yml"), "utf8"));
const maps = buildMaps(manifest);

test("normRoute: dynamic segments -> manifest patterns", () => {
  assert.equal(normRoute("/"), "/");
  assert.equal(normRoute("/products"), "/products");
  assert.equal(normRoute("/products/apex-velocity-pro-stick"), "/products/[slug]");
  assert.equal(normRoute("/orders/o-1001"), "/orders/[id]");
  assert.equal(normRoute("/api/orders/o-1/receipt"), "/api/orders/[id]/receipt");
  assert.equal(normRoute("/deployments/abc"), "/deployments/[label]");
  assert.equal(normRoute("/products?region=ca&lang=fr"), "/products"); // query stripped
  assert.equal(normRoute("/api/deployments/search"), "/api/deployments/search"); // not [label]
});

test("areaOfTestid: longest-prefix precedence (the tricky disambiguations)", () => {
  assert.equal(areaOfTestid("nav-cart", maps), "checkout");        // not nav-cat-/catalog
  assert.equal(areaOfTestid("nav-cart-count", maps), "checkout");
  assert.equal(areaOfTestid("nav-cat-sticks", maps), "catalog");
  assert.equal(areaOfTestid("nav-categories", maps), "catalog");
  assert.equal(areaOfTestid("account-admin-link", maps), "admin"); // not account-/auth
  assert.equal(areaOfTestid("account-email", maps), "auth");
  assert.equal(areaOfTestid("product-card-foo", maps), "catalog");
  assert.equal(areaOfTestid("qty-inc-1", maps), "checkout");
  assert.equal(areaOfTestid("deployment-state-failure", maps), "deployments");
  assert.equal(areaOfTestid("team-orders-submit", maps), "team-orders");
  assert.equal(areaOfTestid("totally-unknown-xyz", maps), null);
});

test("tidClassified: guard accepts area + core + excluded", () => {
  assert.equal(tidClassified("product-card-x", maps), true);  // area
  assert.equal(tidClassified("footer-health", maps), true);   // core
  assert.equal(tidClassified("demo-banner", maps), true);     // excluded
  assert.equal(tidClassified("nav-orders", maps), true);      // area (orders)
  assert.equal(tidClassified("never-seen-this", maps), false);
});

test("deriveAreas: testids drive areas; i18n via ?region/?lang", () => {
  const d = deriveAreas({ testids: ["checkout-tax", "product-card-x"], routes: ["/checkout"] }, maps);
  assert.deepEqual([...d].sort(), ["catalog", "checkout"]);
});

test("deriveAreas: VERIFIES not TRANSIT (a transited route adds no area when testids exist)", () => {
  // asserts on checkout; merely passes through /products (no catalog testid) -> catalog NOT added
  const d = deriveAreas({ testids: ["checkout-submit"], routes: ["/", "/products", "/checkout"] }, maps);
  assert.deepEqual([...d].sort(), ["checkout"]);
});

test("deriveAreas: no-testid test falls back to route base areas (+ i18n via query)", () => {
  const d = deriveAreas({ testids: [], routes: ["/products?region=ca"] }, maps);
  assert.deepEqual([...d].sort(), ["catalog", "i18n"]);
});

test("deriveAreas: i18n earned from query even when testids are structural", () => {
  const d = deriveAreas({ testids: ["product-card-x"], routes: ["/products?region=ca&lang=fr"] }, maps);
  assert.deepEqual([...d].sort(), ["catalog", "i18n"]);
});

test("resolveFiles: args win; '-'/empty read stdin; trim/dedupe/drop-blanks; brackets survive", () => {
  assert.deepEqual(resolveFiles(["a.ts", "b.ts"]), ["a.ts", "b.ts"]);                       // explicit args
  assert.deepEqual(resolveFiles(["-"], "a.ts\nb.ts\n"), ["a.ts", "b.ts"]);                  // stdin via "-"
  assert.deepEqual(resolveFiles([], "a.ts\n\n  b.ts  \na.ts\n"), ["a.ts", "b.ts"]);         // empty->stdin, trim+dedupe
  assert.deepEqual(resolveFiles(["-"], "src/app/products/[slug]/page.tsx\n"), ["src/app/products/[slug]/page.tsx"]); // bracket path intact
});

test("filterSurfaces: keeps only src/ and messages/ (ignores .mabl/docs/config/CI artifacts)", () => {
  const input = [
    "src/components/ProductCard.tsx",
    "src/app/products/[slug]/page.tsx",
    "messages/en.json",
    ".mabl/debug/abc-jr/step-run-x-dom.html",   // the flood we hit in CI
    "docs/SHIFT-LEFT-AGENTIC-TESTING.md",
    ".github/workflows/mabl-sdlc.yml",
    "package.json",
  ];
  assert.deepEqual(filterSurfaces(input), [
    "src/components/ProductCard.tsx",
    "src/app/products/[slug]/page.tsx",
    "messages/en.json",
  ]);
});

test("tidCovered: prefix-aware both directions; uncovered testid reads false", () => {
  const index = [{ testids: ["product-card-apex-velocity-pro-stick", "low-stock-badge-x"] }];
  assert.equal(tidCovered("product-card-", index), true);   // repo template ⊂ test concrete
  assert.equal(tidCovered("low-stock-badge-x", index), true); // exact
  assert.equal(tidCovered("warranty-heading", index), false); // not referenced
});

test("surfaceCoverage: per-area + overall; chrome (unclassified) excluded from denominator", () => {
  const index = [{ testids: ["product-card-apex"] }];               // covers catalog product-card-
  const repoTids = ["product-card-", "sale-badge-", "footer-health"]; // 2 catalog + 1 core chrome
  const { per, featTot, featCov } = surfaceCoverage(repoTids, index, maps);
  assert.equal(featTot, 2);          // footer-health is core → excluded from feature denominator
  assert.equal(featCov, 1);          // only product-card- is covered
  assert.equal(per.catalog.tot, 2);
  assert.equal(per.catalog.cov, 1);
});

test("manifest invariant: area-* vocabulary is exactly the locked 9", () => {
  assert.deepEqual(
    Object.keys(manifest.areas).sort(),
    ["admin", "auth", "catalog", "checkout", "deployments", "i18n", "info", "orders", "team-orders"]
  );
});

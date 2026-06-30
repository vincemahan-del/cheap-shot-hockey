// Unit tests for the area-coverage engine.  Run: node --test scripts/shift-left/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { buildMaps, areaOfTestid, tidClassified, normRoute, deriveAreas } from "./engine.mjs";

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

test("manifest invariant: area-* vocabulary is exactly the locked 9", () => {
  assert.deepEqual(
    Object.keys(manifest.areas).sort(),
    ["admin", "auth", "catalog", "checkout", "deployments", "i18n", "info", "orders", "team-orders"]
  );
});

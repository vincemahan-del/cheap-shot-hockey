// Unit tests for the live-refresh transform. Run: node --test scripts/shift-left/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { extract, normUrl, areaLabels, buildEntry } from "./refresh-index.mjs";

test("normUrl: templated base, host-strip, relative", () => {
  assert.equal(normUrl("{{@web.defaults.url}}"), "/");
  assert.equal(normUrl("https://host.vercel.app/products/foo"), "/products/foo");
  assert.equal(normUrl("https://host.vercel.app/products?region=ca"), "/products?region=ca");
  assert.equal(normUrl("/cart"), "/cart");
});

test("areaLabels: keeps only area-*, strips prefix, sorts", () => {
  assert.deepEqual(areaLabels(["area-catalog", "type-rt", "area-checkout", "TAMD-180"]), ["catalog", "checkout"]);
  assert.deepEqual(areaLabels(["type-smk", "demo"]), []);
});

test("extract: walks nested steps for data_testid / css_query / url (mirrors live shape)", () => {
  // shape mirrors a real mabl_get_test_steps payload (css_query testid, aux data_testid, viewport assert)
  const steps = { flows: [{ steps: [
    { VisitUrl: { url: "{{@web.defaults.url}}" } },
    { StepGroup: { steps: [
      { AssertContains: { target: { findTarget: { css_query: '[data-testid="low-stock-badge-x"]' } } } },
      { Click: { find: { findTarget: {
        selector: { class_name: "abc", url: "https://host/products" },               // no testid on primary
        auxiliaryDescriptors: [{ selector: { data_testid: "product-card-x", url: "https://host/products" } }],
      } } } },
    ] } },
    { StepGroup: { steps: [
      { AssertContains: { target: { findTarget: { selector: { data_testid: "low-stock-notice", url: "https://host/products/crease-guardian-leg-pads" } } } } },
      { AssertAIPrompt: { target: { kind: "Viewport" }, condition: { userPrompt: "no testid here" } } }, // contributes nothing
    ] } },
  ] }] };
  const { tids, urls } = extract(steps);
  assert.deepEqual([...tids].sort(), ["low-stock-badge-x", "low-stock-notice", "product-card-x"]);
  assert.deepEqual([...urls].sort(), ["https://host/products", "https://host/products/crease-guardian-leg-pads", "{{@web.defaults.url}}"]);
});

test("buildEntry: produces a full index entry (testids + routes + area)", () => {
  const steps = { flows: [{ steps: [
    { VisitUrl: { url: "{{@web.defaults.url}}" } },
    { Click: { find: { findTarget: { selector: { data_testid: "product-card-x", url: "https://host/products" } } } } },
    { AssertContains: { target: { findTarget: { selector: { data_testid: "low-stock-notice", url: "https://host/products/foo" } } } } },
  ] }] };
  const entry = buildEntry({ id: "abc-j", name: "low-stock", labels: ["area-catalog", "type-rt", "TAMD-180"] }, steps);
  assert.deepEqual(entry, {
    id: "abc-j", name: "low-stock",
    testids: ["low-stock-notice", "product-card-x"],
    routes: ["/", "/products", "/products/foo"],
    area: ["catalog"],
  });
});

test("buildEntry: viewport-only test (no testids) yields routes + area, empty testids", () => {
  const steps = { flows: [{ steps: [
    { VisitUrl: { url: "https://host/?region=us&lang=fr" } },
    { AssertAIPrompt: { target: { kind: "Viewport" } } },
  ] }] };
  const entry = buildEntry({ id: "x-j", name: "locale", labels: ["area-i18n"] }, steps);
  assert.deepEqual(entry.testids, []);
  assert.deepEqual(entry.routes, ["/?region=us&lang=fr"]);
  assert.deepEqual(entry.area, ["i18n"]);
});

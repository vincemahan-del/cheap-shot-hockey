#!/usr/bin/env node
/**
 * generate-rum-mock.mjs — Generate curated mock RUM journey data.
 *
 * Produces a journey log that matches the loadgen output contract but
 * is *deterministic and demo-curated* — includes deliberate coverage
 * gaps that match real findings (TAMD-119 brand filter, search
 * journey, mobile-specific abandonment patterns) so the analyzer
 * surfaces interesting gaps every run.
 *
 * Use this instead of the Playwright loadgen when:
 *   - You need instant data (no 3-min loadgen wait)
 *   - You need deterministic demo output
 *   - Vercel Analytics filters your synthetic traffic anyway, so
 *     real RUM dashboard population isn't possible — but the agent's
 *     gap analysis works the same on mock data
 *
 * Usage:
 *   node scripts/generate-rum-mock.mjs                       # default 150 sessions
 *   node scripts/generate-rum-mock.mjs --sessions 300        # bigger sample
 *   node scripts/generate-rum-mock.mjs --scenario gap-heavy  # bias toward uncovered journeys
 *   node scripts/generate-rum-mock.mjs --seed 42             # reproducible randomization
 *
 * Output: /tmp/loadgen-journeys.json (same path as the live loadgen).
 */

import fs from "fs/promises";

// ─── Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const TOTAL_SESSIONS = parseInt(flag("sessions", "150"), 10);
const SCENARIO = flag("scenario", "realistic"); // realistic | gap-heavy | mobile-skewed
const SEED = parseInt(flag("seed", "0"), 10);
const TARGET = "https://cheap-shot-hockey.vercel.app";
const OUT_PATH = "/tmp/loadgen-journeys.json";

// Seedable RNG so demos are reproducible if SEED > 0
let _rng = SEED > 0 ? mulberry32(SEED) : Math.random;
function mulberry32(s) {
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(arr) { return arr[Math.floor(_rng() * arr.length)]; }
function pickWeighted(arr) {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let n = _rng() * total;
  for (const x of arr) { if ((n -= x.weight) <= 0) return x; }
  return arr[0];
}

// ─── Journey catalog ────────────────────────────────────────────────────
//
// Curated to include real-world patterns AND deliberate gaps.
// Journeys marked "GAP" are intentionally uncovered by current mabl tests —
// they're what the analyzer should surface.

const JOURNEYS = {
  realistic: [
    // Top of funnel — high volume, mostly already covered
    { name: "browse-and-bounce", weight: 35, urls: ["/"] },
    { name: "product-detail-deep-dive", weight: 18, urls: ["/", "/products/[slug]", "/products"] },
    { name: "add-to-cart-no-checkout", weight: 12, urls: ["/", "/products/[slug]", "/cart"] },
    { name: "complete-checkout-guest", weight: 6, urls: ["/", "/products/[slug]", "/cart", "/checkout"] },
    { name: "login-and-view-account", weight: 5, urls: ["/", "/login", "/account"] },

    // GAPS — match TAMD-119 / audit findings + common e-commerce patterns
    // mabl has no test for these despite real users doing them
    { name: "search-for-product", weight: 8, urls: ["/", "/products?q=[query]", "/products/[slug]"] },
    { name: "filter-by-brand", weight: 6, urls: ["/", "/products?brand=[brand]", "/products/[slug]"] },
    { name: "filter-by-category", weight: 4, urls: ["/", "/products?category=[cat]", "/products/[slug]"] },
    { name: "mobile-checkout-abandon-at-shipping", weight: 3, urls: ["/", "/products/[slug]", "/cart", "/checkout"], mobileOnly: true },

    // Tail
    { name: "register-new-user", weight: 1.5, urls: ["/", "/register", "/login"] },
    { name: "shipping-info-research", weight: 1.5, urls: ["/", "/shipping"] },
  ],
  "gap-heavy": [
    // Same set but biases harder toward uncovered journeys, for demos
    // where you want the gaps to dominate the top of the report.
    { name: "search-for-product", weight: 25, urls: ["/", "/products?q=[query]", "/products/[slug]"] },
    { name: "filter-by-brand", weight: 20, urls: ["/", "/products?brand=[brand]", "/products/[slug]"] },
    { name: "filter-by-category", weight: 15, urls: ["/", "/products?category=[cat]", "/products/[slug]"] },
    { name: "mobile-checkout-abandon-at-shipping", weight: 12, urls: ["/", "/products/[slug]", "/cart", "/checkout"], mobileOnly: true },
    { name: "browse-and-bounce", weight: 10, urls: ["/"] },
    { name: "product-detail-deep-dive", weight: 8, urls: ["/", "/products/[slug]", "/products"] },
    { name: "complete-checkout-guest", weight: 5, urls: ["/", "/products/[slug]", "/cart", "/checkout"] },
    { name: "login-and-view-account", weight: 3, urls: ["/", "/login", "/account"] },
    { name: "register-new-user", weight: 2, urls: ["/", "/register", "/login"] },
  ],
};

// ─── Variety pools ──────────────────────────────────────────────────────

const DEVICES_DESKTOP = ["desktop-chrome-1440", "desktop-chrome-1920", "desktop-safari-mac", "desktop-firefox", "desktop-edge"];
const DEVICES_MOBILE = ["iphone-15-pro", "iphone-14", "pixel-8", "pixel-7", "ipad-mini", "samsung-galaxy-s23"];
const LOCALES = ["en-US", "en-GB", "en-CA", "en-AU", "fr-CA"];
const TIMEZONES = [
  "America/New_York", "America/Los_Angeles", "America/Chicago", "America/Denver",
  "America/Toronto", "Europe/London", "Europe/Dublin",
];

// For URL substitution
const PRODUCT_SLUGS = [
  "apex-velocity-pro-stick", "cyclone-pro-skates", "blizzard-elite-helmet",
  "ironside-shoulder-pads", "tempest-goalie-mask", "arctic-pro-gloves",
  "thunder-junior-stick", "frost-edge-skates",
];
const BRANDS = ["apex", "ironline", "glacier", "coldfire", "summit", "tempest"];
const CATEGORIES = ["sticks", "skates", "helmets", "gloves", "pads", "jerseys"];
const SEARCH_QUERIES = ["stick", "skates", "helmet", "pro", "junior", "youth", "goalie", "sale"];

function substituteUrl(url) {
  return url
    .replace("[slug]", pick(PRODUCT_SLUGS))
    .replace("[brand]", pick(BRANDS))
    .replace("[cat]", pick(CATEGORIES))
    .replace("[query]", pick(SEARCH_QUERIES));
}

// ─── Generate one session ────────────────────────────────────────────────

function generateSession(sessionId) {
  const catalog = JOURNEYS[SCENARIO] || JOURNEYS.realistic;
  const journey = pickWeighted(catalog);

  const isMobile = journey.mobileOnly === true || _rng() < 0.45;
  const device = isMobile ? pick(DEVICES_MOBILE) : pick(DEVICES_DESKTOP);

  const startTime = new Date(Date.now() - Math.floor(_rng() * 86400 * 1000));
  const duration = 2000 + Math.floor(_rng() * 15000); // 2-17s

  return {
    sessionId,
    journey: journey.name,
    device,
    locale: pick(LOCALES),
    timezone: pick(TIMEZONES),
    urls: journey.urls.map(substituteUrl),
    startedAt: startTime.toISOString(),
    completedAt: new Date(startTime.getTime() + duration).toISOString(),
    status: _rng() < 0.97 ? "ok" : "error", // 3% mock error rate
    error: null,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎭 generate-rum-mock — generating ${TOTAL_SESSIONS} mock sessions`);
  console.log(`   Scenario: ${SCENARIO}`);
  console.log(`   Seed: ${SEED || "random"}`);
  console.log(`   Target: ${TARGET}\n`);

  const sessions = [];
  for (let i = 1; i <= TOTAL_SESSIONS; i++) {
    sessions.push(generateSession(i));
  }

  const log = {
    target: TARGET,
    totalSessions: TOTAL_SESSIONS,
    completedAt: new Date().toISOString(),
    source: "mock",
    scenario: SCENARIO,
    seed: SEED || null,
    sessions,
  };

  await fs.writeFile(OUT_PATH, JSON.stringify(log, null, 2));

  // Summary (same format as loadgen)
  const byJourney = {};
  const byDevice = {};
  let errors = 0;
  for (const s of sessions) {
    byJourney[s.journey] = (byJourney[s.journey] || 0) + 1;
    byDevice[s.device] = (byDevice[s.device] || 0) + 1;
    if (s.status !== "ok") errors++;
  }

  console.log(`📊 Generated`);
  console.log(`   Total sessions: ${sessions.length}, errors: ${errors}\n`);
  console.log(`   By journey (ranked):`);
  for (const [j, n] of Object.entries(byJourney).sort((a, b) => b[1] - a[1])) {
    const pct = ((n / sessions.length) * 100).toFixed(1).padStart(4);
    console.log(`     ${n.toString().padStart(4)} (${pct}%)  ${j}`);
  }
  console.log(`\n   By device (ranked):`);
  for (const [d, n] of Object.entries(byDevice).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${n.toString().padStart(4)}  ${d}`);
  }

  console.log(`\n📝 Mock journey log written to ${OUT_PATH}`);
  console.log(`   Open Claude Code and invoke the rum-coverage-analyzer agent:\n`);
  console.log(`     Use the rum-coverage-analyzer subagent to analyze /tmp/loadgen-journeys.json`);
  console.log(`     and tell me which top journeys are uncovered.\n`);
}

main().catch((e) => {
  console.error("mock generator failed:", e);
  process.exit(1);
});

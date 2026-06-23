#!/usr/bin/env node
/**
 * loadgen-rum.mjs — Generate realistic user-journey traffic against a target URL.
 *
 * Purpose: populate Vercel Analytics (RUM) with believable real-user-shaped
 * traffic for the RUM-coverage-analyzer POC. Each "user" runs one of seven
 * pre-defined journeys with realistic dwell times, viewport sizes, and
 * locales. Journeys are logged to /tmp/loadgen-journeys.json so the analyzer
 * agent can read them as proxy "real user journey" data.
 *
 * In production, the analyzer would read journeys from the Vercel Analytics
 * API instead of this log. The script is intentionally separate so the agent
 * pattern is independent of the data source.
 *
 * Usage:
 *   node scripts/loadgen-rum.mjs                       # default: 30 sessions vs prod
 *   node scripts/loadgen-rum.mjs --sessions 50         # 50 sessions
 *   node scripts/loadgen-rum.mjs --url <target>        # different URL
 *   node scripts/loadgen-rum.mjs --headed              # show browser windows (slow)
 *
 * Notes on bot filtering:
 *   Vercel Analytics filters known bot user-agents. This script uses real
 *   Chromium with normal UAs + realistic browser context (locale, timezone,
 *   viewport), so most journeys land in the dashboard. Some may still be
 *   filtered by IP heuristics — that's expected.
 */

import { chromium, devices } from "playwright";
import fs from "fs/promises";
import path from "path";

// ─── Config ──────────────────────────────────────────────────────────────

const DEFAULT_URL = "https://cheap-shot-hockey.vercel.app";
const JOURNEY_LOG = "/tmp/loadgen-journeys.json";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const TARGET = flag("url", DEFAULT_URL).replace(/\/$/, "");
const TOTAL_SESSIONS = parseInt(flag("sessions", "30"), 10);
const HEADED = has("headed");

// ─── Journey definitions ─────────────────────────────────────────────────
//
// Each journey is a sequence of steps. The analyzer reads these as proxy
// "real user journeys" for the gap analysis.

const JOURNEYS = [
  {
    name: "browse-and-bounce",
    weight: 25, // % of sessions
    description: "Land on home, browse 2-3 product cards, leave without buying",
    steps: [
      { type: "goto", url: "/" },
      { type: "dwell", ms: 3500 },
      { type: "scroll", amount: 600 },
      { type: "dwell", ms: 2000 },
    ],
  },
  {
    name: "product-detail-deep-dive",
    weight: 20,
    description: "Home → product card → detail page → back to catalog",
    steps: [
      { type: "goto", url: "/" },
      { type: "dwell", ms: 2000 },
      { type: "click", selector: '[data-testid^="product-card-"]' },
      { type: "waitUrl", pattern: "/products/" },
      { type: "dwell", ms: 4500 },
      { type: "scroll", amount: 400 },
      { type: "goto", url: "/products" },
      { type: "dwell", ms: 2500 },
    ],
  },
  {
    name: "add-to-cart-no-checkout",
    weight: 18,
    description: "Find product → add to cart → view cart → abandon",
    steps: [
      { type: "goto", url: "/" },
      { type: "dwell", ms: 1500 },
      { type: "click", selector: '[data-testid^="product-card-"]' },
      { type: "waitUrl", pattern: "/products/" },
      { type: "dwell", ms: 3000 },
      { type: "click", selector: '[data-testid^="add-to-cart-"]' },
      { type: "dwell", ms: 1000 },
      { type: "goto", url: "/cart" },
      { type: "dwell", ms: 4000 },
    ],
  },
  {
    name: "complete-checkout-guest",
    weight: 12,
    description: "Full purchase as guest — product → cart → checkout → confirmation",
    steps: [
      { type: "goto", url: "/" },
      { type: "dwell", ms: 1500 },
      { type: "click", selector: '[data-testid^="product-card-"]' },
      { type: "waitUrl", pattern: "/products/" },
      { type: "dwell", ms: 2500 },
      { type: "click", selector: '[data-testid^="add-to-cart-"]' },
      { type: "dwell", ms: 1000 },
      { type: "goto", url: "/cart" },
      { type: "dwell", ms: 2000 },
      { type: "click", selector: '[data-testid="cart-checkout"]' },
      { type: "waitUrl", pattern: "/checkout" },
      { type: "dwell", ms: 3500 },
    ],
  },
  {
    name: "login-and-view-account",
    weight: 10,
    description: "Returning user — login → account → orders history",
    steps: [
      { type: "goto", url: "/" },
      { type: "dwell", ms: 1000 },
      { type: "goto", url: "/login" },
      { type: "dwell", ms: 2500 },
      { type: "goto", url: "/account" },
      { type: "dwell", ms: 3000 },
    ],
  },
  {
    name: "register-new-user",
    weight: 8,
    description: "New user registration flow",
    steps: [
      { type: "goto", url: "/" },
      { type: "dwell", ms: 1500 },
      { type: "goto", url: "/register" },
      { type: "dwell", ms: 4000 },
    ],
  },
  {
    name: "shipping-info-research",
    weight: 7,
    description: "Pre-purchase shipping/policy lookup",
    steps: [
      { type: "goto", url: "/" },
      { type: "dwell", ms: 2000 },
      { type: "goto", url: "/shipping" },
      { type: "dwell", ms: 5000 },
      { type: "scroll", amount: 500 },
      { type: "dwell", ms: 2000 },
    ],
  },
];

// ─── Device profiles for realistic variety ───────────────────────────────

const DEVICE_PROFILES = [
  { name: "desktop-chrome-1440", config: { viewport: { width: 1440, height: 900 } } },
  { name: "desktop-chrome-1920", config: { viewport: { width: 1920, height: 1080 } } },
  { name: "desktop-safari-mac", config: devices["Desktop Safari"] },
  { name: "iphone-15-pro", config: devices["iPhone 15 Pro"] },
  { name: "pixel-8", config: devices["Pixel 7"] }, // closest Playwright preset
  { name: "ipad-mini", config: devices["iPad Mini"] },
];

const LOCALES = ["en-US", "en-GB", "en-CA"];
const TIMEZONES = ["America/New_York", "America/Los_Angeles", "America/Chicago", "Europe/London"];

// ─── Journey selection (weighted random) ─────────────────────────────────

function pickJourney() {
  const total = JOURNEYS.reduce((s, j) => s + j.weight, 0);
  let n = Math.random() * total;
  for (const j of JOURNEYS) {
    if ((n -= j.weight) <= 0) return j;
  }
  return JOURNEYS[0];
}

function pickDevice() {
  return DEVICE_PROFILES[Math.floor(Math.random() * DEVICE_PROFILES.length)];
}

function pickLocale() {
  return LOCALES[Math.floor(Math.random() * LOCALES.length)];
}

function pickTimezone() {
  return TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];
}

// ─── Step executors ──────────────────────────────────────────────────────

async function runStep(page, step, ctx) {
  switch (step.type) {
    case "goto": {
      const url = `${TARGET}${step.url}`;
      ctx.urls.push(step.url);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      return;
    }
    case "dwell":
      await page.waitForTimeout(step.ms);
      return;
    case "scroll":
      await page.evaluate((amt) => window.scrollBy(0, amt), step.amount);
      return;
    case "click": {
      const el = page.locator(step.selector).first();
      if (await el.count()) {
        await el.click({ trial: false, timeout: 5000 }).catch(() => {});
      }
      return;
    }
    case "waitUrl":
      await page.waitForURL(new RegExp(step.pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")), { timeout: 8000 }).catch(() => {});
      ctx.urls.push(page.url().replace(TARGET, ""));
      return;
  }
}

// ─── Session runner ──────────────────────────────────────────────────────

async function runSession(browser, sessionId, log) {
  const journey = pickJourney();
  const device = pickDevice();
  const locale = pickLocale();
  const timezone = pickTimezone();

  const ctx = await browser.newContext({
    ...device.config,
    locale,
    timezoneId: timezone,
    // Use a real-Chrome UA when device.config doesn't supply one
    ...(device.config.userAgent ? {} : { userAgent: undefined }),
  });

  const page = await ctx.newPage();
  const result = {
    sessionId,
    journey: journey.name,
    device: device.name,
    locale,
    timezone,
    urls: [],
    startedAt: new Date().toISOString(),
    status: "ok",
    error: null,
  };

  try {
    for (const step of journey.steps) {
      await runStep(page, step, result);
    }
  } catch (e) {
    result.status = "error";
    result.error = e.message;
  } finally {
    result.completedAt = new Date().toISOString();
    await ctx.close();
  }

  log.push(result);
  const u = result.urls.length ? result.urls.join(" → ") : "(no urls)";
  const tag = result.status === "ok" ? "✓" : "✗";
  console.log(`  ${tag} #${sessionId} ${journey.name} [${device.name}] ${u}`);
  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏒 loadgen-rum — driving ${TOTAL_SESSIONS} sessions against ${TARGET}`);
  console.log(`   ${JOURNEYS.length} journeys, ${DEVICE_PROFILES.length} device profiles, ${LOCALES.length} locales`);
  console.log(`   Mode: ${HEADED ? "headed" : "headless"}\n`);

  const browser = await chromium.launch({ headless: !HEADED });
  const log = [];

  // Run sessions in small concurrent batches (5 at a time) to avoid overloading
  const BATCH = 5;
  for (let i = 0; i < TOTAL_SESSIONS; i += BATCH) {
    const tasks = [];
    for (let j = 0; j < BATCH && i + j < TOTAL_SESSIONS; j++) {
      tasks.push(runSession(browser, i + j + 1, log));
    }
    await Promise.all(tasks);
    // Stagger between batches so it doesn't look like a flood
    await new Promise((r) => setTimeout(r, 2000));
  }

  await browser.close();

  // Write journey log for the analyzer
  await fs.writeFile(JOURNEY_LOG, JSON.stringify({
    target: TARGET,
    totalSessions: TOTAL_SESSIONS,
    completedAt: new Date().toISOString(),
    sessions: log,
  }, null, 2));

  // Summary
  const byJourney = {};
  const byDevice = {};
  let errors = 0;
  for (const r of log) {
    byJourney[r.journey] = (byJourney[r.journey] || 0) + 1;
    byDevice[r.device] = (byDevice[r.device] || 0) + 1;
    if (r.status !== "ok") errors++;
  }

  console.log(`\n📊 Summary`);
  console.log(`   Total sessions: ${log.length}, errors: ${errors}`);
  console.log(`\n   By journey:`);
  for (const [j, n] of Object.entries(byJourney).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${n.toString().padStart(3)}  ${j}`);
  }
  console.log(`\n   By device:`);
  for (const [d, n] of Object.entries(byDevice).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${n.toString().padStart(3)}  ${d}`);
  }

  console.log(`\n📝 Journey log written to ${JOURNEY_LOG}`);
  console.log(`   Run \`npx claude\` and invoke the rum-coverage-analyzer agent to read it.\n`);
}

main().catch((e) => {
  console.error("loadgen failed:", e);
  process.exit(1);
});

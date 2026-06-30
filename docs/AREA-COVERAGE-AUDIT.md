# `area-coverage-audit` — skill spec

**Status:** Spec for discussion · **Date:** 2026-06-30
**Purpose:** Keep the app→test area model honest and current — the "revisited regularly,
self-correcting" mechanism for the shift-left coverage engine
(see [SHIFT-LEFT-AGENTIC-TESTING.md](SHIFT-LEFT-AGENTIC-TESTING.md)).
**Operates on:** `scripts/shift-left/coverage.map.yml` (the version-controlled manifest)
and the live mabl test catalog.

---

## What it does (one run)

```
1. SWEEP    repo → enumerate every page route, api route, component, src/lib module, i18n namespace, testid.
2. CLASSIFY each surface → area / core / excluded / platform, per coverage.map.yml.
3. GUARD    any surface matching NO classification → FAIL with "unclassified surface".
            (This is how a NEW area is detected — e.g. /wishlist → proposes `area-wishlist`.)
4. DERIVE   for each mabl test, compute area-* from the testids/routes it VERIFIES
            (asserts on / meaningfully interacts with — not mere transit).
5. RECONCILE derived area-* vs the test's current mabl labels:
              - missing  → add  (area-*, GA edit_mabl_test)
              - stale    → remove (area-* only)
              - never touch non-area labels (WIP, Demo, demo, seed-db, dt-demo, TAMD-* …)
6. REPORT   coverage by area · zero-coverage areas · label drift · unclassified surfaces · component-level gaps.
```

## Outputs (the three goals)

- **Coverage** — per-area covered/zero-coverage, rolled up from testid-prefix (component) detail.
  Zero-coverage areas today: `team-orders` (priority — a real form flow), `info`.
- **Test maintenance** — label-drift list: tests whose `area-*` no longer match what they verify;
  applied automatically (add/remove within `area-*`).
- **New-test suggestion** — zero-coverage areas + uncovered component prefixes (e.g. the `qty-*`
  cart-edit flow inside covered `checkout`) → candidates for authoring.

## Guardrails (non-negotiable)

- **Namespace isolation:** mutates ONLY the `area-*` label namespace. Human/other labels untouched.
- **Controlled vocabulary:** applies/accepts only `area-*` values defined in `coverage.map.yml`;
  a new area must be added to the manifest first (proposed by the audit, approved by a human).
- **Derive from VERIFICATION, not transit:** an area is earned by an assertion or meaningful
  interaction (`actionCode` assert > state-changing click), not a pass-through `VisitUrl`.
- **Manifest = definitions only:** the audit never writes coverage status back into the manifest;
  it proposes manifest *definition* diffs (new/changed classifications) for human review.
- **Writes are add/remove of labels (GA `edit_mabl_test`)** — not the flag-gated authoring path;
  no test steps are modified. Reversible.
- **Reports unclassified before mutating** — never silently force-fit a surface into an area.

## Cadence & placement

- **Scheduled** (weekly/monthly) — the "revisited regularly" pass (fits the existing
  scheduled-task pattern in this repo). Posts the report; proposes manifest diffs.
- **CI guard on PR** — step 3 only (completeness): fail if a changed route/lib/component/testid
  is unclassified, so the taxonomy can't silently fall behind the app.
- **Authoring hook** — when a test is created/updated, derive + apply its `area-*` immediately
  (steps 4–5 for one test), so labels are correct at birth, not just at the next sweep.

## Inputs / dependencies

- `coverage.map.yml` (manifest) — the area definitions + core/excluded/platform.
- Repo working tree — for the sweep (deterministic, AST/parse for testids incl. templated).
- mabl MCP/CLI — `get_mabl_tests`, `mabl_get_test_steps` (read), `edit_mabl_test` add/remove_label (write).
- Degrades gracefully: if mabl is unreachable, steps 1–3 (sweep/classify/guard) + the manifest
  diff still run from cache; only the live reconcile (4–6) waits.

## Out of scope (deliberately, for now)

- Risk/priority tiers (area-only, per decision 2026-06-30).
- Test-step edits / triage / new-test authoring (separate engine phases).
- Non-area labels of any kind.

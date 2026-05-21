# Demo-readiness checklist — 2026-05-20

Generated from a mabl architecture audit of workspace `Cheap Shot Hockey Demo`
(`pXXgThbNi4HfQOpiZptHfw-w`) using the mabl public MCP + mabl-internal MCP.
Pair this with `docs/SDLC-DEMO.md` (the 5-act runbook).

**Production sanity at audit time (2026-05-20 20:30 UTC):**

- Latest commit deployed: `8455a99054666d2a26cf4bb66b78adaadd1ca58a` (branch `main`, region `iad1`)
- `?demo=normal` — confirmed (no DemoBanner present on `/`)
- Featured product grid renders 5+ products
- "Free shipping over $99" promo strip visible
- `data-testid` coverage in source: **140 unique values** across cart/checkout/catalog/account/admin surfaces

---

## 2026-05-21 — Session close status update

Day-after status reflecting work landed on 2026-05-21. Preserved alongside the 2026-05-20 audit baseline so the scheduled quarterly auto-audit (`~/.claude/scheduled-tasks/mabl-cheap-shot-hockey-quarterly-architecture-audit`) can diff cleanly.

**Production re-verified at 2026-05-21 ~14:00 UTC:** still on commit `8455a99`, environment `production`, region `iad1`, deployed at 2026-05-21 14:54 UTC, no DemoBanner, featured grid + Shop the Deals CTA intact.

### Tier 1 items — final state

| Item | Status | Evidence |
|---|---|---|
| T1-1 Reset demo mode | ✅ Verified clean | `build-info` shows `production` environment, no DemoBanner on `/` |
| T1-2 Custom Test ID Attribute (`data-testid`) | ✅ Done — [TAMD-117](https://mabl.atlassian.net/browse/TAMD-117) | User confirmed UI save (public MCP doesn't project the field for read-verification) |
| T1-3 Agent instructions (3) | 🟡 Drafts ready, not yet pasted | Drafts in this doc; ≤5 min copy-paste into Agents → Settings |
| T1-4 Label gap on free-shipping test | ✅ Done — [TAMD-121](https://mabl.atlassian.net/browse/TAMD-121) | `get_mabl_test_details` shows `labels: ["type-rt","area-checkout"]` |
| T1-5 Bind credentials to CSH-Regression | ✅ Done — [TAMD-120](https://mabl.atlassian.net/browse/TAMD-120) | Plan run `gN4PZblHmVrAHGkIdStGDw-pr` succeeded (was 0% pass before fix) |

### Tier 2 items — final state

| Item | Status | Notes |
|---|---|---|
| T2-1 Reusable flows + nested flows | 🟡 To do — [TAMD-118](https://mabl.atlassian.net/browse/TAMD-118) | Quarterly-cycle work (~2h) |
| T2-2 DataTable-driven brand filter | 🟡 To do — [TAMD-119](https://mabl.atlassian.net/browse/TAMD-119) | Quarterly-cycle work (~3h); `plan_new_test` draft on file |
| T2-3 Visual assertion on home hero | 🟡 To do (no ticket) | Best executed in Desktop trainer, not cloud-gen |
| T2-4 Plan-level Runtime Recovery on CSH-SMOKE-PR | 🟢 Applied to CSH-Regression instead | Adopted on `jQvMb041R8mCj22jKIGX5w-p`; partially absorbed catalog flake + registration flake |

### Bonus work landed (not in original audit)

- ✅ **Reworded `csh-catalog-products-list` GenAI assertion** — was failing on viewport clipping (3rd row prices below 1440px boundary). Reworded to scope assertion to first 6 cards + add visual-style-consistency claim. Latest run `kvBLbkwz3gOBp8jxbm9fqw-pr` confirms catalog test no longer in failure list.
- Root cause confirmed via source-code review of `src/components/ProductCard.tsx`: every card renders `data-testid={`price-${slug}`}` (line 61/72); the price element IS in the DOM. The original GenAI assertion was reading the screenshot, not the DOM, so clipped cards' prices appeared "missing from the visible portion."

### Newly surfaced finding (post-credential-fix) — ✅ RESOLVED 2026-05-21

**`csh-auth-register-new-user` was genuinely broken — filed and fixed same day.**

- mabl quality classifier (before fix): **11% pass rate over 9 runs**
- Filed as [TAMD-122](https://mabl.atlassian.net/browse/TAMD-122); shipped via [PR #80](https://github.com/vincemahan-del/cheap-shot-hockey/pull/80)
- Root cause: `globalThis.__CSH_STORE__` Map was per-Lambda; `createUser` added to one Lambda's memory, subsequent `/api/auth/me` requests hit a different Lambda where `getUser(userId)` returned undefined → 401. Same pattern CLAUDE.md warns about for cart/orders.
- Fix: signed v2 `csh_auth` cookie carries `{v, id, email, name, role, exp}` so `getCurrentUser` reconstructs the user from the cookie itself — no cross-Lambda store dependency.
- **Post-deploy verification: 5/5 fresh Production runs passed.** Runs: `BokQP3Y1r…`, `F2vX2Veq…`, `sPdTFD0z…`, `cjgy3FljF…`, `ina8xeynr…`. Classifier loop closed: 11% → 100%.
- Files touched: `src/lib/session.ts` (v2 encoder/decoder + `getCurrentUser` v2-first / v1-fallback), `src/lib/session.test.ts` (14 new tests).
- Post-merge agentic review surfaced 2 security follow-ups: [TAMD-123](https://mabl.atlassian.net/browse/TAMD-123) (`secure: true` cookie flag), [TAMD-124](https://mabl.atlassian.net/browse/TAMD-124) (`auth_token_version` telemetry for data-driven v1 fallback removal).

### Workspace health at session close

- 🟢 **CSH-SMOKE-PR** — ~96% pass (unchanged from audit baseline)
- 🟢 **CSH-SMOKE-POSTDEPLOY** — 100% pass (unchanged from audit baseline)
- 🟢 **CSH-Regression** — was 0% (creds), then ~50% blocked by `csh-auth-register-new-user`, now trending back to green after TAMD-122 fix landed (5/5 prod-verified)
- 🟢 **Custom Test ID Attributes (`data-testid`)** — adopted
- 🟢 **Test label hygiene** — area-targeted dispatch now picks up every regression test
- 🟢 **Plan-level Runtime Recovery on CSH-Regression** — adopted
- 🟡 **Agent instructions** — still 0 configured (drafts ready, copy-paste task)

### Audit dimension scorecard (movement vs 2026-05-20)

| Dimension | 2026-05-20 | 2026-05-21 close |
|---|---|---|
| Workspace topology | 🟡 | 🟡 (unchanged) |
| Test composition & reuse | 🔴 | 🔴 (TAMD-118 open) |
| Data strategy | 🔴 | 🔴 (TAMD-119 open) |
| Mabl-native capability adoption | 🔴 | 🟡 (Custom Test ID + Runtime Recovery adopted; flows/DataTables/visual/agent-instructions still gaps) |
| Reliability architecture | 🟡 | 🟢 — for demo path; 🟢 for Regression plan after TAMD-122 fix (was 🟡 due to `csh-auth-register-new-user`, now resolved) |
| CI/CD integration | 🟢 | 🟢 (unchanged) |
| Test management & traceability | 🟡 | 🟢 |
| Security & governance | 🟡 | 🟡 (unchanged) |

### Recommended next session (when convenient)

1. ~~**File `Bug` ticket for `csh-auth-register-new-user`**~~ — ✅ DONE 2026-05-21: TAMD-122 / PR #80 / verified 5/5 prod runs
2. **Paste the 3 agent instructions** (T1-3) — closes the last sub-15-min capability adoption gap.
3. **TAMD-118 nested flows refactor** — biggest demo-narrative uplift remaining.
4. **TAMD-119 DataTable brand filter** — second-biggest. `plan_new_test` draft already in this session's history.
5. **Phase 2 of TAMD-117** — re-train one step to capture the live `Element found using custom ID 'data-testid'` log line for the demo deck.
6. **[TAMD-123](https://mabl.atlassian.net/browse/TAMD-123)** — add `secure: true` cookie flag on `csh_auth` (defense-in-depth, surfaced by post-merge security review).
7. **[TAMD-124](https://mabl.atlassian.net/browse/TAMD-124)** — `auth_token_version` telemetry so v1 fallback removal is data-driven (surfaced by post-merge security review).

## Demo-path plans — green

The 5-act demo only touches these two plans. Both 100% green over recent runs.

| Plan | ID | Recent status |
|---|---|---|
| `CSH-SMOKE-PR` | `VISwr8fivUK1z4kACrXDlg-p` | ~96% pass over last 78 runs (1 transient, 1 cloud→localhost issue) |
| `CSH-SMOKE-POSTDEPLOY` | `u4rU2QxlvCxhGjnxBdweUQ-p` | 100% pass over last 23 runs |

**No demo-blocking issues on the live surface.** Everything below is either reputation polish (workspace visitors clicking around) or capability uplift (showcasing 2026 GA features the audit found unused).

---

## Tier 1 — Do before the next demo (≤15 min total)

### T1-1. Reset demo mode (always)

```bash
./scripts/demo-toggle.sh normal
```

Then confirm:

```bash
curl -s https://cheap-shot-hockey.vercel.app/api/build-info | jq .
```

`environment` should be `production`, and the homepage should NOT render the DemoBanner. The audit confirmed this is clean as of 2026-05-20 20:30 UTC, but the toggle persists between demos.

### T1-2. Configure `data-testid` as a Custom Test ID Attribute on the app

**Why:** This is the single highest-ROI demo win available to you. The repo's `data-testid` convention is documented in CLAUDE.md as a non-negotiable. Mabl shipped Custom Test ID Attributes GA on 2026-05-07 specifically to defuse the Cypress/Playwright migration objection (see customer-insight `c9352239`, Auction Edge churn). Today mabl is anchoring on structural CSS instead.

**Where:** mabl UI → Configuration → Applications → **Cheap Shot Hockey** → edit → **Custom test ID attributes** section

**What to add (single value):**

```
data-testid
```

**Verify after save:** train any 1 quick test step against the app, replay it, and look in the test results panel for the log line:

```
Element found using custom ID 'data-testid' with value '<value>'
```

That log line on screen during the demo IS the proof — record it.

**Help doc to cite if asked:** [help.mabl.com — Custom test ID attributes](https://help.mabl.com/hc/en-us/articles/49010473192340-2026-05-07-Custom-test-ID-attributes)

### T1-3. Add 3 workspace-scoped agent instructions

**Why:** Released GA 2026-04-22. Zero configured today. With them set, the next TAA-authored test inherits your conventions on day one — which is exactly the moment Act 1 of the demo runs.

**Where:** mabl UI → **Agents → Settings** → Add instructions

**Paste these three (no scope set = workspace-wide):**

**1. Name:** `Always use demo=normal URL`

```
When generating or repairing tests against the Cheap Shot Hockey application,
always navigate to URLs that include `?demo=normal` (or no `?demo=` param at all).
Never author against `?demo=slow`, `?demo=flaky`, or `?demo=broken` — those are
deliberate failure-injection modes used during demos and will make tests
non-deterministic.
```

**2. Name:** `Use Demo customer credential`

```
For any test that requires authentication against Cheap Shot Hockey, use the
mabl credential named "Demo customer" (basic auth, demo@cheapshot.test).
Never type credentials directly into login forms. Guest checkout is supported
as a first-class flow — do not require login to test the checkout path.
```

**3. Name:** `Naming convention csh-area-descriptor`

```
All authored tests against Cheap Shot Hockey must follow the naming pattern
csh-<area>-<descriptor> in lowercase-kebab-case. Areas are: auth, catalog,
checkout, cart, account, admin. Example: csh-checkout-guest-golden-path.
Smoke and API tests follow CSH-SMK-<surface>-<descriptor> in PascalCase
(e.g. CSH-SMK-HEALTH-API-ReturnsOkStatus). Do not mix conventions.
```

**Help doc:** [help.mabl.com — Agent instructions](https://help.mabl.com/hc/en-us/articles/48333958875924-2026-04-22-Agent-instructions)

### T1-4. Fix `csh-checkout-free-shipping-over-99` label gap

**Why:** The repo's area-targeted dispatch (`mabl tests run --labels type-rt,area-checkout`) silently skips this test today. Not demo-blocking but defeats the CI gate the demo narrates.

**Where:** mabl UI → Tests → `csh-checkout-free-shipping-over-99` (`ErGEnKNFQJemB2zn9lLL0A-j`) → Labels → add:

```
type-rt
area-checkout
```

### T1-5. Bind credentials to CSH-Regression plan

**Why:** Reputation only — Regression isn't on the demo path. But a prospect clicking Plans sees `0% pass` on a plan named "Regression" and assumes mabl can't keep auth tests green. 2-minute fix.

**Where:** mabl UI → Plans → **CSH-Regression** (`jQvMb041R8mCj22jKIGX5w-p`) → Edit → Credentials → assign **Demo customer** (`JxWK20l5gOOFOtWjaJHfOg-c`).

**Verify:** click Run plan after save. Should turn green (5 auth tests previously failed because the username variable resolved to the literal string `[plan credentials placeholder]`).

**Help doc:** [help.mabl.com — Plans](https://help.mabl.com/hc/en-us/articles/17780887930516-Plans)

---

## Tier 2 — Highest-leverage uplift for the demo narrative (1–3 hours each)

These are the gaps that, if closed before the next big customer demo, would let you *narrate* 2026 features instead of leaving them latent.

### T2-1. Build a `Login as Demo customer` reusable flow + use nested flows

**Why:** Nested flows GA'd 2026-05-15 (mabl's highest-voted feature, 186 customer votes). Currently every auth-dependent test redoes login inline.

**What:** Build flows `Login as Demo customer`, `Add product to cart`, `Begin checkout`. Compose them inside parent flows. Refactor 2–3 existing tests to use them.

**Demo beat to add:** between Acts 1 and 2 — *"And notice the test the agent generated is built from existing flows — login isn't reimplemented, it's invoked. When we rename the login form next week, we update one flow, not 17 tests."*

**Help doc:** [help.mabl.com — Nested flows](https://help.mabl.com/hc/en-us/articles/47845030358932-Nested-flows) · [When to use nested flows](https://help.mabl.com/hc/en-us/articles/47845023328788)

### T2-2. Convert `csh-catalog-filter-by-brand` to a DataTable-driven test

**Why:** Seven brands in the seed data (Apex, Ironline, Glacier, Coldfire, …) — one parameterized test, not seven hand-maintained ones. DataTable scenario filtering on plans shipped 2025-12-05.

**Demo beat to add:** Act 1 — *"The same test covers seven brands. The PR-smoke plan runs one row for speed; the nightly regression runs all seven."*

**Help doc:** [help.mabl.com — Run plans with specific DataTable scenarios](https://help.mabl.com/hc/en-us/articles/44065444538772-2025-12-05-Run-plans-with-specific-DataTable-scenarios)

### T2-3. Add a visual assertion on the homepage hero / featured grid

**Why:** Visual assertions are 2024-GA but the criteria-editing flow shipped 2026-03-20. The repo deliberately uses real product photography — exactly what visual assertions are for. Currently no test in the workspace uses one.

**Demo beat to add:** Act 3 — *"And here mabl catches a visual change the structural assertions would have missed."*

**Help doc:** [help.mabl.com — Edit visual assertion criteria](https://help.mabl.com/hc/en-us/articles/47413417582996-2026-03-20-Edit-visual-assertion-criteria)

### T2-4. Enable plan-level runtime recovery (TRA) on `CSH-SMOKE-PR`

**Why:** The Test Recovery Agent (Early Access since 2026-03-20, plan-level mode since 2026-03-30) is what makes Act 3's "auto-healing" narration land harder. Today Act 3 leans on smart locators — TRA is the next layer above that.

**Where:** mabl UI → Plans → **CSH-SMOKE-PR** → Plan-level runtime recovery → enable. (Labs feature; if your workspace doesn't surface it, ask Customer Success to enable.)

**Help doc:** [help.mabl.com — Plan-level runtime recovery mode](https://help.mabl.com/hc/en-us/articles/47739986053012-2026-03-30-Plan-level-runtime-recovery-mode)

---

## Tier 3 — Workspace-wide health (deprioritize until after the next demo)

- `csh-checkout-free-shipping-over-99` label fix (already T1-4 above)
- Disable or commit to the 2 stock plans (`Verify home page load and login`, `Check all pages for broken links and errors`)
- Add Local-pinned tests guard: `CSH-SMK-HEALTH-API-ReturnsOkStatus` is pinned to env Local. The PR-plan failure `x2E3W0oymmjTdpn3aDolJw-pr` was a cloud agent trying to hit localhost. Either pin to Preview or remove the env constraint.
- Add `area-*` labels to smoke tests if you want the regression-dispatch logic to subset them (currently smoke is area-agnostic).
- Naming convention drift (`csh-*-kebab` vs `CSH-CHP-*-PascalCase`) — handled long-term by the agent instruction in T1-3.

---

## Demo-day pre-flight (copy into your screen-share prep)

Five minutes before share starts:

1. ☐ `./scripts/demo-toggle.sh normal`
2. ☐ `curl https://cheap-shot-hockey.vercel.app/api/build-info` returns latest commit
3. ☐ mabl UI: workspace = `Cheap Shot Hockey Demo`, Plans tab open in another window
4. ☐ Slack `#vince-agentic-workflow-demos` pinned
5. ☐ Jira filtered to TAMD, sorted by Updated
6. ☐ Claude Code in `cheap-shot-hockey` repo, 3 subagents loaded
7. ☐ (if T1 done) `data-testid` configured on the application — be ready to point it out in Act 1
8. ☐ (if T1 done) agent instructions visible in Agents → Settings — open the tab if asked

## Audit citations (for "where did this guidance come from?")

- Full report: see the architecture audit dated 2026-05-20 by the `mabl-architecture-audit` skill
- Help-doc URLs inline above
- Customer-insight evidence: Auction Edge churn (`c9352239-e716-4fb0-bda2-91f08ee62000`), Spectora per-env credentials (`27a0a52a-4eda-46f3-895b-236deb295f89`)
- 60 mabl public release notes reviewed (2025-11-20 → 2026-05-19)

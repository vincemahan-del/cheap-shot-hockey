# Demo runbook — Ticket → Prod, with mabl at every gate

The **primary** customer demo arc. ~35 minutes. Every act shows a mabl
value story and a real CI artifact. Nothing is mocked.

## The story in one sentence

A developer picks up a JIRA ticket, uses Claude in their IDE to implement
the change, runs an existing mabl test locally against their laptop,
surfaces a coverage gap and authors a new test to fill it, gets an
AI-assisted review, pushes → Jenkins deploys a preview → mabl runs a
smoke plan on the preview → full regression on approval → merge to main
→ production deploy → post-deploy smoke. All gates are mabl.

## Test-execution tiers (the mental model to name on stage)

| Tier | Where it runs | What it is | When it runs |
| --- | --- | --- | --- |
| **Local** | Dev laptop via `mabl-cli` | Single-test smoke against `localhost:3000` | In the IDE loop, before push |
| **CI preview smoke** | Jenkins triggers mabl via deployment event | Small label set (`pr-gate`) | PR opens or branch push |
| **Cloud regression** | Mabl cloud, manually or scheduled | `regression` label, full suite | Before merge / on approval |
| **Cloud prod smoke** | Mabl cloud, auto after Vercel deploys main | `post-deploy-smoke` label | Every prod deploy + scheduled |

## Pre-demo prep (once per laptop, ~20 min)

### 1. Install mabl-cli

```bash
npm install -g @mablhq/mabl-cli
mabl auth activate-key   # paste Z9AUlteEadFAmlHqqxYqVQ (the API token)
mabl config --workspace pXXgThbNi4HfQOpiZptHfw-w
```

Verify:
```bash
mabl tests list
```

### 2. Atlassian / JIRA

You'll need a JIRA project with a real-looking ticket. The mabl
workspace already has the Atlassian MCP connected (tool prefix
`mcp__959834ca-…`). If JIRA isn't wired to your account yet:
run `/connect jira` in Claude Code and follow the OAuth flow.

**Pre-create one demo ticket** (don't author it on stage):
- Title: `CSH-42 — Add "Recently viewed" row to product detail page`
- Description: *As a returning shopper I want to see the last 4 products
  I viewed on each product detail page so I can compare without searching
  again.*
- Acceptance criteria:
  1. A strip labeled "Recently viewed" appears above "You might also like"
  2. Shows up to 4 products, most-recent first, excluding the current one
  3. Persists across reloads (cookie-based — see `src/lib/cart-cookie.ts` for pattern)
  4. Has `data-testid="recently-viewed"` on the container and `data-testid="recently-viewed-<slug>"` on each card

### 3. IDE

Use VS Code or Cursor with Claude Code CLI in the integrated terminal.
Keep these tabs open as "muscle memory" before the demo:
- `src/app/products/[slug]/page.tsx`
- `CLAUDE.md`
- A terminal pane at the repo root

### 4. Seed a mabl test for the product page

Use MCP to author one existing test first (so there's something to
**re-run** in Act 3). Label it `pr-gate`. Any simple test works — e.g.
"Open product detail for Apex Velocity Pro Stick, assert price is
$199.99." Without this, Act 3 has nothing to demonstrate.

### 5. 5-minute system check (run before every demo)

```bash
# app up?
curl -s http://localhost:3000/api/health | jq '.status'

# prod up + live sha?
curl -s https://cheap-shot-hockey.vercel.app/api/build-info | jq '{commit, env: .environment}'

# jenkins up?
curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/login  # expect 200

# reset demo state in case last run left prod in a broken mode
./scripts/demo-toggle.sh normal
```

Green across all four → you're ready.

---

## The demo (35 min)

Each act has a **say**, a **show**, and a **value story** tag.

### Act 1 — The ticket (2 min)

**Say:** "A developer comes in Monday morning, opens JIRA, pulls this
ticket off the sprint board."

**Show:**
- Open JIRA → **CSH-42**
- Read the description + acceptance criteria aloud
- *"Our dev is going to ship this with mabl-backed confidence at every step."*

**Value story:** setup only — no mabl story yet.

---

### Act 2 — Shift-left authoring in the IDE (6 min)

**Say:** "This is where it used to get hard. In the old world, the dev
writes code, then hopes the test team catches what they missed. In the
new world, the tests shift left — they're authored alongside the code,
by the same agent."

**Show:**
1. Open IDE terminal, run `claude`
2. Paste this prompt:
   ```
   Pick up JIRA ticket CSH-42 from the Cheap Shot Hockey Demo workspace.
   Read the ticket, then implement the feature in this repo. Follow the
   conventions in CLAUDE.md (especially data-testid naming + cookie-
   based persistence — don't put the state in the in-memory store).
   Before you finish, use the mabl MCP to list the existing tests that
   touch the product detail page, and tell me which ones might be
   affected by this change.
   ```
3. Claude calls the Atlassian MCP → reads CSH-42 → reads `CLAUDE.md` →
   edits `src/app/products/[slug]/page.tsx` + creates
   `src/lib/recently-viewed-cookie.ts` + updates relevant components →
   calls mabl `get_mabl_tests` with `query: "product detail"` and
   reports affected tests.
4. Accept the diff (or apply manually).

**Value story:** **AI-native authoring + shift-left** — tests are
considered at the moment of the change, not after.

---

### Act 3 — Run existing mabl test locally (4 min)

**Say:** "Before I push anything, I want to know my change didn't break
the most obvious existing journey. I'll run a mabl test from the
command line, against my laptop."

**Show:**
```bash
# npm dev server is already running on :3000 from system-check
mabl tests run --test <test-id-of-product-detail-smoke> \
               --environment-id DmlIvADtF8jPDm9J7Bpshw-e
```
- Mabl CLI spins up a local browser, exercises the journey, passes
  against the new code.

**Talking point:** call out that this is the **Local env** — same test
that runs in cloud later, running locally against `localhost:3000`.

**Value story:** **Same test, three tiers.** Author once, run anywhere.

---

### Act 4 — Coverage-gap + author a new test (5 min)

**Say:** "The test I just ran is an *old* test — it doesn't know about
the new recently-viewed row. Let me check if I have coverage for the
new surface."

**Show:**
1. In the mabl workspace: open **Coverage** → filter by the Production
   env → show that `/products/[slug]` exists but the recently-viewed
   row has zero interactions recorded.
2. Back in Claude:
   ```
   Author a mabl test that exercises the new "Recently viewed" row:
   open 3 different products in sequence, navigate to a 4th, then
   verify the row shows the first 3 in reverse order. Add it to the
   pr-gate plan. Run it once locally to confirm it passes.
   ```
3. Claude: MCP `plan_new_test` → `create_mabl_test_cloud` with
   `applicationId=OZqmshBkUfVSesWy49g1eQ-a`, `environmentId` preview,
   label `pr-gate` → polls `get_cloud_test_gen_status` → runs it
   locally via `run_mabl_test_local` and reports green.

**Value story:** **Coverage as a first-class signal.** mabl doesn't
just run tests, it tells you where you need more.

---

### Act 5 — AI code review (3 min)

**Say:** "Before I open a PR, I want an independent set of eyes. This
is where the skill system comes in."

**Show:**
```
# In Claude Code, inside the IDE:
/review
```
- Claude reads the diff with the `review` skill, flags anything
  questionable (e.g., cookie-size limit, cart pattern consistency,
  missing `data-testid`, etc.).
- Address anything real, move on.

**Value story:** **Quality gates before CI.** The farther left you
catch it, the cheaper the fix.

---

### Act 6 — Jenkins preview deploy + mabl smoke (5 min)

**Say:** "I push my branch. Vercel gives me a preview URL. Jenkins
picks up the push, runs the build, then asks mabl to smoke-test the
preview."

**Show:**
```bash
git checkout -b csh-42-recently-viewed
git add . && git commit -m "CSH-42 add recently viewed row" && git push -u origin HEAD
```
- Vercel preview deploy starts (visible in Vercel dashboard)
- Jenkins polls SCM, triggers build #N (watch it on `localhost:8080`)
- Pipeline stages land in order: build → deploy preview → **mabl
  api-smoke** → **mabl pr-gate** (the new test runs here)
- Click into mabl's run from Jenkins link → show the test passing in
  Chrome + Firefox + Webkit in parallel

**Value story:** **CI-native + cross-browser parallel.** mabl plugs
into whatever CI the customer has (Jenkins here, GHA workflow mirror
also green).

---

### Act 7 — Cloud regression on preview (4 min)

**Say:** "Smoke is fast and fits in the PR loop. But before we merge,
we need the full regression."

**Show:**
```bash
./scripts/mabl-deployment.sh \
  --environment TpuarWvfj1hOREDT0JGvjA-e \
  --application OZqmshBkUfVSesWy49g1eQ-a \
  --labels regression \
  --url "https://cheap-shot-hockey-git-csh-42-recently-viewed-vincemahan-1163s-projects.vercel.app" \
  --commit "$(git rev-parse --short HEAD)" \
  --branch csh-42-recently-viewed \
  --wait
```
- Mabl cloud runs every test in the `regression` plan against the
  preview URL.
- Show the results tile: pass/fail per journey, rolled up.

**Value story:** **One API call to gate a release.** Same mechanism
your scheduled production runs already use.

---

### Act 8 — Merge, deploy, post-deploy smoke (4 min)

**Say:** "Regression is green. I merge. Vercel auto-deploys production.
Jenkins main-branch pipeline runs the post-deploy smoke against the
live URL."

**Show:**
- Merge the PR (via `gh pr merge` or UI)
- Vercel deploy → watch `curl /api/build-info` flip to the new commit
- Jenkins `main` pipeline run: `post-deploy-smoke` label → green
- Open production in a browser → the recently-viewed row is there

**Value story:** **Deploy with confidence.** Every prod promotion is
gated by mabl; every prod deploy is validated by mabl post-flight.

---

### Act 9 — The "wait, it broke in prod" moment (optional, 2 min)

Only do this if you still have the room. Huge impact.

**Say:** "But what if something slips? Let me simulate that."

**Show:**
```bash
./scripts/demo-toggle.sh broken
```
- Within 15 minutes (or trigger now), the scheduled mabl run catches
  the 503s, flags the failure.
- Open a new GitHub issue:
  ```
  @claude — prod is returning 503s. Pull the latest failed mabl run,
  triage it, and open a PR with the fix if you find the cause.
  ```
- Claude calls `analyze_failure` → identifies the demo toggle → writes
  the "reset" PR → pipeline runs → prod green again.

```bash
./scripts/demo-toggle.sh normal
```

**Value story:** **Closed-loop incident response.** From detection →
triage → fix → verify, every step is backed by mabl data.

---

## Demo driver cheat sheet

### One-line resets

```bash
./scripts/demo-toggle.sh normal              # reset demo modes
git checkout main && git pull                 # return to the known-good main
gh pr list --state open --json number --jq '.[] | .number' | xargs -n1 gh pr close  # clean stale PRs
git branch | grep -v main | xargs git branch -D 2>/dev/null  # clean local branches
```

### Fallbacks when things go sideways

| If this fails | Fall back to |
| --- | --- |
| JIRA MCP not responding | Show the ticket as a GitHub issue instead; the narrative still works |
| `mabl tests run --local` fails to open Chrome | Run in cloud against Local env — slower but identical value |
| Jenkins SCM polling lags | Manually click Build Now; apologize; move on |
| Preview deploy isn't ready when Jenkins tries to hit it | `./scripts/mabl-deployment.sh --url https://cheap-shot-hockey.vercel.app` (point at prod) |
| Claude Action times out | Keep talking; open the Actions tab to show it's running; it almost always finishes within 60 s |

### The numbers to have in your head

- **Local mabl run:** ~30 s per test
- **Cloud mabl smoke:** ~60–90 s per test
- **Vercel preview deploy:** ~60–90 s
- **Jenkins build end-to-end (no plan matches):** ~60–120 s
- **Full regression suite at scale:** "2–5 min for 10 tests in parallel"

---

## What this demo intentionally does NOT try to cover

Saving for deeper conversations:
- Mobile testing
- Performance / Lighthouse integration
- Accessibility runs
- Data-driven variations
- Team/RBAC
- Self-hosted agents

If a customer asks about these, the honest answer is *"yes, mabl does
all of those, and I'll schedule a deep dive on the ones you care about
most."*

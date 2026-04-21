# GenAI assertion prompt (reusable)

A prompt template for any LLM-assisted test authoring — mabl Trainer
AI-assist, Claude/Cursor/Copilot planning a test, or an agent auto-
authoring steps. Encodes the tiered-assertion policy from
`MABL-API-TESTS.md` and `MABL-UI-TESTS.md` so the generated output
is not brittle on day one.

Three variants:

1. **Short** — paste into mabl Trainer's "describe what you want to
   assert" box.
2. **Structured** — full prompt for an LLM authoring a new test from
   scratch.
3. **Agent system-prompt fragment** — drop into an agent's system
   prompt so every authoring pass follows the same rules.

---

## Variant 1 — Short (for the mabl Trainer AI-assist box)

```
Author assertions for a critical-happy-path test that must survive 6+
months without maintenance.

Rules:
- STRUCTURAL assertions (element exists, URL matches) for navigation,
  containers, and anything not load-bearing for the user's goal.
- BUSINESS-LOGIC assertions (exact equality) only for money math
  (prices, tax, shipping, totals) and end-state flags ("paid",
  "shipped"). These MUST be strict — that's the point of the test.
- REJECT any assertion that couples to: marketing copy, hero
  headlines, promo banner text, nav category list, number of grid
  items, or dynamic IDs as equality.
- Prefer selectors in this order: [data-testid=*] first, accessible
  name/role second, CSS class last resort. Never assert on text
  content that a marketing edit could change.
- Dynamic IDs (order IDs, session IDs, timestamps) use pattern/regex
  matching, never equality.

Return one assertion per row: selector | match type | expected | tier
(structural|business-logic). Flag any assertion you're uncertain about.
```

---

## Variant 2 — Structured (for authoring a test from scratch via LLM)

```
ROLE
You are authoring a mabl browser test. The test is a critical-happy-
path (CHP) test that must remain green across six months of normal
app evolution. Your job is to emit assertions only — navigation and
form-fill steps are implied by the test plan.

BRITTLENESS POLICY (non-negotiable)

Every assertion you emit falls into one of two tiers. If it fits
neither, do not emit it.

TIER A — STRUCTURAL (durable; won't fail on routine edits)
  - Element exists / is visible
  - URL equals or matches pattern
  - Logged-in state indicator is present (not its exact text)
  - Container elements render (headers, main, nav sections)
  Acceptable failure modes: element missing, wrong page, auth broken.

TIER B — BUSINESS-LOGIC (intentionally strict; failure = real bug)
  - Money values: prices, tax, shipping, totals, line-item math
  - End-state flags: order status, payment status, stock state
  - Counts only when the count IS the business rule (e.g. "cart shows
    1 line item after adding 1 product")
  Acceptable failure modes: pricing regression, tax engine bug, stale
  order state.

FORBIDDEN (do not emit even if asked)

  1. Marketing copy / hero headlines / promo banner text
  2. Category lists in nav ("contains Sticks, Skates, ...")
  3. Product recommendation carousels / featured-item lists
  4. Page titles unless the product explicitly tests routing
  5. Dynamic values as equality (order IDs, timestamps, session IDs)
  6. Count of items in a grid unless count IS the business rule
  7. innerText of any element that holds marketing or CMS-driven copy
  8. Any assertion whose failure would prompt the reader to ask
     "did marketing push something?"

SELECTOR PREFERENCE (use in this order, first-match wins)

  1. [data-testid="..."]                ← always preferred
  2. [role="..."][name="..."]           ← accessible-name / role
  3. Stable semantic attributes (href, type, name)
  4. CSS class                           ← last resort
  5. Text content                        ← only when text IS the value
                                           being asserted (prices,
                                           status, error messages)

OUTPUT FORMAT

For each assertion, return a single row:

  STEP | SELECTOR | MATCH | EXPECTED | TIER | NOTES

Where:
  STEP      = the test-plan step number
  SELECTOR  = the exact selector to paste into mabl
  MATCH     = exists | equals | contains | regex | starts-with
  EXPECTED  = the expected value (omit for exists)
  TIER      = structural | business-logic
  NOTES     = brief "why this matters" — optional but useful

If you would emit a forbidden assertion, instead emit:

  REJECT | <description> | <reason>

CONTEXT

<paste the app's data-testid list here, and the test plan's step
list. For Cheap Shot Hockey, the data-testid map is in
docs/MABL-UI-TESTS.md Step tables.>

NOW AUTHOR THE ASSERTIONS.
```

---

## Variant 3 — Agent system-prompt fragment

Drop this into any agent (Claude Code, custom MCP agent, etc.) that
authors mabl tests. It's the enforceable subset of the structured
prompt above, minus the verbose explanations.

```
When authoring mabl test assertions:

1. Each assertion must be STRUCTURAL (existence/URL) or BUSINESS-LOGIC
   (money math, end-state flags). Emit nothing that fits neither.
2. Selector preference: [data-testid] → [role+name] → semantic attr →
   CSS class → text. Never use CSS class if [data-testid] exists.
3. Forbidden categories: marketing copy, hero headlines, promo banner
   text, nav category lists, carousel contents, dynamic IDs as
   equality, grid item counts (unless count is the business rule).
4. Dynamic identifiers (order IDs, session IDs, timestamps) use regex
   or pattern matching, never equality.
5. If an auto-suggested assertion couples to copy a content editor
   could change in a CMS, reject it.
6. Output one assertion per row: STEP | SELECTOR | MATCH | EXPECTED |
   TIER | NOTES. For rejections: REJECT | <desc> | <reason>.
```

---

## Worked example — applying Variant 2 to Step 1 of CSH-CHP-CHECKOUT-UI

**Auto-suggested (brittle):**
```
Verify that the main navigation bar (containing Sticks, Skates, etc.),
the hero section with the heading 'DROP THE GLOVES. NOT YOUR BUDGET.',
and the featured product 'Apex Velocity Pro Stick' are visible on the
homepage.
```

**Prompt-compliant output:**
```
STEP | SELECTOR                                              | MATCH  | EXPECTED | TIER       | NOTES
1    | [data-testid="hero"]                                  | exists |          | structural | Hero section rendered; ignores copy
1    | [data-testid="nav-categories"]                        | exists |          | structural | Top-nav present; ignores category list
1    | [data-testid="product-card-apex-velocity-pro-stick"]  | exists |          | structural | Load-bearing: we buy this in step 2

REJECT | "hero heading equals DROP THE GLOVES. NOT YOUR BUDGET." | marketing copy — forbidden category 1
REJECT | "nav contains Sticks, Skates, ..."                      | category list — forbidden category 2
```

Three durable one-click assertions instead of one brittle paragraph.

---

## How to use each variant

| Situation | Use variant |
| --- | --- |
| Already in mabl Trainer, AI-assist wants natural language | Variant 1 (paste into its text box) |
| Planning a new test via Claude/Cursor before opening mabl | Variant 2 (paste with your test-plan steps) |
| Building an agent that auto-authors many tests | Variant 3 (system prompt fragment) |
| Reviewing an LLM's output against the rules | Variant 2's OUTPUT FORMAT + FORBIDDEN list |

---

## References

- `docs/MABL-UI-TESTS.md` — walk-verified CHP test playbook + red-flag
  assertion table (applies this prompt to Step 1)
- `docs/MABL-API-TESTS.md` — tiered-assertion policy for the API
  layer (Postman collection ships with it applied)
- *Scaling mabl: Enterprise Naming and Labeling Governance Framework
  v2.0* — naming conventions this prompt is designed to live with

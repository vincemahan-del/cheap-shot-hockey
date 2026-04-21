# Mabl API Smoke — Test Catalog

This is the authoring plan for the **API smoke layer** of the Cheap Shot
Hockey demo workspace. All names, labels, and plans follow the
conventions in *Scaling mabl: Enterprise Naming and Labeling Governance
Framework v2.0* (V. Mahan, Jan 2026).

Purpose of the layer: six fast, parallelizable API tests that catch any
class of deploy-breakage in under a minute. Runs on every PR gate, every
post-deploy, and every nightly schedule.

---

## Controlled vocabulary additions (workspace-specific)

Added to the shared vocab doc for this workspace:

| Token | Meaning |
| --- | --- |
| **App code:** `CSH` | Cheap Shot Hockey demo application |
| **Module:** `HEALTH` | Liveness / readiness endpoints |
| **Module:** `BUILD` | Build metadata / deploy reflection |
| **Module:** `CATALOG` | Product listing + lookup |
| **Module:** `CART` | Shopping cart state operations |

(Existing modules `LOGIN`, `CHECKOUT`, `SEARCH`, etc. per the main framework.)

---

## Tests (ordered by business criticality)

All names follow the framework template: `<APP>-<TYPE>-<MODULE>-<PLATFORM?>-<Outcome>`.

### 1. `CSH-SMK-HEALTH-API-ReturnsOkStatus`

**Why:** Catches total app-down — container crash, Next.js boot failure, bad env config.

**Request**
```
GET /health
```
(Relative path — mabl joins it onto the env's API URL at runtime. Same
test runs against Local / Preview / Production by selecting the env.)

**Assertions**
- HTTP status == `200`
- Header `Content-Type` starts with `application/json`
- Body `$.status` == `"ok"`
- Body `$.service` == `"cheap-shot-hockey"`
- Body `$.time` matches regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$`

**Labels:** `type-smk, type-api, priority-p0, feat-infra, exec-pr, exec-postdeploy, exec-nightly, team-platform`

**Verified:** Authored in mabl, runs green on the Local env.

---

### 2. `CSH-SMK-BUILD-API-BuildInfoReflectsCommit`

**Why:** Catches a deploy that reports the wrong commit — stale bundle, skipped deploy, wrong env vars.

**Request**
```
GET /build-info
```

**Assertions**
- HTTP status == `200`
- Body `$.name` == `"cheap-shot-hockey"`
- Body `$.commit` matches regex `^([0-9a-f]{7,40}|dev)$`
- Body `$.environment` matches regex `^(production|preview|development)$`

**Labels:** `type-smk, type-api, priority-p1, feat-infra, exec-postdeploy, exec-nightly, team-platform`

---

### 3. `CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd`

**Why:** One critical-happy-path (CHP) test that validates the full
money journey — catalog → auth → cart → order placement → order read.
Replaces the narrower per-endpoint smoke tests that were originally
planned for this layer (CATALOG list/by-slug, LOGIN, CART).

**Rationale for the consolidation:** for a demo + early-stage workspace,
a single chained CHP test is higher signal per minute of authoring
effort. It proves the business-critical path works rather than probing
individual endpoints. Narrow per-endpoint smokes still belong — they
just move to the `CSH-REGRESSION-API` plan (see "What's NOT in this
layer" below) where diagnosis granularity matters more than demo
impact.

**Multi-step (9 chained steps; cookie jar + variable extraction
carry state across steps)**

#### Step 1 — Catalog: list products
```
GET /products
```
- Assert status == `200`
- Assert `$.count` is greater than `19`

#### Step 2 — Catalog: deep-link to a specific product
```
GET /products/apex-velocity-pro-stick
```
- Assert status == `200`
- Assert `$.id` == `"p-stk-001"`
- Assert `$.salePriceCents` == `19999`

#### Step 3 — Auth: login as demo customer
```
POST /auth/login
Content-Type: application/json

{ "email": "demo@cheapshot.test", "password": "demo1234" }
```
- Assert status == `200`
- Assert `$.id` == `"u-001"`
- Assert `$.role` == `"customer"`

#### Step 4 — Auth: session cookie persists
```
GET /auth/me
```
- Assert status == `200`
- Assert `$.id` == `"u-001"`

#### Step 5 — Cart: add the stick
```
POST /cart
Content-Type: application/json

{ "productId": "p-stk-001", "quantity": 1, "mode": "add" }
```
- Assert status == `200`
- Assert `$.lines[0].productId` == `"p-stk-001"`
- Assert `$.lines[0].quantity` == `1`

#### Step 6 — Cart: read persists across request
```
GET /cart
```
- Assert status == `200`
- Assert `$.lines[0].quantity` == `1`
- Assert `$.subtotalCents` == `19999` (one Apex Velocity sale price)

#### Step 7 — Checkout: place the order
```
POST /orders
Content-Type: application/json

{
  "shippingAddress": {
    "name": "Demo Customer",
    "street": "1 Rink Road",
    "city": "Minneapolis",
    "state": "MN",
    "postalCode": "55401",
    "country": "US"
  }
}
```
- Assert status == `201`
- Assert `$.status` == `"paid"`
- Assert `$.userId` == `"u-001"`
- **Extract `$.id` into a variable** named `orderId` for step 9

#### Step 8 — Cart was cleared after ordering
```
GET /cart
```
- Assert status == `200`
- Assert `$.lines` is empty (or `$.subtotalCents` == `0`)

#### Step 9 — Order retrievable by id
```
GET /orders/{{orderId}}
```
- Assert status == `200`
- Assert `$.status` == `"paid"`
- Assert `$.totalCents` is greater than `19999`

**Labels:** `type-chp, type-api, priority-p0, feat-checkout, feat-cart, feat-login, feat-catalog, exec-pr, exec-postdeploy, exec-nightly, team-platform`

---

## Plans

These tests live in **two env-scoped plans** (split from the original
`CSH-SMOKE` to avoid cross-env fan-out). Each plan attaches exactly
one env, so a deployment event can only fire one plan run — no
multi-env broadcasting.

### Plan 1: `CSH-SMOKE-PR`

**Description:** Preview-layer gate. Fires on PR branch pushes via
GHA `mabl-smoke` / Jenkins stage 7. Fast API-layer smokes plus the
UI CHP in Stage 2.

| Label | Why |
| --- | --- |
| `type-smk` | Test type classification |
| `type-chp` | Contains CHP tests |
| `type-api` | API layer included |
| `type-ui` | UI layer included (Stage 2) |
| `exec-pr` | PR-push dispatch matches here |
| `team-platform` | Ownership |
| `priority-p0` | Blocks merge via branch protection |

**Environment attached:** Preview only

### Plan 2: `CSH-SMOKE-POSTDEPLOY`

**Description:** Post-deploy gate against Prod after Vercel reflects
the new commit. Same tests as PR plan, different env + dispatch label.

| Label | Why |
| --- | --- |
| `type-smk` | Test type classification |
| `type-chp` | Contains CHP tests |
| `type-api` | API layer included |
| `type-ui` | UI layer included (Stage 2) |
| `exec-postdeploy` | Main-push post-deploy dispatch matches here |
| `exec-nightly` | Future nightly schedule catches this plan too |
| `team-platform` | Ownership |
| `priority-p0` | |

**Environment attached:** Production only

### Tests included (shared, both plans, 4 total — 2 stages)

**Stage 1 (API, parallel):**
1. `CSH-SMK-HEALTH-API-ReturnsOkStatus`
2. `CSH-SMK-BUILD-API-BuildInfoReflectsCommit`
3. `CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd`

**Stage 2 (UI, gated on Stage 1 success):**
4. `CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd`

### Why split (instead of one multi-env plan)

The single-plan design (CSH-SMOKE with Preview + Prod attached) fanned
out to both envs on every deployment event, even when the event
targeted only one. That created phantom runs against stale Prod during
PR gates (false signal) and duplicate cross-env runs generally. The
split plans each attach one env, making fan-out structurally
impossible. Trade-off: two plans to keep in sync, mitigated by keeping
the test list identical and using the same labels across both plans
except for the `exec-*` dispatch token.

> **If the original `CSH-SMOKE` still exists:** disable it or delete
> it. Otherwise PR + post-deploy dispatches will match it in addition
> to the split plans, resurrecting the fan-out problem.

---

## CI dispatch (Jenkinsfile + GHA)

Per the framework's "same plan, many triggers" pattern (page 8), the
same `CSH-SMOKE-API` plan fires in three different contexts via label
intersection:

```bash
# PR gate
./scripts/mabl-deployment.sh --labels type-smk,exec-pr ...

# Post-deploy smoke
./scripts/mabl-deployment.sh --labels type-smk,exec-postdeploy ...

# Nightly regression lead-in
./scripts/mabl-deployment.sh --labels type-smk,exec-nightly ...
```

Mabl matches plans whose labels include **all** of the passed values.
One durable plan handles three execution contexts — no duplicate plans.

These exact label intersections are wired up in:
- `Jenkinsfile` — stage 7 dispatches `type-smk,exec-pr` → matches
  `CSH-SMOKE-PR` (Preview), stage 9 dispatches `type-smk,exec-postdeploy`
  → matches `CSH-SMOKE-POSTDEPLOY` (Prod)
- `.github/workflows/mabl-sdlc.yml` — `mabl-smoke` job (PR only,
  matches `CSH-SMOKE-PR`) and `post-deploy-smoke` job (main only,
  matches `CSH-SMOKE-POSTDEPLOY`)

**One mabl dispatch per trigger, one plan per env.** Because each
plan has exactly one env attached, the dispatch maps to exactly one
plan run — no fan-out, no phantom cross-env runs.

Full regression (`type-rt,exec-nightly`) is intentionally unwired
until the CSH-REGRESSION plan exists. Adding that plan later doesn't
require CI changes — just add a matching `mabl-regression` job when
ready.

---

## Authoring tips (based on real pain hit during workspace setup)

1. **Skip the "Describe what you want your test to accomplish" AI intent
   box.** It triggered a 500 on the New API Test submit in testing.
   Author the tests from the bare form, add steps manually in the
   Trainer.
2. **Pick Application + Environment first** — the URL field auto-populates.
3. **Use relative paths in step URLs** — e.g. `/health`, not
   `https://cheap-shot-hockey.vercel.app/api/health`. Mabl prepends the
   env's configured API URL at run time, so the same test runs against
   Local / Preview / Production by selecting the env. Variable syntax
   like `{{app.url}}` passes through as a literal — don't use it.
4. **For multi-step tests (#5, #6)**, use the "Add step" button in the
   Trainer. Each step inherits the cookie jar from the previous —
   that's how we validate session/cookie persistence without manual
   cookie wiring.
5. **Save early and often.** The form has reset on navigation in
   testing.
6. **The mabl MCP `create_mabl_test_cloud` tool with `isApiTest: true`
   produces browser tests, not API tests** (reproduced 3×). Until
   fixed by mabl eng, all API tests must be authored via the UI.
7. **Postman import has a partial-port caveat.** The E2E test
   (`CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd`) ships as
   `mabl/postman/csh-e2e-order-journey.postman_collection.json` and
   imports via **New API test → Import from Postman collection**.
   Assertions port cleanly. `pm.collectionVariables.set(...)` does
   **not** port — mabl doesn't currently honor the Postman script API
   for variable extraction. After import, manually add a response
   variable on step 7: **name** `orderId`, **source** Response body,
   **JSONPath** `$.id`, **scope** `@` (test-scope). Step 9's
   `{{@orderId}}` path param then resolves correctly. Skipping this
   step causes step 9 to GET `/orders/` (list endpoint) and return a
   paged envelope instead of a single order, which fails the `status
   is paid` + `totalCents is 21599` assertions.
8. **Assertions are tiered: structural vs. business-logic.** The
   E2E collection uses existence/type checks (`exist`, `not.empty`)
   for IDs and shape, and equality checks for money math
   (`totalCents === 21599`, `taxCents === 1600`,
   `shippingCents === 0`). This keeps the test from breaking when seed
   IDs shift while still catching real tax/shipping/price regressions
   — the whole reason a CHP test exists in the first place.

---

## What's NOT in this layer (saving for later)

Lives in a future `CSH-REGRESSION-API` plan with labels `type-rt, type-api, exec-nightly`:

- `CSH-RT-CATALOG-API-UnknownSlugReturns404`
- `CSH-RT-CART-API-OverStockReturnsBadRequest`
- `CSH-RT-ORDERS-API-UnauthGetReturnsUnauthorized`
- `CSH-RT-ORDERS-API-MissingAddressReturnsBadRequest`
- `CSH-RT-CATALOG-API-FilterByCategoryReturnsOnly`
- `CSH-RT-CATALOG-API-FilterByBrandReturnsOnly`
- `CSH-RT-CATALOG-API-OnSaleReturnsOnlyDiscounted`
- `CSH-RT-CHECKOUT-API-GuestCheckoutCompletesOrder`
- `CSH-RT-ADMIN-API-CustomerRoleForbidden`
- `CSH-RT-ADMIN-API-AdminRoleAuthorized`

---

## References

- *Scaling mabl: Enterprise Naming and Labeling Governance Framework v2.0*
  — author: Vince Mahan, January 2026 (internal doc)
- `CLAUDE.md` — repo agent brief
- `Jenkinsfile` — CI pipeline dispatching mabl deployment events
- `.github/workflows/mabl-sdlc.yml` — GHA mirror
- `scripts/mabl-deployment.sh` — mabl REST event + poll loop

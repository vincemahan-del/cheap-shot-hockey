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

## Plan

**Name:** `CSH-SMOKE-API`

**Description:** Fast API-layer smoke suite. Catches deploy-breaking
regressions across infrastructure (health, build-info) + the full
customer-places-order happy path. Target: complete in under 60s.

**Plan labels (the CI dispatch surface):**

| Label | Why |
| --- | --- |
| `type-smk` | Test type classification |
| `type-api` | Layer classification |
| `exec-pr` | Fires on PR branch pushes |
| `exec-postdeploy` | Fires after every prod deploy |
| `exec-nightly` | Fires on the nightly schedule |
| `team-platform` | Ownership |

**Environments attached:** Preview, Production, Local

**Tests included (3 total, one parallel stage):**
1. `CSH-SMK-HEALTH-API-ReturnsOkStatus`
2. `CSH-SMK-BUILD-API-BuildInfoReflectsCommit`
3. `CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd`

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

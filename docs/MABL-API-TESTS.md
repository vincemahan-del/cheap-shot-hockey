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
GET {{@app.url}}/api/health
```

**Assertions**
- HTTP status == `200`
- Header `Content-Type` starts with `application/json`
- Body `.status` == `"ok"`
- Body `.service` == `"cheap-shot-hockey"`

**Labels:** `type-smk, type-api, priority-p0, feat-infra, exec-pr, exec-postdeploy, exec-nightly, team-platform`

---

### 2. `CSH-SMK-BUILD-API-BuildInfoReflectsCommit`

**Why:** Catches a deploy that reports the wrong commit — stale bundle, skipped deploy, wrong env vars.

**Request**
```
GET {{@app.url}}/api/build-info
```

**Assertions**
- HTTP status == `200`
- Body `.commit` matches `^[0-9a-f]{7,40}$` OR equals `"dev"`
- Body `.environment` is one of `["production", "preview", "development"]`
- Body `.name` == `"cheap-shot-hockey"`

**Labels:** `type-smk, type-api, priority-p1, feat-infra, exec-postdeploy, exec-nightly, team-platform`

---

### 3. `CSH-SMK-CATALOG-API-ListReturnsProducts`

**Why:** Catches a broken data layer or stripped seed data.

**Request**
```
GET {{@app.url}}/api/products
```

**Assertions**
- HTTP status == `200`
- Body `.count >= 20`
- Body `.items[0].id` exists (non-empty string)
- Body `.items[0].name` exists (non-empty string)
- Body `.items[0].category` is one of the known categories

**Labels:** `type-smk, type-api, priority-p0, feat-catalog, exec-pr, exec-postdeploy, exec-nightly, team-platform`

---

### 4. `CSH-SMK-CATALOG-API-BySlugReturnsProduct`

**Why:** Catches a broken dynamic route or a missing specific product; validates deep-link stability.

**Request**
```
GET {{@app.url}}/api/products/apex-velocity-pro-stick
```

**Assertions**
- HTTP status == `200`
- Body `.name` == `"Apex Velocity Pro Stick"`
- Body `.salePriceCents` == `19999`
- Body `.stock >= 1`

**Labels:** `type-smk, type-api, priority-p1, feat-catalog, exec-pr, exec-postdeploy, team-platform`

---

### 5. `CSH-SMK-LOGIN-API-CustomerCanAuthenticate`

**Why:** Catches broken sessions, missing HMAC secret, cookie-handling regressions.

**Multi-step (cookie jar persists across steps)**

**Step A — Login**
```
POST {{@app.url}}/api/auth/login
Content-Type: application/json

{ "email": "demo@cheapshot.test", "password": "demo1234" }
```
Assertions:
- HTTP status == `200`
- Body `.email` == `"demo@cheapshot.test"`
- Body `.role` == `"customer"`

**Step B — /me reflects the session**
```
GET {{@app.url}}/api/auth/me
```
Assertions:
- HTTP status == `200`
- Body `.id` == `"u-001"`
- Body `.role` == `"customer"`

**Labels:** `type-smk, type-api, priority-p0, feat-login, exec-pr, exec-postdeploy, exec-nightly, team-platform`

---

### 6. `CSH-SMK-CART-API-AddAndReadPersists`

**Why:** Catches broken cart-cookie persistence (the serverless regression from commit `e080e6e`). Anonymous session — no auth.

**Multi-step (anonymous session)**

**Step A — Add puck to cart**
```
POST {{@app.url}}/api/cart
Content-Type: application/json

{ "productId": "p-pck-001", "quantity": 2, "mode": "add" }
```
Assertions:
- HTTP status == `200`
- Body `.lines[0].productId` == `"p-pck-001"`
- Body `.lines[0].quantity` == `2`

**Step B — Re-read cart (validates cookie persistence)**
```
GET {{@app.url}}/api/cart
```
Assertions:
- HTTP status == `200`
- Body `.lines[0].quantity` == `2`
- Body `.subtotalCents` == `2598` (2 × $12.99)

**Labels:** `type-smk, type-api, priority-p0, feat-cart, exec-pr, exec-postdeploy, exec-nightly, team-platform`

---

## Plan

**Name:** `CSH-SMOKE-API`

**Description:** Fast API-layer smoke suite. Catches deploy-breaking
regressions across health, build reflection, catalog reads, auth
sessions, and cart persistence. Target: complete in under 60s parallel.

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

**Tests included:** all 6 above, one parallel stage.

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
3. **Parameterize the host** with `{{@app.url}}` — lets the same test
   run against Preview, Production, and Local by selecting the env at
   runtime.
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

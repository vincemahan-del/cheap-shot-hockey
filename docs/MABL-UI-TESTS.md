# Mabl UI Tests — Test Catalog

Companion to `MABL-API-TESTS.md`. This is the **UI / browser layer** of
the Cheap Shot Hockey demo workspace. All names and labels follow
*Scaling mabl: Enterprise Naming and Labeling Governance Framework v2.0*
(V. Mahan, Jan 2026).

Purpose of this layer: end-to-end **customer journey** assertions at the
browser level. Catches UI regressions the API smoke layer can't see —
navigation, form submission, visual layout, selector stability, client-
side state.

---

## Tests

### 1. `CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd`

**Why:** The browser-layer mirror of the API CHP. Proves a real
customer can navigate → add to cart → log in → checkout → place an
order entirely through the UI. Catches DOM regressions, form-handling
bugs, client-side router bugs, and visual regressions that API tests
miss by design.

**Intent-document** (used to drive mabl cloud test generation):
- Target env for authoring: **Local** (`http://localhost:3000`).
- Demo user: `demo@cheapshot.test / demo1234` (seeded, id `u-001`).
- Target product: **Apex Velocity Pro Stick** (slug
  `apex-velocity-pro-stick`, id `p-stk-001`, sale price $199.99).

**Flow (7 tasks):**

1. **Verify Homepage and Hero/Featured Product Area**
   - Navigate to `/`
   - Assert hero/featured section visible
   - Assert "Apex Velocity Pro Stick" present
   - Full-page visual snapshot
2. **View Product Detail Page for Apex Velocity Pro Stick**
   - Click featured product CTA
   - Assert URL pattern `/products/apex-velocity-pro-stick`
   - Assert product name visible
   - Assert `$199.99` price visible
   - Visual snapshot of product hero area
3. **Add Product to Cart**
   - Click "Add to Cart"
   - Assert confirmation (toast or cart-count increment)
4. **Log in as Demo Customer**
   - Navigate to `/login`
   - Enter `demo@cheapshot.test` + `demo1234`
   - Submit
   - Assert logged-in state (account indicator shows "Demo Customer")
5. **Verify Cart Contents**
   - Navigate to `/cart`
   - Assert line item: "Apex Velocity Pro Stick", qty 1, $199.99
   - Assert subtotal $199.99
   - Visual snapshot of cart line-item area
6. **Proceed to Checkout and Fill Shipping Information**
   - Click "Checkout"
   - Assert URL `/checkout`
   - Fill address: Demo Customer / 1 Rink Road / Minneapolis / MN /
     55401 / US
   - Assert displayed subtotal $199.99, shipping $0.00, tax $16.00
7. **Place Order and Verify Confirmation**
   - Click "Place Order"
   - Assert URL pattern `/orders/o-*`
   - Assert order total $215.99 visible
   - Assert order status "Paid" visible
   - Visual snapshot of order summary

**Assertion tiering (matches API layer policy):**
- STRUCTURAL (existence/type): URL patterns, element visibility, logged-
  in-state indicators, product name present. Won't fail on seed shifts
  or label rewording.
- BUSINESS-LOGIC (equality): `$199.99` price, `$16.00` tax, `$215.99`
  total, "Paid" status. Intentionally strict — a break here means a
  real pricing/tax/shipping regression, which is the point of a CHP
  test.

**Selector stability:** prefer `data-testid` over text or CSS class
where available (e.g. `data-testid="thumb-apex-velocity-pro-stick"`).
The app ships test IDs on key surface elements; mabl's auto-heal
covers the gaps.

**Labels:** `type-chp, type-ui, priority-p0, feat-checkout, feat-cart, feat-login, feat-catalog, exec-pr, exec-postdeploy, exec-nightly, team-platform`

---

## Plan

**Name:** `CSH-UI-PR-GATE`

**Description:** UI-layer PR gate + post-deploy smoke for Cheap Shot
Hockey. Browser-rendered customer journey. Target: complete in under
4 min per env.

**Plan labels (the CI dispatch surface):**

| Label | Why |
| --- | --- |
| `type-chp` | Critical-happy-path classification |
| `type-ui` | Layer classification (not `type-e2e`; UI and E2E are distinct) |
| `exec-pr` | Fires on PR branch pushes |
| `exec-postdeploy` | Fires after every prod deploy |
| `exec-nightly` | Fires on the nightly schedule |
| `team-platform` | Ownership |

**Environments attached:** Preview, Production, Local

**Tests included:**
1. `CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd`

> Pipeline label intersection: the Jenkinsfile stage 8 and GHA
> `mabl-ui-pr-gate` job dispatch on `type-ui,exec-pr` — matches the
> framework token set and picks up any UI test tagged with both.

---

## What's NOT in this layer (future)

Lives in a future `CSH-REGRESSION-UI` plan with labels
`type-rt, type-ui, exec-nightly`:

- `CSH-RT-CATALOG-UI-FilterByCategoryFiltersProducts`
- `CSH-RT-CATALOG-UI-SearchByKeywordReturnsResults`
- `CSH-RT-CART-UI-QuantityUpdateRecalculatesTotal`
- `CSH-RT-CART-UI-RemoveLineItemClearsCart`
- `CSH-RT-CHECKOUT-UI-GuestCheckoutCompletesOrder`
- `CSH-RT-CHECKOUT-UI-InvalidAddressBlocksSubmit`
- `CSH-RT-LOGIN-UI-InvalidPasswordShowsError`
- `CSH-RT-ACCOUNT-UI-OrderHistoryListsPaidOrders`
- `CSH-A11Y-HOME-UI-PassesWCAGAAChecks` (a11y scan)
- `CSH-A11Y-CHECKOUT-UI-PassesWCAGAAChecks`

---

## Authoring playbook (walk-verified)

Claude drove the full CHP flow in the live app and captured every
`data-testid`, URL, and actual on-screen text. Below is the exact
step-by-step — every selector is confirmed against the running app,
not guessed.

> **Authoring path recommendation:** mabl Cloud Test Generation was
> attempted twice via MCP (`create_mabl_test_cloud`, `create_mabl_test_from_plan`).
> Both sessions returned non-success statuses (`failed` / `terminated`).
> Until mabl's cloud-gen reliability improves, the Trainer is the
> reliable path. This playbook makes that 15 minutes of deterministic
> work.

### Setup

1. **Tests → Create new → Browser test** (NOT API test)
2. Application: **Cheap Shot Hockey**
3. Environment: **Local**
4. Starting URL: `http://localhost:3000/` (populated automatically from env)
5. Name: `CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd`
6. Open the mabl Desktop Trainer on that test
7. Make sure `npm run dev` is running locally on port 3000

### Step-by-step

Selectors below are **CSS selectors** — paste them into the Trainer's
"Use selector" dialog when recording an interaction. mabl's auto-heal
will derive alternative selectors automatically.

#### 1. Homepage verify

| Action | Selector / Value |
| --- | --- |
| Navigate | `http://localhost:3000/` (or just let the env URL load) |
| Assert element exists | `[data-testid="hero"]` |
| Assert text present | Text `Apex Velocity Pro Stick` within `[data-testid="product-card-apex-velocity-pro-stick"]` |
| Visual snapshot | Full page — name `home-page` |

#### 2. Open product detail

| Action | Selector / Value |
| --- | --- |
| Click | `[data-testid="product-card-apex-velocity-pro-stick"]` |
| Assert URL | contains `/products/apex-velocity-pro-stick` |
| Assert element text equals | `[data-testid="product-name"]` → `Apex Velocity Pro Stick` |
| Assert element text equals | `[data-testid="product-price"]` → `$199.99` *(business-logic)* |
| Visual snapshot | Element `[data-testid="product-name"]`'s section — name `product-detail-apex` |

#### 3. Add to cart

| Action | Selector / Value |
| --- | --- |
| Click | `[data-testid="add-to-cart-p-stk-001"]` |
| Assert element text equals | `[data-testid="add-to-cart-feedback-p-stk-001"]` → `Added to cart` |
| Assert element text equals | `[data-testid="nav-cart-count"]` → `1` |

#### 4. Log in as demo customer

| Action | Selector / Value |
| --- | --- |
| Click | `[data-testid="nav-login"]` (header link to `/login`) |
| Assert URL | equals `/login` (or ends with `/login`) |
| Fill | `[data-testid="login-email"]` → `demo@cheapshot.test` |
| Fill | `[data-testid="login-password"]` → `demo1234` |
| Click | `[data-testid="login-submit"]` |
| Assert element text contains | `[data-testid="nav-account"]` → `Hi, Demo` *(this replaces `nav-login` in the header after login)* |

#### 5. Cart verify

| Action | Selector / Value |
| --- | --- |
| Click | `[data-testid="nav-cart"]` (or navigate to `/cart`) |
| Assert URL | equals `/cart` |
| Assert element text equals | `[data-testid="cart-heading"]` → `Your Cart` |
| Assert element exists | `[data-testid="cart-line-p-stk-001"]` |
| Assert element text equals | `[data-testid="qty-p-stk-001"]` → `1` *(structural: quantity)* |
| Assert element text equals | `[data-testid="cart-line-total-p-stk-001"]` → `$199.99` |
| Assert element text equals | `[data-testid="cart-subtotal"]` → `$199.99` *(business-logic)* |
| Visual snapshot | Element `[data-testid="cart-lines"]` — name `cart-line-items` |

#### 6. Checkout — address + preview totals

| Action | Selector / Value |
| --- | --- |
| Click | `[data-testid="cart-checkout"]` |
| Assert URL | equals `/checkout` |
| Assert element text equals | `[data-testid="checkout-heading"]` → `Checkout` |
| Fill | `[data-testid="checkout-name"]` → `Demo Customer` |
| Fill | `[data-testid="checkout-street"]` → `1 Rink Road` |
| Fill | `[data-testid="checkout-city"]` → `Minneapolis` |
| Fill | `[data-testid="checkout-state"]` → `MN` |
| Fill | `[data-testid="checkout-postalCode"]` → `55401` |
| Fill | `[data-testid="checkout-country"]` → `US` |
| Assert element text equals | `[data-testid="checkout-subtotal"]` → `$199.99` *(business-logic)* |
| Assert element text equals | `[data-testid="checkout-tax"]` → `$16.00` *(business-logic: 8% tax)* |
| Assert element text equals | `[data-testid="checkout-shipping"]` → `FREE` *(business-logic: free over $99; note text is **FREE** not **$0.00**)* |
| Assert element text equals | `[data-testid="checkout-total"]` → `$215.99` *(business-logic: the big one)* |

#### 7. Place order + confirmation

| Action | Selector / Value |
| --- | --- |
| Click | `[data-testid="checkout-submit"]` |
| Wait for navigation | (mabl auto-waits) |
| Assert URL | matches regex `^/orders/o-[a-z0-9]+$` *(dynamic id — pattern match, not exact)* |
| Assert element text starts with | `[data-testid="order-id"]` → `Order o-` |
| Assert element text equals | `[data-testid="order-status"]` → `paid` *(lowercase — note this is **not** "Paid")* |
| Assert element text equals | `[data-testid="order-total"]` → `$215.99` *(business-logic: end-to-end math)* |
| Assert element text equals | `[data-testid="order-shipping"]` → `FREE` |
| Assert element text equals | `[data-testid="order-tax"]` → `$16.00` |
| Assert element exists | `[data-testid="order-ship-to"]` |
| Visual snapshot | Element `[data-testid="order-id"]`'s section — name `order-confirmation` |

### Gotchas caught during the walk

| Thing | Actual value | What you might have written instead |
| --- | --- | --- |
| Order status text | `paid` (lowercase) | `"Paid"` |
| Shipping display | `FREE` (word) | `"$0.00"` |
| Account indicator after login | `Hi, Demo` in `[data-testid="nav-account"]` | `"Demo Customer"` (full name not shown in header) |
| Add-to-cart feedback | `Added to cart` in a dedicated `[data-testid="add-to-cart-feedback-p-stk-001"]` span, not a toast | toast/snackbar pattern |
| Cart count after add | `1` in `[data-testid="nav-cart-count"]` | searching for a cart-badge by class name |
| Order id | dynamic `o-mo8xfujo49fa` | regex/pattern match, not equality |

### Labels (apply after saving the test)

Open the test → **Add label** → paste each (mabl UI accepts newline or
comma separation):

```
type-chp
type-ui
priority-p0
feat-checkout
feat-cart
feat-login
feat-catalog
exec-pr
exec-postdeploy
exec-nightly
team-platform
```

### Plan

Create plan **CSH-UI-PR-GATE** (if not existing):
- Plan labels: `type-ui, exec-pr, exec-postdeploy, exec-nightly, team-platform`
- Environments: Preview, Production, Local
- Include the test above

Once the test is labeled + in the plan, the next PR push to GitHub
will trigger both Jenkins stage 8 and the GHA `mabl-ui-pr-gate` job
(both dispatch `type-ui,exec-pr`) and the test will run against
Preview automatically.

### Fallback authoring paths (if the Trainer chokes)

- **Playwright export:** if a Playwright script exists for the same
  flow, use `export_to_playwright` or import the `.spec.ts` directly
  into mabl.
- **mabl cloud retry:** revisit in a week — mabl's cloud-gen stability
  changes over time.

---

## References

- `MABL-API-TESTS.md` — sibling API layer catalog
- *Scaling mabl: Enterprise Naming and Labeling Governance Framework
  v2.0*
- `Jenkinsfile` — stage 8 dispatches `type-e2e,exec-pr` (to be
  reconciled with `type-chp`)
- `.github/workflows/mabl-sdlc.yml` — `mabl-ui-pr-gate` job

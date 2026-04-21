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

## Authoring

### Option A: mabl Cloud Test Generation (tried first)

```
plan_new_test + create_mabl_test_from_plan(mode: "cloud")
```

Works when mabl's cloud agent is available. If the session sits in
`queued` for more than 5 minutes, fall back to Option B.

### Option B: Local Trainer (reliable)

1. Tests → **Create new** → **Browser test**
2. App: **Cheap Shot Hockey**, Env: **Local**
3. Starting URL: `http://localhost:3000`
4. Open the Trainer (desktop app), record the 7 tasks above
5. Pause the trainer at each "assert" point and add the assertion
   (existence for structural, exact-text for business-logic)
6. Pause at visual checkpoint points and click "Take snapshot"
7. Save → apply labels → add to plan `CSH-UI-PR-GATE`

### Option C: Playwright export

If the Trainer is slow or a Playwright script already exists, use
`export_to_playwright` after a local author then reuse the recording
for other envs.

---

## References

- `MABL-API-TESTS.md` — sibling API layer catalog
- *Scaling mabl: Enterprise Naming and Labeling Governance Framework
  v2.0*
- `Jenkinsfile` — stage 8 dispatches `type-e2e,exec-pr` (to be
  reconciled with `type-chp`)
- `.github/workflows/mabl-sdlc.yml` — `mabl-ui-pr-gate` job

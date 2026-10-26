---
name: ship
description: Take a TAMD Jira ticket from implementation to an open PR in cheap-shot-hockey — implement, check mabl test impact, update mabl tests on a mabl branch named after the git branch, verify locally, write the change description, then stop for a human go before pushing. Use for "/ship TAMD-N", "ship this ticket", "take TAMD-N to a PR".
---

# /ship TAMD-N

The coding agent writes the change and proposes test changes; mabl verifies the
running preview; a human approves. You never push, merge a mabl branch, apply
`human-approved` or `test-impact-gate-exempt`, or promote production.

## 1. Branch
- Read the ticket. Branch from up-to-date `main` as `TAMD-N/<short-slug>`.

## 2. Implement
- Make the change. Every new interactive element gets a `data-testid` matching
  the pattern nearby. Run `npm run lint` and `npm test`.

## 3. What does mabl already cover?
- Use the `mabl-test-impact` skill with a product-level description of the
  change (every user-facing area it reaches, not file names). Note the impacted
  tests, any marked `fails_by_design`, and the coverage gaps.

## 4. Update tests on a mabl branch
- Create the mabl branch with the exact git branch name (`create_mabl_branch`).
- For each `fails_by_design` test, use `mabl-test-edit` on that branch. For a
  real gap the ticket asks to cover, use `mabl-test-authoring` on that branch
  and label the test with the ticket key.
- Verify each edit with `mabl-test-edit-verify`.

## 5. Run locally (0 credits)
- `mabl tests run --id <test> --mabl-branch <branch> --headless --url http://localhost:3000`
  for each edited or impacted test, against `npm run dev`. Never start cloud
  runs; CI does that.

## 6. Write the PR body
```
## Change description
<what changed for users, in product terms — CI feeds this to mabl's test impact analysis>

## mabl tests
<tests edited/authored on mabl branch TAMD-N/<slug>, with local results>

## Test impact
<impacted tests and coverage gaps from step 3>
```

## 7. Stop for a human go
- Show the diff summary, the mabl branch changes and the PR body. Wait for an
  explicit "go". Then commit as `TAMD-N: <summary>`, push, open the PR, and arm
  auto-merge (`gh pr merge --auto --merge --delete-branch`).

## After merge (human)
- The human checks `mabl branches merge-status` and merges the mabl branch.
- Production deploys on merge and `postdeploy.yml` smokes it. "Can we ship?"
  questions go to `check_release_readiness` on the deployment.

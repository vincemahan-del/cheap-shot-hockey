#!/usr/bin/env bash
# demo-preflight.sh — 20-second sanity check before starting the
# ticket-to-prod demo. Fails loud on anything missing so you're not
# debugging on stage.
set -u

# Resolve repo root so `gh` + `git` always operate on the right repo,
# regardless of the caller's working directory.
repo_root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)"
[ -n "$repo_root" ] && cd "$repo_root"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
TICK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"

issues=0

echo "🏒 Demo pre-flight — cheap-shot-hockey"
echo ""

# ─── 1. Working tree clean ──────────────────────────────────
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo -e "  ${WARN} uncommitted changes in working tree"
  git status --short | head -5 | sed 's/^/      /'
  issues=$((issues+1))
else
  echo -e "  ${TICK} working tree clean"
fi

# ─── 2. On main branch ──────────────────────────────────────
branch=$(git branch --show-current 2>/dev/null)
if [ "$branch" = "main" ]; then
  echo -e "  ${TICK} on branch main"
else
  echo -e "  ${WARN} on branch $branch (demo usually starts from main)"
fi

# ─── 3. Dev server up ───────────────────────────────────────
if curl -fsS -m 3 http://localhost:3000/api/health >/dev/null 2>&1; then
  echo -e "  ${TICK} dev server responding on :3000"
else
  echo -e "  ${CROSS} dev server NOT responding on :3000 — run 'npm run dev'"
  issues=$((issues+1))
fi

# ─── 4. Required GitHub secrets ─────────────────────────────
secrets=$(gh secret list 2>/dev/null | awk '{print $1}')
for s in MABL_API_TOKEN MABL_APPLICATION_ID MABL_ENV_PREVIEW_ID MABL_ENV_PROD_ID JIRA_USER_EMAIL JIRA_API_TOKEN; do
  if echo "$secrets" | grep -q "^${s}\$"; then
    echo -e "  ${TICK} secret set: $s"
  else
    echo -e "  ${CROSS} missing secret: $s"
    issues=$((issues+1))
  fi
done
if ! echo "$secrets" | grep -q "^SLACK_WEBHOOK_URL\$"; then
  echo -e "  ${WARN} SLACK_WEBHOOK_URL not set — ci-notify.sh Slack skips. MCP narration covers."
fi

# ─── 5. Branch protection still on main ─────────────────────
protection=$(gh api repos/vincemahan-del/cheap-shot-hockey/branches/main/protection 2>/dev/null | jq -r '.required_status_checks.contexts | length' 2>/dev/null)
if [ "$protection" = "5" ] || [ "$protection" = "4" ]; then
  echo -e "  ${TICK} branch protection active (${protection} required checks)"
else
  echo -e "  ${CROSS} branch protection misconfigured (got: ${protection:-?})"
  issues=$((issues+1))
fi

# ─── 6. Live prod reachable ─────────────────────────────────
if curl -fsS -m 5 https://cheap-shot-hockey.vercel.app/api/health >/dev/null 2>&1; then
  echo -e "  ${TICK} live prod reachable"
else
  echo -e "  ${CROSS} live prod not reachable — Vercel issue?"
  issues=$((issues+1))
fi

# ─── 7. Jenkins status (informational) ──────────────────────
if pgrep -fl jenkins >/dev/null 2>&1 || curl -fsS -m 1 http://localhost:8080/login >/dev/null 2>&1; then
  echo -e "  ${WARN} Jenkins looks active — consider stopping for single-CI demo"
else
  echo -e "  ${TICK} Jenkins not running (single-CI demo)"
fi

# ─── 8. mabl plans discoverable ─────────────────────────────
echo ""
echo "Open in browser (Cmd+Click):"
echo "  • https://github.com/vincemahan-del/cheap-shot-hockey/pulls"
echo "  • https://mabl.atlassian.net/projects/TAMD"
echo "  • https://mablhq.slack.com/archives/C0A321B477Y"
echo "  • https://app.mabl.com/workspaces/pXXgThbNi4HfQOpiZptHfw-w"
echo "  • https://cheap-shot-hockey.vercel.app"
echo ""

if [ "$issues" -gt 0 ]; then
  echo -e "${RED}Pre-flight FAILED: ${issues} blocker(s). Fix before starting the demo.${NC}"
  exit 1
else
  echo -e "${GREEN}Pre-flight OK. Ready to demo.${NC}"
  exit 0
fi

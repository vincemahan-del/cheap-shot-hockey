#!/usr/bin/env bash
# Workshop preflight: everything the 45-minute flow depends on, checked in
# under a minute. Exits non-zero if any check fails.
set -uo pipefail

REPO=${REPO:-vincemahan-del/cheap-shot-hockey}
PROD_URL=https://cheap-shot-hockey.vercel.app
fails=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; fails=$((fails + 1)); }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

echo "Auth"
gh auth status >/dev/null 2>&1 && ok "gh" || bad "gh: run gh auth login"
mabl auth info >/dev/null 2>&1 && ok "mabl CLI ($(mabl --version))" || bad "mabl: run mabl auth login --auto"
vercel whoami >/dev/null 2>&1 && ok "vercel" || bad "vercel: run vercel login"

echo "Pipeline"
gate=$(gh variable get MABL_CLOUD_GATE --repo "$REPO" 2>/dev/null || echo enabled)
[ "$gate" = "enabled" ] && ok "cloud runs enabled" || warn "cloud runs paused (MABL_CLOUD_GATE=$gate): the mabl gates won't test anything"

required=$(gh api "repos/$REPO/branches/main/protection/required_status_checks" --jq '.contexts | sort | join(",")' 2>/dev/null)
expected="CodeQL,build,dependency-review,human-approved,lint,mabl-impact,mabl-smoke,unit"
[ "$required" = "$expected" ] && ok "required checks" || bad "required checks are '$required'"

armed=$(gh pr list --repo "$REPO" --state open --json number,autoMergeRequest --jq '[.[] | select(.autoMergeRequest)] | length')
[ "$armed" = "0" ] && ok "no other PRs armed to auto-merge" || warn "$armed open PR(s) armed to auto-merge could race the demo"
deps=$(gh pr list --repo "$REPO" --state open --author app/dependabot --json number --jq 'length')
[ "$deps" = "0" ] && ok "no open Dependabot PRs" || warn "$deps open Dependabot PR(s)"

echo "Production"
main_sha=$(gh api "repos/$REPO/commits/main" --jq .sha 2>/dev/null)
served=$(curl -fsS -m 10 "$PROD_URL/api/build-info" | jq -r '.commit // empty' 2>/dev/null)
if [ -z "$served" ]; then bad "production not answering /api/build-info"
elif [ "$served" = "$main_sha" ]; then ok "production serves main (${served:0:7})"
else warn "production serves ${served:0:7}, main is ${main_sha:0:7}"; fi

echo "Regression"
nightly=$(gh run list --repo "$REPO" --workflow nightly.yml --limit 1 --json conclusion,createdAt --jq '.[0] // empty | "\(.conclusion) \(.createdAt)"' 2>/dev/null)
case "$nightly" in
  success*) ok "last nightly: $nightly" ;;
  "") warn "no nightly run yet" ;;
  *) warn "last nightly: $nightly (fine for the triage act if it's the exhibit)" ;;
esac

echo
[ "$fails" -eq 0 ] && echo "Ready." || echo "$fails check(s) failed."
exit "$fails"

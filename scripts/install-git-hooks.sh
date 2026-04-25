#!/usr/bin/env bash
# Installs the repo's git hooks into .git/hooks/.
# Run once per clone: ./scripts/install-git-hooks.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

HOOK_DIR=".git/hooks"
mkdir -p "$HOOK_DIR"

cat > "$HOOK_DIR/pre-push" <<'HOOK'
#!/usr/bin/env bash
# pre-push hook: T1 mabl local gate + test impact suggestions.
#
# Blocking: runs the API smoke suite against localhost:3000 before any push.
# Advisory: suggests relevant mabl tests for any changed files.
#
# Skip for a single push (emergency bypass):
#   git push --no-verify
#
# The full CSH-SMOKE-API runs in mabl cloud (T2) against the PR preview
# deploy anyway, so skipping locally is not a safety hole — just delays
# the signal by a deploy cycle.
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"

# Skip entirely in CI or non-interactive (agentic) contexts.
# CI handles its own gates; the hook is for human developer feedback only.
if [[ -n "${CI:-}" ]] || ! [ -t 1 ]; then
  exit 0
fi

echo "🏒 pre-push: T1 mabl local gate"

if ! curl -fsS -m 3 http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "⚠️  dev server not running on :3000 — skipping T1 gate."
  echo "    mabl cloud (T2) will still validate this push against Preview."
else
  "$REPO_ROOT/scripts/mabl-local-gate.sh"
fi

# Advisory: suggest mabl tests for changed files (never blocks push)
changed=$(git diff --name-only "$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo main)" HEAD 2>/dev/null || true)
if [[ -n "$changed" ]]; then
  echo ""
  echo "🔍 Checking for relevant mabl tests..."
  echo "$changed" | "$REPO_ROOT/scripts/mabl-suggest-tests.sh" || true
fi

exit 0
HOOK

chmod +x "$HOOK_DIR/pre-push"
echo "✅ installed $HOOK_DIR/pre-push"
echo "   Bypass for one push: git push --no-verify"

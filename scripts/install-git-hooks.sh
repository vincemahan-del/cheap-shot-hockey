#!/usr/bin/env bash
# Installs the repo's git hooks into .git/hooks/.
# Run once per clone: ./scripts/install-git-hooks.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

HOOK_DIR=".git/hooks"
mkdir -p "$HOOK_DIR"

cat > "$HOOK_DIR/pre-push" <<'HOOK'
#!/usr/bin/env bash
# pre-push hook: T1 mabl local gate.
#
# Runs the API smoke suite against localhost:3000 before any push.
# Exits non-zero on any assertion failure — blocks the push.
#
# Skip for a single push (emergency bypass):
#   git push --no-verify
#
# The full CSH-SMOKE-API runs in mabl cloud (T2) against the PR preview
# deploy anyway, so skipping locally is not a safety hole — just delays
# the signal by a deploy cycle.
set -e

echo "🏒 pre-push: T1 mabl local gate"

if ! curl -fsS -m 3 http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "⚠️  dev server not running on :3000 — skipping T1 gate."
  echo "    mabl cloud (T2) will still validate this push against Preview."
  exit 0
fi

./scripts/mabl-local-gate.sh
HOOK

chmod +x "$HOOK_DIR/pre-push"
echo "✅ installed $HOOK_DIR/pre-push"
echo "   Bypass for one push: git push --no-verify"

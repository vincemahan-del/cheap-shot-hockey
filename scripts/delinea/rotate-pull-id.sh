#!/usr/bin/env bash
# Rotation for the PULL-model Shared System ID — note what is ABSENT: no mabl
# API call at all. The vault is the only thing updated besides the app; the
# pull-model test fetches the current secret from the vault at run start, so
# rotation never touches mabl.
#
#   1. Rotate the app-side password (token-guarded POST /api/test/rotate-password).
#   2. Update the vault's record of the secret (PUT /api/test/vault/{id}) —
#      in real Delinea this is the Secret's own value after RPC; here the
#      mock vault plays that role.
#
# First run also registers the fixed pull identity if it doesn't exist yet.
# Usage: scripts/delinea/rotate-pull-id.sh
# Env: PULL_ID_EMAIL (default svc-role-pull@cheapshot.test), VAULT_SECRET_ID
# (default 4021 — a Delinea-style numeric secret id), APP_URL, TEST_SEED_TOKEN.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_var TEST_SEED_TOKEN "Set it in .env.local and the app's env."

PULL_ID_EMAIL="${PULL_ID_EMAIL:-svc-role-pull@cheapshot.test}"
VAULT_SECRET_ID="${VAULT_SECRET_ID:-4021}"
NEW_PASSWORD="$(new_password)"

echo "── Pull-model rotation (vault-only — no mabl call) ──"
echo "target app: $APP_URL"
echo "shared ID:  $PULL_ID_EMAIL (vault secret #$VAULT_SECRET_ID)"

# 0. Ensure the fixed identity exists (idempotent; rotation below converges).
register_response=$(curl -sS -X POST "$APP_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg email "$PULL_ID_EMAIL" --arg pw "$NEW_PASSWORD" \
        '{email: $email, password: $pw, name: "PullModel SharedSystemID"}')")
if jq -e '.id' <<<"$register_response" >/dev/null 2>&1; then
  echo "✓ app user created: $PULL_ID_EMAIL"
elif ! grep -q "already exists" <<<"$register_response"; then
  echo "error: register failed: $register_response" >&2
  exit 1
fi

# 1. Rotate in the app (Delinea RPC's job in production).
rotate_response=$(curl -sS -X POST "$APP_URL/api/test/rotate-password" \
  -H "Content-Type: application/json" \
  -H "x-test-seed-token: $TEST_SEED_TOKEN" \
  -d "$(jq -n --arg email "$PULL_ID_EMAIL" --arg pw "$NEW_PASSWORD" \
        '{email: $email, newPassword: $pw}')")
if ! jq -e '.rotatedAt' <<<"$rotate_response" >/dev/null 2>&1; then
  echo "error: app-side rotation failed: $rotate_response" >&2
  exit 1
fi
echo "✓ app password rotated ($(jq -r '.rotatedAt' <<<"$rotate_response"))"

# 2. Update the vault's record — the secret's new current value.
vault_response=$(curl -sS -X PUT "$APP_URL/api/test/vault/$VAULT_SECRET_ID" \
  -H "Content-Type: application/json" \
  -H "x-vault-token: $TEST_SEED_TOKEN" \
  -d "$(jq -n --arg u "$PULL_ID_EMAIL" --arg pw "$NEW_PASSWORD" \
        '{username: $u, password: $pw}')")
if ! jq -e '.updatedAt' <<<"$vault_response" >/dev/null 2>&1; then
  echo "error: vault update failed: $vault_response" >&2
  exit 1
fi
echo "✓ vault secret #$VAULT_SECRET_ID updated ($(jq -r '.updatedAt' <<<"$vault_response"))"
echo
echo "Rotation complete. mabl was not called — the pull-model test fetches"
echo "the current secret from the vault at its next run start."
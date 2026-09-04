#!/usr/bin/env bash
# "APIs in action" — the full mabl credential lifecycle in ~60 seconds,
# against a clearly-named SCRATCH credential that is deleted at the end.
# Safe to run any time; touches nothing the rotation demo depends on.
#
# Usage: scripts/delinea/api-lifecycle-demo.sh

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_var MABL_API_TOKEN "Set it in .env.local (Workspace-admin key)."

SCRATCH_NAME="SCRATCH — API lifecycle demo (safe to delete)"
PW1="$(new_password)"

step() { echo; echo "── $1"; echo "   $2"; }

step "1 · CREATE (cloud-only from birth)" "POST /credentials"
CRED_ID=$(mabl_api POST "/credentials" "$(jq -n \
  --arg name "$SCRATCH_NAME" --arg org "$MABL_WORKSPACE_ID" --arg pw "$PW1" \
  '{name: $name, type: "basic", organization_id: $org, cloud_only: true,
    properties: {username: "scratch-demo@cheapshot.test", password: $pw}}')" | jq -r '.id')
echo "   → created: $CRED_ID"

step "2 · READ — the secret does not come back" "GET /credentials/$CRED_ID"
mabl_api GET "/credentials/$CRED_ID" | jq '{id, name, cloud_only,
  password_returned: (.properties.password != null and .properties.password != ""),
  last_updated_time}'

step "3 · ROTATE — what the Delinea hook does" "PATCH /credentials/$CRED_ID"
mabl_api PATCH "/credentials/$CRED_ID" "$(jq -n --arg pw "$(new_password)" \
  '{properties: {username: "scratch-demo@cheapshot.test", password: $pw}}')" |
  jq '{id, last_updated_time}'
echo "   → value changed; still nothing readable back"

step "4 · DELETE — full lifecycle owned via API" "DELETE /credentials/$CRED_ID"
mabl_api DELETE "/credentials/$CRED_ID" >/dev/null && echo "   → deleted"

echo
echo "Lifecycle complete: create → read (write-only) → rotate → delete."

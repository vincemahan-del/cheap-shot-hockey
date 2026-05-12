#!/usr/bin/env bash
# Atlassian MCP launcher — pulls the Jira API token from macOS keychain
# at server start, then execs the npx mcp-atlassian server. Keeps the
# token off plaintext disk; only the launcher (with no secret) lives in
# .mcp.json or in your shell config.
#
# Set up once on a new laptop:
#
#   security add-generic-password \
#     -a "$USER@$HOSTNAME" \
#     -s "csh-atlassian-mcp" \
#     -w "<your Atlassian API token>" \
#     -U                                  # -U updates if entry exists
#
# Reference from .mcp.json (replace the previous "atlassian" entry):
#
#   "atlassian": {
#     "command": "/absolute/path/to/scripts/local/mcp-atlassian-launch.sh"
#   }
#
# Why a launcher and not env-substitution: .mcp.json is JSON, not shell —
# it can't run `$(security find-generic-password ...)`. The launcher is
# the shim that bridges plaintext JSON to keychain lookup.

set -euo pipefail

JIRA_USERNAME_DEFAULT="${JIRA_USERNAME:-${USER}@mabl.com}"
JIRA_URL_DEFAULT="${JIRA_URL:-https://mabl.atlassian.net}"
KEYCHAIN_SERVICE="${MCP_ATLASSIAN_KEYCHAIN_SERVICE:-csh-atlassian-mcp}"
KEYCHAIN_ACCOUNT="${MCP_ATLASSIAN_KEYCHAIN_ACCOUNT:-${USER}@$(hostname -s)}"

if ! command -v security >/dev/null 2>&1; then
  echo "mcp-atlassian-launch.sh: \`security\` command not found." >&2
  echo "This launcher is macOS-only. On Linux, swap for pass / libsecret." >&2
  exit 127
fi

# Lookup. -w prints the password only (vs the full entry). Errors go to
# stderr; we capture them so a missing entry produces a clear diagnostic
# rather than a silent empty token.
if ! token=$(security find-generic-password \
      -a "$KEYCHAIN_ACCOUNT" \
      -s "$KEYCHAIN_SERVICE" \
      -w 2>/dev/null); then
  cat >&2 <<EOF
mcp-atlassian-launch.sh: no entry for service="$KEYCHAIN_SERVICE"
account="$KEYCHAIN_ACCOUNT" in your macOS keychain.

To create:

  security add-generic-password \\
    -a "$KEYCHAIN_ACCOUNT" \\
    -s "$KEYCHAIN_SERVICE" \\
    -w "<your Atlassian API token>" \\
    -U

EOF
  exit 1
fi

export JIRA_API_TOKEN="$token"
export JIRA_USERNAME="$JIRA_USERNAME_DEFAULT"
export JIRA_URL="$JIRA_URL_DEFAULT"
unset token

exec npx --yes mcp-atlassian --transport stdio

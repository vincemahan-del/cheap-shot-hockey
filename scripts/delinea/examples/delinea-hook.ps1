# Sample Delinea Secret Server event-pipeline task for the mabl sync hook.
#
# Wiring: Event Pipeline with trigger "Secret: Password Change" -> task
# "Run script" pointing at this script. Scope the pipeline (folder/template)
# to the Shared System ID secrets so it fires only for them.
#
# Inputs: pass the rotated secret's username/password via the pipeline's
# script-argument token substitution, and keep the mabl API key in its own
# Delinea secret. The mabl key must be the "Workspace admin" type — the only
# workspace key type with credentials.write.
#
# The Secret-ID -> mabl-credential-ID mapping is one line per Shared System ID.
# See docs/DELINEA-ROTATION-POC.md for the full pattern.

param(
    [Parameter(Mandatory)] [string] $Username,     # rotated account's username
    [Parameter(Mandatory)] [string] $NewPassword,  # rotated account's new password
    [Parameter(Mandatory)] [string] $MablApiKey,   # from a Delinea secret, not inline
    [Parameter(Mandatory)] [string] $CredentialId  # mabl credential ID (ends in -c)
)

$body = @{ properties = @{ username = $Username; password = $NewPassword } } |
    ConvertTo-Json -Depth 3

# mabl API auth: HTTP Basic with a blank username and the API key as password.
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$MablApiKey"))

Invoke-RestMethod -Method Patch `
    -Uri "https://api.mabl.com/credentials/$CredentialId" `
    -Headers @{ Authorization = "Basic $auth" } `
    -ContentType 'application/json' `
    -Body $body | Out-Null

Write-Output "mabl credential $CredentialId synced for $Username"

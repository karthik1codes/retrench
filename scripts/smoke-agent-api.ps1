# Smoke-test Signal Scout HTTP API (local or EC2).
# Usage:
#   .\scripts\smoke-agent-api.ps1
#   .\scripts\smoke-agent-api.ps1 -BaseUrl http://127.0.0.1:8787 -Token change-me

param(
  [string]$BaseUrl = "http://127.0.0.1:8787",
  [string]$Token = "change-me"
)

$ErrorActionPreference = "Stop"
$headers = @{ "X-Scout-Token" = $Token; "Accept" = "application/json" }

Write-Host "GET $BaseUrl/health"
curl.exe -s -w "`nHTTP %{http_code}`n" --connect-timeout 5 "$BaseUrl/health"
Write-Host ""

Write-Host "GET $BaseUrl/targets?days=7"
curl.exe -s -w "`nHTTP %{http_code}`n" --connect-timeout 8 -H "X-Scout-Token: $Token" "$BaseUrl/targets?days=7"
Write-Host ""

Write-Host "GET $BaseUrl/overview"
curl.exe -s -w "`nHTTP %{http_code}`n" --connect-timeout 8 -H "X-Scout-Token: $Token" "$BaseUrl/overview"
Write-Host ""

Write-Host "GET $BaseUrl/watchlist?days=14"
curl.exe -s -w "`nHTTP %{http_code}`n" --connect-timeout 8 -H "X-Scout-Token: $Token" "$BaseUrl/watchlist?days=14"
Write-Host ""

Write-Host "Done. If health fails, start: python -m signalscout serve --host 127.0.0.1 --port 8787"

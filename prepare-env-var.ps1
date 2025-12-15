# PowerShell script untuk prepare OAuth session sebagai environment variable
# Usage: .\prepare-env-var.ps1

Write-Host "Preparing OAuth session for Render.com..." -ForegroundColor Cyan

if (-not (Test-Path "oauth-session.json")) {
    Write-Host "ERROR: File oauth-session.json not found!" -ForegroundColor Red
    Write-Host "Please run: npm run extract-oauth first" -ForegroundColor Yellow
    exit 1
}

Write-Host "Reading oauth-session.json..." -ForegroundColor Gray

# Read and minify JSON
$json = Get-Content "oauth-session.json" -Raw | ConvertFrom-Json
$minified = $json | ConvertTo-Json -Compress -Depth 10

# Save minified version
$minified | Set-Content "oauth-session-minified.json" -NoNewline

# Copy to clipboard
$minified | Set-Clipboard

Write-Host "Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Minified JSON has been:" -ForegroundColor White
Write-Host "  - Saved to: oauth-session-minified.json" -ForegroundColor Gray
Write-Host "  - Copied to clipboard!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Go to Render.com Dashboard" -ForegroundColor White
Write-Host "  2. Select service: crawler-service" -ForegroundColor White
Write-Host "  3. Click Environment tab" -ForegroundColor White
Write-Host "  4. Add new variable:" -ForegroundColor White
Write-Host "     Key: OAUTH_SESSION_DATA" -ForegroundColor Yellow
Write-Host "     Value: Paste from clipboard (Ctrl+V)" -ForegroundColor Yellow
Write-Host "  5. Click Save Changes" -ForegroundColor White
Write-Host "  6. Service will auto-redeploy" -ForegroundColor White
Write-Host ""
Write-Host "Session expires in: 30-90 days" -ForegroundColor Gray
Write-Host ""

# Show file size info
$fileSize = (Get-Item "oauth-session-minified.json").Length
Write-Host "JSON size: $fileSize bytes" -ForegroundColor Gray

if ($fileSize -gt 10000) {
    Write-Host "WARNING: JSON is quite large (>10KB)" -ForegroundColor Yellow
    Write-Host "Consider using Render Persistent Disk for better reliability" -ForegroundColor Yellow
}


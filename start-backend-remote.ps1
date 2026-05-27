$ErrorActionPreference = "Stop"

Set-Location -Path "$PSScriptRoot\backend"

if (Test-Path ".\.venv\Scripts\Activate.ps1") {
  . ".\.venv\Scripts\Activate.ps1"
}

try {
  $ipv4 = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress)

  if ($ipv4) {
    Write-Host ""
    Write-Host "Backend LAN endpoint:" -ForegroundColor Cyan
    Write-Host "  http://$ipv4`:2509" -ForegroundColor Green
    Write-Host ""
  }
} catch {
  Write-Host "Could not detect LAN IP automatically. Use ipconfig to find IPv4." -ForegroundColor Yellow
}

python -m uvicorn app.main:app --host 0.0.0.0 --port 2509 --reload

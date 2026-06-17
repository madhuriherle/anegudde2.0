Set-Location -Path "$PSScriptRoot\frontend"

try {
  $ipv4 = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress)

  if ($ipv4) {
    Write-Host ""
    Write-Host "Open from another device using:" -ForegroundColor Cyan
    Write-Host "  http://$ipv4`:2508/login" -ForegroundColor Green
    Write-Host ""
  }
} catch {
  Write-Host "Could not detect LAN IP automatically. Use ipconfig to find IPv4." -ForegroundColor Yellow
}

& "C:\Program Files\nodejs\npm.cmd" run dev -- --host 0.0.0.0 --port 2508

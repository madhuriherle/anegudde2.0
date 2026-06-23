# Automation Script to Build, Package, and Deploy Anegudde Token App

Write-Host "1. Building Flutter Windows Application in Release Mode..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\token_desktop_app"
flutter build windows

if ($LASTEXITCODE -ne 0) {
    Write-Error "Flutter build failed!"
    exit 1
}

Write-Host "`n2. Packaging Installer using Inno Setup..." -ForegroundColor Cyan
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" build_installer.iss

if ($LASTEXITCODE -ne 0) {
    Write-Error "Inno Setup compilation failed!"
    exit 1
}

Write-Host "`n3. Copying Setup Installer to Backend installers folder..." -ForegroundColor Cyan
Set-Location -Path $PSScriptRoot
if (-not (Test-Path "backend\app\installers")) {
    New-Item -ItemType Directory -Force -Path "backend\app\installers"
}
Copy-Item -Path "token_desktop_app\Output\TokenApp_Setup.exe" -Destination "backend\app\installers\TokenApp_Setup.exe" -Force

Write-Host "`n4. Running VPS Synchronization (resync_vps.py)..." -ForegroundColor Cyan
python resync_vps.py

Write-Host "`nAll steps completed successfully!" -ForegroundColor Green

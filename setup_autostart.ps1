# Run this script to set up auto-start on Windows login.
# Creates a SHORTCUT in the Startup folder pointing at the live Launch_ATMS.bat
# in this folder - not a copy - so future edits to Launch_ATMS.bat take effect
# on the next login automatically, with nothing to re-run.

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $scriptDir "Launch_ATMS.bat"
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "Launch_ATMS.lnk"

# Remove a stale copy from an older version of this script, if present.
$staleCopy = Join-Path $startupDir "Launch_ATMS.bat"
if (Test-Path $staleCopy) {
    Remove-Item $staleCopy -Force
    Write-Host "Removed stale Launch_ATMS.bat copy from Startup folder."
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $target
$Shortcut.WorkingDirectory = $scriptDir
$Shortcut.Save()

Write-Host "SUCCESS: Startup shortcut created, pointing to $target"
Write-Host "It will run automatically on login and always use the current file."
Write-Host ""
Write-Host "Done! Restart your computer to test."
Read-Host "Press Enter to exit"

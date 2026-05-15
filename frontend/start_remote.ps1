$ErrorActionPreference = "Stop"

$frontendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $frontendDir

npm run dev:remote

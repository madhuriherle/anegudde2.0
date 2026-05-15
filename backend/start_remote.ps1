$ErrorActionPreference = "Stop"

$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendDir

& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 2417 --reload

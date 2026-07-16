@echo off
setlocal enabledelayedexpansion
taskkill /FI "WINDOWTITLE eq ATMS_Launcher" /T /F >nul 2>&1
title ATMS_Launcher

echo ========================================
echo  Anegudde Inventory System - Starting
echo ========================================

echo.
echo Waiting for network connection (WiFi/Ethernet)...
set waitcount=0
:waitnet
ipconfig | findstr /c:"IPv4 Address" | findstr /v "169.254" >nul
if not errorlevel 1 goto networkready
set /a waitcount+=1
if %waitcount% GEQ 45 (
    echo WARNING: No network detected after 90 seconds - continuing anyway.
    goto networkready
)
timeout /t 2 /nobreak >nul
goto waitnet
:networkready
echo Network connected.

echo.
echo Stopping any existing instances...

REM Layer 1: kill by the exact PID recorded from the previous run - most
REM precise, immune to uvicorn --reload's parent-respawns-a-fresh-worker
REM race and to window-title matching quirks under different terminal apps.
if exist "%~dp0.backend.pid" (
    set /p oldbackendpid=<"%~dp0.backend.pid"
    if defined oldbackendpid taskkill /PID !oldbackendpid! /T /F >nul 2>&1
    del "%~dp0.backend.pid" >nul 2>&1
)
if exist "%~dp0.frontend.pid" (
    set /p oldfrontendpid=<"%~dp0.frontend.pid"
    if defined oldfrontendpid taskkill /PID !oldfrontendpid! /T /F >nul 2>&1
    del "%~dp0.frontend.pid" >nul 2>&1
)

REM Layer 2: fallback for anything not tracked by a PID file (very first
REM run before PID files existed, or an instance started outside this
REM script).
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :2508 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :2509 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

echo Waiting for ports to be released...
set freewait=0
:waitports
netstat -aon | findstr :2508 | findstr LISTENING >nul
set port2508busy=%errorlevel%
netstat -aon | findstr :2509 | findstr LISTENING >nul
set port2509busy=%errorlevel%
if %port2508busy% NEQ 0 if %port2509busy% NEQ 0 goto portsfree
set /a freewait+=1
if %freewait% GEQ 10 (
    echo WARNING: Ports still appear busy after 10 seconds - continuing anyway.
    goto portsfree
)
timeout /t 1 /nobreak >nul
goto waitports
:portsfree

echo.
echo Starting Backend and Frontend...

cd /d "%~dp0backend"
powershell -NoProfile -Command "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','python -m uvicorn app.main:app --host 0.0.0.0 --port 2509 --reload' -WindowStyle Hidden -PassThru; $p.Id | Out-File -FilePath '%~dp0.backend.pid' -Encoding ascii -NoNewline"

cd /d "%~dp0frontend"
powershell -NoProfile -Command "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run dev -- --host 0.0.0.0 --port 2508' -WindowStyle Hidden -PassThru; $p.Id | Out-File -FilePath '%~dp0.frontend.pid' -Encoding ascii -NoNewline"

echo.
echo Both started in background!
echo Open browser: http://localhost:2508
echo.
echo These now run detached from this window - closing it will NOT stop
echo them (that's deliberate, so the kiosk keeps serving even if this
echo console gets closed by accident). To stop them, just run
echo Launch_ATMS.bat again - it kills the previous run by its recorded
echo PID before starting fresh. Closing this window now is safe.
pause

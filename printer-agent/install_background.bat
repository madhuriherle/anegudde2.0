@echo off
setlocal EnableDelayedExpansion

title Anegudde Printer Agent - Installer
echo.
echo  =========================================================
echo    Anegudde Printer Agent - Background Service Installer
echo  =========================================================
echo.

:: Get script directory without trailing backslash
set "AGENT_DIR=%~dp0"
if "%AGENT_DIR:~-1%"=="\" set "AGENT_DIR=%AGENT_DIR:~0,-1%"

set "VBS_FILE=%AGENT_DIR%\run_hidden.vbs"
set "AGENT_PY=%AGENT_DIR%\agent.py"
set "TASK_NAME=AneguddeePrinterAgent"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

:: Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in PATH.
    echo         Use the offline Python installer provided by the administrator, then try again.
    pause
    exit /b 1
)
echo [OK] Python found.

:: Check if pywin32 is installed. Do not download anything from external websites.
python -c "import win32print" >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%AGENT_DIR%\wheels\pywin32*.whl" (
        echo [INFO] Installing bundled dependency: pywin32...
        for %%W in ("%AGENT_DIR%\wheels\pywin32*.whl") do (
            python -m pip install "%%~fW" --no-index --find-links "%AGENT_DIR%\wheels" -q
        )
        if !errorlevel! neq 0 (
            echo [ERROR] Failed to install bundled pywin32.
            echo         Ask the administrator for an updated offline Printer Agent package.
            pause
            exit /b 1
        )
        echo [OK] Bundled pywin32 installed.
    ) else (
        echo [ERROR] Required dependency pywin32 is not installed.
        echo         This installer will not download from external websites.
        echo         Ask the administrator for an offline Printer Agent package with pywin32 bundled.
        pause
        exit /b 1
    )
) else (
    echo [OK] pywin32 already installed.
)

:: Kill any existing agent instance on port 5623
echo [INFO] Stopping any existing Printer Agent instance...
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr "0.0.0.0:5623"') do (
    if not "%%P"=="" taskkill /f /pid %%P >nul 2>&1
)

:: Remove existing scheduled task if present
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Removing old scheduled task...
    schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
)

:: Remove old startup shortcut if present
if exist "%STARTUP_FOLDER%\Anegudde_Printer_Agent.lnk" (
    del /f /q "%STARTUP_FOLDER%\Anegudde_Printer_Agent.lnk" >nul 2>&1
    echo [INFO] Removed old startup shortcut.
)

:: Register via Task Scheduler using double-quote escaping for /tr
:: Note: inside /tr value, use "" to embed a literal quote (not \")
set "TR_CMD=wscript.exe ""%VBS_FILE%"""
echo [INFO] Registering Windows Task Scheduler job...
schtasks /create /tn "%TASK_NAME%" /tr "%TR_CMD%" /sc ONLOGON /ru "%USERNAME%" /rl LIMITED /f >nul 2>&1

if %errorlevel% neq 0 (
    echo [WARN] Task Scheduler failed. Falling back to Startup folder...
    set "TEMP_VBS=%temp%\CreateShortcut_%RANDOM%.vbs"
    (
        echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
        echo sLinkFile = "%STARTUP_FOLDER%\Anegudde_Printer_Agent.lnk"
        echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
        echo oLink.TargetPath = "wscript.exe"
        echo oLink.Arguments = Chr^(34^) ^& "%VBS_FILE%" ^& Chr^(34^)
        echo oLink.WorkingDirectory = "%AGENT_DIR%"
        echo oLink.Description = "Anegudde Printer Agent"
        echo oLink.Save
    ) > "!TEMP_VBS!"
    cscript //nologo "!TEMP_VBS!"
    del /f /q "!TEMP_VBS!" >nul 2>&1
    echo [OK] Added to Startup folder as fallback.
) else (
    echo [OK] Task Scheduler registered - auto-starts every login.
)

:: Launch the agent now silently
echo [INFO] Starting Printer Agent now...
wscript.exe "%VBS_FILE%"

:: Wait 3 seconds then verify
timeout /t 3 /nobreak >nul

set "IS_RUNNING="
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr "0.0.0.0:5623"') do set "IS_RUNNING=1"

echo.
if defined IS_RUNNING (
    echo  =========================================================
    echo    SUCCESS!
    echo    Printer Agent is running on http://localhost:5623
    echo    It will auto-start on every Windows login from now on.
    echo  =========================================================
) else (
    echo  =========================================================
    echo    Agent started in background.
    echo    Go back to the app and click "Refresh" to see printers.
    echo    ^(It may take a few seconds to start up^)
    echo  =========================================================
)
echo.
pause

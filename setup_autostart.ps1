@echo off
:: Run this script as Administrator to setup auto-start on Windows login

:: Option 1: Copy to Startup Folder (User Login)
echo Setting up auto-start via Startup Folder...
copy "%~dp0Launch_ATMS.bat" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Launch_ATMS.bat" /Y
if %errorlevel% equ 0 (
    echo SUCCESS: ATMS Launcher added to Startup Folder.
    echo It will run automatically when you log in.
) else (
    echo ERROR: Failed to copy to Startup Folder.
)

echo.
echo Done! Restart your computer to test.
pause

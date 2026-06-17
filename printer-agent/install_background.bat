@echo off
echo ===================================================
echo   Anegudde Printer Agent - Background Installer
echo ===================================================
echo.
echo This will set up the Printer Agent to run silently
echo every time you start your computer.
echo.

set "VBS_FILE=%~dp0run_hidden.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Anegudde_Printer_Agent.lnk"

echo Creating background shortcut...

:: Create a temporary VBS script to generate the shortcut
set "TEMP_VBS=%temp%\CreateShortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%TEMP_VBS%"
echo sLinkFile = "%SHORTCUT_PATH%" >> "%TEMP_VBS%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%TEMP_VBS%"
echo oLink.TargetPath = "wscript.exe" >> "%TEMP_VBS%"
echo oLink.Arguments = """" ^& "%VBS_FILE%" ^& """" >> "%TEMP_VBS%"
echo oLink.WorkingDirectory = "%~dp0" >> "%TEMP_VBS%"
echo oLink.Description = "Anegudde Printer Agent Background Service" >> "%TEMP_VBS%"
echo oLink.Save >> "%TEMP_VBS%"

:: Run the temporary script
cscript //nologo "%TEMP_VBS%"
del "%TEMP_VBS%"

echo.
echo Starting the background agent now...
wscript.exe "%VBS_FILE%"

echo.
echo ===================================================
echo   SUCCESS! 
echo   The Printer Agent is now running in the background.
echo   It will automatically start when you turn on the PC.
echo ===================================================
echo.
pause

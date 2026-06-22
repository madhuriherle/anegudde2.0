@echo off
title Printer Agent — http://localhost:5623
echo Starting Printer Agent...
echo.
python "%~dp0agent.py"
if %errorlevel% neq 0 (
    echo.
    echo Failed to start. Make sure Python is installed and pywin32 is available.
    echo Use the offline Printer Agent package provided by the administrator.
    pause
)

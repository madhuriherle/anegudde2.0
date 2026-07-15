@echo off
echo ========================================
echo  Anegudde Inventory System - Starting
echo ========================================

echo.
echo Starting Backend and Frontend...

cd /d "%~dp0backend"
start /b cmd /c "python -m uvicorn app.main:app --host 0.0.0.0 --port 2509 --reload"

cd /d "%~dp0frontend"
start /b cmd /c "npm run dev -- --host 0.0.0.0 --port 2508"

echo.
echo Both started in background!
echo Open browser: http://localhost:2508
echo Login: dpsadmin / Temple@123
echo.
echo Press Ctrl+C to stop both services.
pause

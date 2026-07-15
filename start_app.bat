@echo off
echo ========================================
echo  Anegudde Inventory System - Starting
echo ========================================

echo.
echo [1/2] Starting Backend...
start "Backend" cmd /k "cd /d D:\anegudde2.0\backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 2509 --reload"

echo [2/2] Starting Frontend...
start "Frontend" cmd /k "cd /d D:\anegudde2.0\frontend && npm run dev -- --host 0.0.0.0 --port 2508"

echo.
echo Both started! Open browser: http://localhost:2508
echo Login: dpsadmin / Temple@123
echo.
pause

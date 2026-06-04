@echo off
chcp 65001 > nul
title Drone Guard - Dev Environment

echo ============================================================
echo   Drone Guard Edge - Development Environment
echo ============================================================
echo.

REM Kill any process already using the ports
echo [1/3] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8765 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak > nul

REM ── Python WebSocket server ─────────────────────────────────
echo [2/3] Starting Python WebSocket server (port 8765)...
start "DroneGuard-Server" cmd /k "chcp 65001 > nul && cd /d %~dp0server && python -m uvicorn server:app --host 0.0.0.0 --port 8765"
timeout /t 3 /nobreak > nul

REM ── React frontend ──────────────────────────────────────────
echo [3/3] Starting React dev server (port 3000)...
start "DroneGuard-React" cmd /k "chcp 65001 > nul && cd /d %~dp0 && npm start"
timeout /t 5 /nobreak > nul

echo.
echo ============================================================
echo   All services started!
echo.
echo   Frontend  : http://localhost:3000
echo   Backend   : ws://localhost:8765
echo   Health    : http://localhost:8765/health
echo ============================================================
echo.
echo Press any key to also start the NPU simulator (mock data)...
echo (Skip this if you have a real NPU device connected)
pause > nul

start "DroneGuard-MockNPU" cmd /k "chcp 65001 > nul && cd /d %~dp0server && python mock_npu.py --fps 10 --drones 2"

echo.
echo Mock NPU simulator started.
echo Close the individual terminal windows to stop each service.
echo.
pause

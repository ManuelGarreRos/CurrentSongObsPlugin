@echo off
title Current Video OBS - WebSocket Server
color 0A

cd /d "%~dp0"

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo.
echo ========================================
echo   Current Video OBS - Server Starting
echo ========================================
echo.
echo Starting WebSocket server in background...
echo.

start /B node websocket-server.js

echo Server is running in the background!
echo.
echo To stop the server:
echo 1. Open Task Manager (Ctrl+Shift+Esc)
echo 2. Find "Node.js: Server-side JavaScript"
echo 3. Right-click and End Task
echo.
echo Or run: stop-server.bat
echo.
timeout /t 3 /nobreak >nul

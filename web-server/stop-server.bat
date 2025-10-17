@echo off
title Stop Current Video OBS Server
color 0C

echo.
echo ========================================
echo   Stopping Current Video OBS Server
echo ========================================
echo.

taskkill /F /IM node.exe /FI "WINDOWTITLE eq websocket-server.js" 2>nul

if %errorlevel% equ 0 (
    echo Server stopped successfully!
) else (
    echo No server found running, or already stopped.
)

echo.
pause

@echo off
title Stop Current Video OBS Server
color 0C

echo.
echo ========================================
echo   Stopping Current Video OBS Server
echo ========================================
echo.

echo Looking for running server...
netstat -ano | findstr :8080 > temp_pid.txt
for /f "tokens=5" %%a in (temp_pid.txt) do set PID=%%a
del temp_pid.txt
if defined PID (
    echo Found server process with PID %PID%. Stopping it...
    taskkill /PID %PID% /F >nul 2>&1
) else (
    echo No server process found on port 8080.
    set errorlevel=1
)

if %errorlevel% equ 0 (
    echo Server stopped successfully!
) else (
    echo No server found running, or already stopped.
)

echo.
pause

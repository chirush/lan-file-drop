@echo off
title LAN File Drop
echo.
echo   Starting LAN File Drop...
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo   Installing dependencies...
    npm install
    echo.
)

:: Start server and open browser
start http://localhost:3000
node server.js
pause

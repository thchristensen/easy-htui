@echo off
title Easy HTUI
cd /d "%~dp0"

REM ================================================================
REM  EASY HTUI - ONE-CLICK LAUNCHER
REM  This is the ONLY file you need to double-click!
REM  Handles: Setup, Migration, Server Start, Browser Launch, Cleanup
REM ================================================================

echo.
echo  =============================================
echo  Easy HTUI - One-Click Launcher
echo  =============================================
echo.

REM Auto-setup: Create directories
if not exist "config" mkdir config & if not exist "config\backups" mkdir config\backups
if not exist "assets" mkdir assets & if not exist "assets\images" mkdir assets\images & if not exist "assets\icons" mkdir assets\icons
if not exist "logs" mkdir logs

REM Auto-migrate: Move old files
if exist "config.json" move "config.json" "config\config.json" >nul 2>&1 & echo ✓ Migrated config.json
if exist "images" xcopy "images\*" "assets\images\" /E /Y >nul 2>&1 & rmdir "images" /S /Q >nul 2>&1 & echo ✓ Migrated images folder

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found! Please install from: https://nodejs.org/
    echo    Then restart your computer and run this again.
    pause & exit /b 1
)

REM Auto-install dependencies
if not exist "node_modules" (
    echo First-time setup: Installing dependencies...
    npm install --silent
    if errorlevel 1 (
        echo Setup failed! Try running as Administrator.
        pause & exit /b 1
    )
    echo Setup complete!
)

echo Starting Easy HTUI...

REM Start server
start /b node server.js

REM Wait for server (simplified check)
timeout /t 3 /nobreak >nul
echo Server running at http://localhost:3000

REM Launch browser
echo Opening browser...
start chrome --kiosk --disable-web-security --allow-running-insecure-content --disable-features=TranslateUI --disable-extensions-except="" --app=http://localhost:3000

echo.
echo  =============================================
echo  Easy HTUI IS LIVE!
echo  =============================================
echo.
echo  Controls:  Enter Launch  -  Ctrl+A Admin  -  Type Search
echo  Exit:      Alt+F4 (fullscreen) or press any key here to quit
echo.
echo  =============================================
echo.

REM Wait for user to exit
pause >nul

REM Cleanup
echo.
echo Shutting down...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im chrome.exe >nul 2>&1
echo Clean shutdown complete. Goodbye!
timeout /t 1 /nobreak >nul
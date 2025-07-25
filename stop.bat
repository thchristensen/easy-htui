@echo off
REM ================================================================
REM  EMERGENCY STOP - Only use if launcher.bat didn't shut down properly
REM  Normal usage: Just press any key in the launcher.bat window
REM ================================================================

title Easy HTUI - Emergency Stop
echo 🛑 Emergency shutdown...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im chrome.exe >nul 2>&1
echo ✅ All processes stopped.
timeout /t 2 /nobreak >nul
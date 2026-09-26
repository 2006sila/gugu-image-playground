@echo off
title Nova Image Studio - Install
cd /d "%~dp0"

echo ============================================
echo   Nova Image Studio - First Time Setup
echo ============================================
echo.
echo This will install dependencies and build the app.
echo It may take 2-3 minutes. Press any key to continue...
pause >nul

echo.
echo [1/2] Installing dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: npm install failed. Check your Node.js installation.
  pause
  exit /b 1
)

echo.
echo [2/2] Building frontend...
call npm run build
if errorlevel 1 (
  echo.
  echo ERROR: build failed.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Setup complete!
echo   Now double-click START.bat
echo ============================================
pause

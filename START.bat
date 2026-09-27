@echo off
title Nova Image Studio Launcher
cd /d "%~dp0"

echo ============================================
echo   Nova Image Studio Launcher
echo ============================================
echo.
echo   [1] Start dev mode (browser connects to API)
echo   [2] Reinstall dependencies
echo   [3] Exit
echo.
set /p choice=Select (1/2/3):

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto install
if "%choice%"=="3" exit /b
goto dev

:install
echo.
echo Installing dependencies...
call npm install
echo Done.
pause
goto :eof

:dev
echo.
if not exist "node_modules" (
  echo First run - installing dependencies...
  call npm install
)
echo.
echo Starting dev server at http://localhost:5173
echo Close this window to stop.
start "" http://localhost:5173
call npx vite --port 5173
goto :eof

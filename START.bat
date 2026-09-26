@echo off
title Nova Image Studio Launcher
cd /d "%~dp0"

echo ============================================
echo   Nova Image Studio Launcher
echo ============================================
echo.
echo   [1] Dev mode (browser connects to API)
echo   [2] Server mode (task queue, :8787)
echo   [3] Reinstall dependencies
echo   [4] Exit
echo.
set /p choice=Select (1/2/3/4):

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto server
if "%choice%"=="3" goto install
if "%choice%"=="4" exit /b
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

:server
echo.
if not exist "node_modules" (
  echo First run - installing dependencies...
  call npm install
)
if not exist "dist" (
  echo First run - building frontend...
  call npm run build
)
echo.
echo Starting server mode at http://localhost:8787
echo Close this window to stop.
start "" http://localhost:8787
node server\server.js
goto :eof

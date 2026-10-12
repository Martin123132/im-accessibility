@echo off
setlocal
set "ROOT=%~dp0"
powershell.exe -NoProfile -Command "try { if ((Invoke-RestMethod -Uri 'http://127.0.0.1:43191/health' -TimeoutSec 2).ok) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  start "PC Bridge Codex Desk" /min /d "%ROOT%" cmd.exe /c node desk.cjs
  timeout /t 3 /nobreak >nul
)
start "" "http://127.0.0.1:43191/"
exit /b 0
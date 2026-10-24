@echo off
setlocal
cd /d "%~dp0"
if not defined IM_ACCESSIBILITY_CONFIG_PATH (
  echo IM_ACCESSIBILITY_CONFIG_PATH must point to your private settings.json first.
  exit /b 2
)
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js is required on PATH.
  exit /b 2
)
node.exe "%~dp0release-config.cjs" >nul
if errorlevel 1 (
  echo Release settings validation failed. No TV session action taken.
  exit /b 2
)
node.exe "%~dp0resume.cjs" stop
exit /b %errorlevel%

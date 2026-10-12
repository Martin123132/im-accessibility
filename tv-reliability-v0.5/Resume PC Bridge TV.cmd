@echo off
setlocal
cd /d "D:\PC-Bridge-Public-Demo\tv-reliability-v0.5"
"C:\Program Files\nodejs\node.exe" "resume.cjs" resume
if errorlevel 1 echo PC Bridge did not complete resume. See runtime\state.json and runtime\host logs.
echo.
echo You can close this window. PC Bridge TV runs independently.
pause

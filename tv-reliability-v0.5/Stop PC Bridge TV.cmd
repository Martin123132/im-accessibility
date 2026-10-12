@echo off
setlocal
cd /d "D:\PC-Bridge-Public-Demo\tv-reliability-v0.5"
"C:\Program Files\nodejs\node.exe" "resume.cjs" stop
if errorlevel 1 echo PC Bridge could not request stop. Check current task state.
pause

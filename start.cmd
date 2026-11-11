@echo off
setlocal
cd /d "%~dp0"
node server.js
if errorlevel 1 pause
endlocal

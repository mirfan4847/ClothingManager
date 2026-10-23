@echo off
echo Starting Clothing Manager Frontend...
echo Frontend will run on: http://localhost:5173
echo.
cd /d "%~dp0Frontend"
npm run dev
pause

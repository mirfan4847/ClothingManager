@echo off
echo Starting Clothing Manager Backend on http://localhost:5001
echo Swagger: http://localhost:5001/swagger
echo.
cd /d "%~dp0Backend"
set ASPNETCORE_URLS=http://localhost:5001
set ASPNETCORE_ENVIRONMENT=Development
dotnet run
pause

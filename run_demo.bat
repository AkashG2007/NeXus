@echo off
title CVCC Launcher
echo ========================================================
echo   Launching CVCC Eco-Digital Twin Simulator & Dashboard
echo ========================================================
cd /d "%~dp0"

echo [1/2] Starting Backend Server (Port 8000)...
start "CVCC Backend" cmd /k "cd /d ""%~dp0backend"" && .\venv\Scripts\activate && uvicorn main:app --reload --port 8000"

echo [2/2] Starting Frontend Dashboard (Port 3000)...
start "CVCC Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo ========================================================
echo  All systems started! 
echo  Open your browser to: http://localhost:3000
echo ========================================================

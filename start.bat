@echo off
echo Killing existing processes...
taskkill /F /IM python.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 >nul

echo Starting backend...
start "Backend" cmd /k "cd /d %~dp0backend && uv run uvicorn main:app --port 8000 --reload"

timeout /t 3 >nul

echo Starting agent...
start "Agent" cmd /k "cd /d %~dp0backend && uv run python agent.py start"

echo Starting frontend...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo All services started.

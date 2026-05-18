# Kill existing processes
Write-Host "Killing existing processes..."
Stop-Process -Name python -Force -ErrorAction SilentlyContinue
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$root = $PSScriptRoot
$backend = "$root\backend"
$frontend = "$root\frontend"

Write-Host "Starting all services in Windows Terminal..."
$uv = "$env:USERPROFILE\.local\bin\uv.exe"
wt --title "Backend" pwsh -NoExit -Command "Set-Location '$backend'; & '$uv' run uvicorn main:app --port 8000 --reload" `; new-tab --title "Agent" pwsh -NoExit -Command "Set-Location '$backend'; & '$uv' run python agent.py start" `; new-tab --title "Frontend" pwsh -NoExit -Command "Set-Location '$frontend'; npm run dev"

Write-Host "All services started."

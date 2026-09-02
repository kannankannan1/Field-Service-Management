@echo off
REM Quick setup script for deployment

echo ========================================
echo  Keystone FSM - Deployment Setup
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "api\index.js" (
    echo Error: Please run this script from the project root directory
    echo Expected to find api\index.js
    pause
    exit /b 1
)

echo [1/3] Installing backend dependencies...
cd api
call npm install
cd ..

echo.
echo [2/3] Installing frontend dependencies...
cd frontend
call npm install
cd ..

echo.
echo [3/3] Generating JWT secrets...
echo.
echo Access Token Secret:
powershell -Command "-join ((1..64) | ForEach-Object { '{0:x2}' -f (Get-Random -Minimum 0 -Maximum 255) })"
echo.
echo Refresh Token Secret:
powershell -Command "-join ((1..64) | ForEach-Object { '{0:x2}' -f (Get-Random -Minimum 0 -Maximum 255) })"
echo.

echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Deploy backend to Railway (see DEPLOY.md)
echo 2. Deploy frontend to Vercel (see DEPLOY.md)
echo 3. Set environment variables as described in DEPLOY.md
echo.
echo For detailed instructions, see DEPLOY.md
echo.
pause

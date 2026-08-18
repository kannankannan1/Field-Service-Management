@echo off
setlocal
title Keystone - Start Site
set "ROOT=%~dp0"
set "JAVA=C:\Users\kanna\AppData\Local\Programs\Eclipse Adoptium\jdk-25.0.3.9-hotspot\bin\java.exe"

echo [1/2] Checking backend on port 8080...
netstat -an | findstr /R ":8080.*LISTENING" >nul
if %errorlevel%==0 (
  echo      Backend already running.
) else (
  echo      Starting backend in its own window (uses in-memory H2, no database needed)...
  start "Keystone Backend" cmd /k "call ""%ROOT%start-backend.cmd"""
)

echo [2/2] Checking frontend on port 5174...
netstat -an | findstr /R ":5174.*LISTENING" >nul
if %errorlevel%==0 (
  echo      Frontend already running.
) else (
  echo      Starting frontend in its own window...
  start "Keystone Frontend" cmd /k "call ""%ROOT%run-vite.cmd"""
)

echo.
echo Opening browser at http://localhost:5174  (login: manager1 / Manager@123)
start "" http://localhost:5174
echo Done. Keep the two console windows open.
timeout /t 8 >nul

@echo off
setlocal
title Keystone - Stop Everything
echo Stopping backend (port 8080)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R ":8080.*LISTENING"') do taskkill /F /PID %%p >nul 2>&1
echo Stopping frontend (port 5174)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R ":5174.*LISTENING"') do taskkill /F /PID %%p >nul 2>&1
echo Done. Ports 8080 and 5174 are free.

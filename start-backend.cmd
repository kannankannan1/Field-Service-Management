@echo off
setlocal
title Keystone Backend
set "JAVA_HOME=C:\Users\kanna\AppData\Local\Programs\Eclipse Adoptium\jdk-25.0.3.9-hotspot"
netstat -ano | findstr /R ":8080.*LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo  [ERROR] Port 8080 is already in use - another backend instance is running.
  echo          Use stop-all.cmd first, then run this again.
  echo.
  pause
  exit /b 1
)
echo Starting Keystone backend on port 8080 (in-memory H2, no database needed)...
"%JAVA_HOME%\bin\java.exe" -jar "C:\Users\kanna\Desktop\Fieldservice Management\backend\target\fieldservice-1.0.0.jar"

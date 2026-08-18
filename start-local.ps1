$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PGBin = "C:\Program Files\PostgreSQL\17\bin"
$PGData = Join-Path $env:TEMP "opencode\pgfsm"
$JavaHome = "C:\Users\kanna\AppData\Local\Programs\Eclipse Adoptium\jdk-25.0.3.9-hotspot"
$JavaExe = Join-Path $JavaHome "bin\java.exe"
$Jar = Join-Path $Root "backend\target\fieldservice-1.0.0.jar"
$BackendLog = Join-Path $env:TEMP "opencode\backend.log"

function Is-Listening([int]$port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# 1. Throwaway Postgres on 5433 (only if not already running)
if (-not (Is-Listening 5433)) {
  if (-not (Test-Path (Join-Path $PGData "PG_VERSION"))) {
    & (Join-Path $PGBin "initdb.exe") -D $PGData -U keystone --auth=trust -E UTF8 | Out-Null
  }
  Start-Process -FilePath (Join-Path $PGBin "postgres.exe") -ArgumentList @("-D", $PGData, "-p", "5433", "-h", "127.0.0.1") -WindowStyle Hidden
  Start-Sleep -Seconds 3
  Write-Host "[1/3] Postgres started on 5433" -ForegroundColor Green
} else {
  Write-Host "[1/3] Postgres already running on 5433" -ForegroundColor DarkGray
}

# 2. Backend on 8080
if (-not (Is-Listening 8080)) {
  $env:DB_URL = "jdbc:postgresql://localhost:5433/keystone"
  $env:DB_USERNAME = "keystone"
  $env:DB_PASSWORD = "x"
  Start-Process -FilePath $JavaExe -ArgumentList @("-jar", $Jar) -WindowStyle Hidden
  Write-Host "[2/3] Backend starting on http://localhost:8080 (first boot runs Flyway, give it ~25s)" -ForegroundColor Green
} else {
  Write-Host "[2/3] Backend already running on 8080" -ForegroundColor DarkGray
}

# 3. Frontend on 5174
if (-not (Is-Listening 5174)) {
  Start-Process -FilePath "node" -ArgumentList @("node_modules\vite\bin\vite.js") -WorkingDirectory (Join-Path $Root "frontend") -WindowStyle Hidden
  Write-Host "[3/3] Frontend starting on http://localhost:5174" -ForegroundColor Green
} else {
  Write-Host "[3/3] Frontend already running on 5174" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Open http://localhost:5174  ->  login: manager1 / Manager@123" -ForegroundColor Cyan
Write-Host "API docs: http://localhost:8080/swagger-ui.html" -ForegroundColor DarkGray

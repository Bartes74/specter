@echo off
REM Spec Generator -- skrypt uruchomieniowy (Windows)
REM Wymaga: Node.js >= 20, npm >= 10
REM Uzycie:  start.bat

setlocal EnableDelayedExpansion

set "APP_NAME=Spec Generator"
set "APP_URL=http://localhost:3000"
set "HEALTH_URL=%APP_URL%/api/health"
set "PREFS_DIR=%USERPROFILE%\.spec-generator"
set "PID_FILE=%PREFS_DIR%\.spec-generator.pid"
set "LOG_FILE=%PREFS_DIR%\server.log"
set "INSTALL_STAMP=node_modules\.install-stamp"
set "BUILD_STAMP=.next\BUILD_ID"
set "REQUIRED_NODE_MAJOR=20"
set "HEALTH_TIMEOUT_SECONDS=30"

cd /d "%~dp0"

if not exist "%PREFS_DIR%" mkdir "%PREFS_DIR%"

echo.
echo   %APP_NAME% -- uruchamianie...
echo.
echo   Sprawdzam wymagania srodowiska...

REM ---------- 1. Sprawdz Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   X Wystapil blad podczas uruchamiania %APP_NAME%
  echo.
  echo     Co sie stalo:
  echo       Nie znaleziono Node.js na tym komputerze.
  echo.
  echo     Co to oznacza:
  echo       Aplikacja nie zostanie uruchomiona, dopoki nie zainstalujesz Node.js.
  echo.
  echo     Jak to naprawic:
  echo       1. Otworz https://nodejs.org/pl/download
  echo       2. Pobierz wersje LTS
  echo       3. Uruchom instalator
  echo       4. Po zakonczeniu uruchom ponownie start.bat
  echo.
  exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set "NODE_VERSION_RAW=%%v"
set "NODE_NUM=!NODE_VERSION_RAW:v=!"
for /f "tokens=1 delims=." %%m in ("!NODE_NUM!") do set "NODE_MAJOR=%%m"

if !NODE_MAJOR! LSS %REQUIRED_NODE_MAJOR% (
  echo.
  echo   X Wystapil blad podczas uruchamiania %APP_NAME%
  echo.
  echo     Co sie stalo:
  echo       Wersja Node.js to !NODE_VERSION_RAW!, a wymagana jest co najmniej %REQUIRED_NODE_MAJOR%.
  echo.
  echo     Jak to naprawic:
  echo       1. Otworz https://nodejs.org/pl/download
  echo       2. Pobierz najnowsza wersje LTS
  echo       3. Zainstaluj ja
  echo       4. Uruchom ponownie start.bat
  echo.
  exit /b 1
)
echo   v Node.js !NODE_VERSION_RAW!

REM ---------- 2. Sprawdz czy aplikacja juz dziala ----------
if exist "%PID_FILE%" (
  set /p EXISTING_PID=<"%PID_FILE%"
  if defined EXISTING_PID (
    tasklist /FI "PID eq !EXISTING_PID!" 2>nul | findstr /R "^.*  *!EXISTING_PID! " >nul
    if not errorlevel 1 (
      echo   v Aplikacja juz dziala (PID !EXISTING_PID!). Otwieram przegladarke...
      start "" "%APP_URL%"
      echo.
      echo     Aby zatrzymac aplikacje uruchom: stop.bat
      exit /b 0
    ) else (
      del "%PID_FILE%"
    )
  )
)

REM ---------- 3. Instalacja zaleznosci ----------
set "NEEDS_INSTALL=0"
if not exist "node_modules" set "NEEDS_INSTALL=1"
if exist "package-lock.json" if not exist "%INSTALL_STAMP%" set "NEEDS_INSTALL=1"

if "!NEEDS_INSTALL!"=="1" (
  echo   Instaluje zaleznosci... ^(to moze potrwac 1-3 minuty^)
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   X Wystapil blad podczas uruchamiania %APP_NAME%
    echo.
    echo     Co sie stalo:
    echo       Instalacja zaleznosci ^(npm install^) nie powiodla sie.
    echo.
    echo     Jak to naprawic:
    echo       1. Sprawdz polaczenie z internetem
    echo       2. Uruchom recznie: npm install
    echo       3. Sprawdz log: %LOG_FILE%
    echo.
    exit /b 1
  )
  if not exist "node_modules" mkdir "node_modules"
  echo.>"%INSTALL_STAMP%"
  echo   v Zaleznosci zainstalowane
) else (
  echo   v Zaleznosci sa aktualne
)

REM ---------- 4. Build produkcyjny ----------
set "NEEDS_BUILD=0"
powershell -NoProfile -Command ^
  "$build='%BUILD_STAMP%'; if (!(Test-Path $build)) { exit 0 }; $stamp=(Get-Item $build).LastWriteTimeUtc; $paths=@('src','messages','content','public','package.json','package-lock.json','next.config.js','next.config.mjs','next.config.ts','tailwind.config.ts','tsconfig.json'); foreach($p in $paths){ if(Test-Path $p){ $newer=Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTimeUtc -gt $stamp } | Select-Object -First 1; if($newer){ exit 0 } } }; exit 1"
if not errorlevel 1 set "NEEDS_BUILD=1"

if "%NEEDS_BUILD%"=="1" (
  echo   Buduje aplikacje... ^(zrodla zmienily sie od ostatniego uruchomienia^)
  call npm run build
  if errorlevel 1 (
    echo.
    echo   X Budowanie aplikacji ^(npm run build^) nie powiodlo sie.
    echo     Uruchom recznie: npm run type-check
    echo     Po naprawieniu uruchom start.bat ponownie.
    echo.
    exit /b 1
  )
  echo   v Build jest aktualny
) else (
  echo   v Build jest aktualny
)

REM ---------- 5. Uruchom serwer ----------
echo   Uruchamiam aplikacje w tle...
type nul > "%LOG_FILE%"

REM Uruchamiamy npm start jako oddzielny proces, przechwytujac jego PID przez powershell
for /f %%P in ('powershell -NoProfile -Command ^
  "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm start >> \"%LOG_FILE%\" 2>&1' -WindowStyle Hidden -PassThru; $p.Id"') do set "SERVER_PID=%%P"

echo !SERVER_PID! > "%PID_FILE%"

REM ---------- 6. Czekaj na health check ----------
echo   Czekam az aplikacja bedzie gotowa...
set /a WAITED=0
:health_loop
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri '%HEALTH_URL%'; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not errorlevel 1 (
  echo   v Aplikacja jest gotowa ^(PID !SERVER_PID!^)
  goto :open_browser
)

tasklist /FI "PID eq !SERVER_PID!" 2>nul | findstr /R "^.*  *!SERVER_PID! " >nul
if errorlevel 1 (
  echo.
  echo   X Proces serwera zakonczyl sie przed osiagnieciem stanu gotowosci.
  echo     Sprawdz log: %LOG_FILE%
  del "%PID_FILE%" 2>nul
  exit /b 1
)

set /a WAITED+=1
if !WAITED! GEQ %HEALTH_TIMEOUT_SECONDS% (
  echo.
  echo   X Aplikacja nie odpowiedziala w ciagu %HEALTH_TIMEOUT_SECONDS% sekund.
  echo     Sprawdz log: %LOG_FILE%
  echo     Uruchom stop.bat i sprobuj ponownie.
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto :health_loop

:open_browser
echo   Otwieram przegladarke...
start "" "%APP_URL%"

echo.
echo   v %APP_NAME% dziala pod adresem %APP_URL%
echo     Aby zatrzymac aplikacje uruchom: stop.bat
echo     Log serwera: %LOG_FILE%
echo.
endlocal
exit /b 0

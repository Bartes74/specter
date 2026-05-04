@echo off
REM Spec Generator -- skrypt zamykajacy (Windows)
REM Uzycie:  stop.bat

setlocal EnableDelayedExpansion

set "APP_NAME=Spec Generator"
set "PREFS_DIR=%USERPROFILE%\.spec-generator"
set "PID_FILE=%PREFS_DIR%\.spec-generator.pid"
set "GRACE_SECONDS=5"

echo.
echo   %APP_NAME% -- zatrzymywanie...
echo.

if not exist "%PID_FILE%" (
  echo   v Aplikacja nie byla uruchomiona ^(brak pliku PID^).
  echo.
  exit /b 0
)

set /p PID=<"%PID_FILE%"
if not defined PID (
  del "%PID_FILE%"
  echo   v Plik PID byl pusty -- usunieto.
  echo.
  exit /b 0
)

tasklist /FI "PID eq !PID!" 2>nul | findstr /R "^.*  *!PID! " >nul
if errorlevel 1 (
  echo   v Proces !PID! juz nie dziala. Czyszcze plik PID.
  del "%PID_FILE%"
  echo.
  exit /b 0
)

echo   Zatrzymuje proces !PID!...
taskkill /PID !PID! /T >nul 2>nul

set /a WAITED=0
:wait_loop
tasklist /FI "PID eq !PID!" 2>nul | findstr /R "^.*  *!PID! " >nul
if errorlevel 1 goto :killed
set /a WAITED+=1
if !WAITED! GEQ %GRACE_SECONDS% goto :force_kill
timeout /t 1 /nobreak >nul
goto :wait_loop

:force_kill
echo   X Proces nie zakonczyl sie w ciagu %GRACE_SECONDS%s -- wymuszam zamkniecie...
taskkill /PID !PID! /F /T >nul 2>nul

:killed
del "%PID_FILE%" 2>nul
echo   v %APP_NAME% zostal zatrzymany.
echo.
endlocal
exit /b 0

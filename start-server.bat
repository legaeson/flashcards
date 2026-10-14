@echo off
cd /d "%~dp0"
echo ========================================
echo   FlashCards - Локальный Сервер
echo ========================================
echo.
echo Запускаем сервер...
echo.

REM Проверяем Python (пробуем py, затем python)
py --version >nul 2>&1
if %errorlevel% equ 0 (
    set PY=py -3
) else (
    python --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ОШИБКА: Python не установлен!
        echo.
        echo Пожалуйста, установите Python с https://www.python.org/downloads/
        echo или используйте онлайн хостинг (Netlify Drop)
        echo.
        pause
        exit /b 1
    )
    set PY=python
)

REM Получаем IP адрес (пропускаем виртуальные/WSL/VPN адаптеры, исключаем 127.x)
set IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127."') do (
    set _line=%%a
    setlocal enabledelayedexpansion
    set _check=!_line!
    echo !_check! | findstr /i "192\.168\. 10\. 172\." >nul
    if !errorlevel! equ 0 (
        endlocal & set IP=%%a & goto :found
    )
    endlocal
)
REM Fallback: первый не-loopback IPv4
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%
if "%IP%"=="" set IP=localhost

echo Сервер запущен в папке: %CD%
echo.
echo ========================================
echo Откройте на iPhone в Safari:
echo.
echo     http://%IP%:8000
echo.
echo ========================================
echo.
echo Для остановки нажмите Ctrl+C
echo.

%PY% -m http.server 8000

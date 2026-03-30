@echo off
echo ========================================
echo   FlashCards - Локальный Сервер
echo ========================================
echo.
echo Запускаем сервер...
echo.

REM Проверяем Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ОШИБКА: Python не установлен!
    echo.
    echo Пожалуйста, установите Python с https://www.python.org/downloads/
    echo или используйте онлайн хостинг (Netlify Drop)
    echo.
    pause
    exit /b
)

REM Получаем IP адрес
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo ✅ Сервер запущен!
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

python -m http.server 8000

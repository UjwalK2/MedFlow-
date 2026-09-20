@echo off
setlocal enabledelayedexpansion

chcp 65001 >nul
title MedFlow Platform Launcher

echo ======================================================================
echo                     MEDFLOW PLATFORM LAUNCHER                         
echo ======================================================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

:: -------------------------------------------------------------------------
:: 1. Check & Detect Python
:: -------------------------------------------------------------------------
echo [1/4] Checking Python environment...

set "PY_CMD="
where py >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "PY_CMD=py -3"
) else (
    where python >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        set "PY_CMD=python"
    ) else (
        where python3 >nul 2>&1
        if %ERRORLEVEL% equ 0 (
            set "PY_CMD=python3"
        )
    )
)

if "%PY_CMD%"=="" (
    echo [ERROR] Python was not found in PATH!
    echo Please install Python 3.10+ from https://www.python.org/ or the Microsoft Store.
    echo Ensure "Add Python to PATH" is checked during installation.
    pause
    exit /b 1
)

echo   Found Python command: %PY_CMD%

:: -------------------------------------------------------------------------
:: 2. Setup / Validate Backend Virtual Environment
:: -------------------------------------------------------------------------
echo [2/4] Setting up Backend Virtual Environment...

cd /d "%BACKEND_DIR%"
set "VENV_DIR=%BACKEND_DIR%\.venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"

set "VENV_VALID=0"
if exist "%VENV_PY%" (
    "%VENV_PY%" -c "import fastapi, uvicorn" >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        set "VENV_VALID=1"
    )
)

if "!VENV_VALID!"=="0" (
    echo   Creating fresh virtual environment in backend\.venv...
    if exist "%VENV_DIR%" (
        rmdir /s /q "%VENV_DIR%" >nul 2>&1
    )
    %PY_CMD% -m venv "%VENV_DIR%"
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo   Installing backend dependencies...
    "%VENV_PY%" -m pip install --upgrade pip >nul 2>&1
    "%VENV_PY%" -m pip install -r "%BACKEND_DIR%\requirements.txt"
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Failed to install backend requirements.
        pause
        exit /b 1
    )
    echo   Backend dependencies installed successfully.
) else (
    echo   Virtual environment is ready and verified.
)

:: -------------------------------------------------------------------------
:: 3. Check & Prepare Frontend (Node.js & npm)
:: -------------------------------------------------------------------------
echo [3/4] Checking Node.js and Frontend dependencies...

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js / npm was not found in PATH!
    echo Please install Node.js (LTS recommended) from https://nodejs.org/
    pause
    exit /b 1
)

cd /d "%FRONTEND_DIR%"
if not exist "%FRONTEND_DIR%\node_modules\recharts" (
    echo   Installing frontend npm packages (including recharts)...
    call npm install
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
) else (
    echo   Frontend dependencies are already installed.
)

:: -------------------------------------------------------------------------
:: 4. Launch Backend and Frontend
:: -------------------------------------------------------------------------
echo [4/4] Starting Services...
echo.

echo   - Launching FastAPI Backend on http://127.0.0.1:8000
start "MedFlow Backend (FastAPI)" cmd /c "cd /d "%BACKEND_DIR%" && "%VENV_PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo   - Waiting for Backend to be ready on port 8000...
set "BACKEND_READY=0"
for /l %%i in (1,1,30) do (
    curl -s http://127.0.0.1:8000/health >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        set "BACKEND_READY=1"
        goto :backend_up
    )
    timeout /t 1 /nobreak >nul
)

:backend_up
if "!BACKEND_READY!"=="1" (
    echo   - Backend is UP and Healthy!
) else (
    echo   [WARNING] Backend startup took longer than expected, proceeding with frontend...
)

echo.
echo ======================================================================
echo  MedFlow is running!
echo  Backend:  http://127.0.0.1:8000
echo  Frontend: http://localhost:5173
echo  Press Ctrl+C or close this window to stop the frontend server.
echo ======================================================================
echo.

:: Automatically launch default browser to the frontend
start http://localhost:5173

cd /d "%FRONTEND_DIR%"
call npm run dev

:: Clean up child processes when frontend stops
taskkill /fi "WINDOWTITLE eq MedFlow Backend (FastAPI)*" /f >nul 2>&1

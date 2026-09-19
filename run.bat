@echo off
setlocal

REM Resolve project root directory (ends with a backslash)
set "ROOT_DIR=%~dp0"

echo Starting MedFlow backend on port 8000...
if exist "%ROOT_DIR%backend\.venv\Scripts\activate.bat" (
    start "MedFlow Backend" /D "%ROOT_DIR%backend" cmd /k "call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
) else (
    start "MedFlow Backend" /D "%ROOT_DIR%backend" cmd /k "uvicorn app.main:app --reload --port 8000"
)

if exist "%ROOT_DIR%frontend\package.json" (
    echo Starting MedFlow frontend on port 5173...
    start "MedFlow Frontend" /D "%ROOT_DIR%frontend" cmd /k "npm run dev"
) else (
    echo Frontend project not initialized yet. Skipping frontend startup.
)

echo.
echo MedFlow services launched in separate windows. Close those windows (or press Ctrl+C in them) to shut down.
endlocal
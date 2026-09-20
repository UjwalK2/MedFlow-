#!/usr/bin/env bash

set -e

# Resolve project root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Clean up child processes on exit or interrupt
cleanup() {
  echo ""
  echo "Shutting down MedFlow services..."
  kill $(jobs -p) 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

echo "=================================================="
echo " Starting MedFlow Platform (Full Stack) "
echo "=================================================="

# Check and prepare backend environment
cd "$ROOT_DIR/backend"

PYTHON_CMD=""
if [ -x ".venv/bin/python" ] && .venv/bin/python -c "import fastapi, uvicorn" 2>/dev/null; then
  PYTHON_CMD=".venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  echo "Setting up Python virtual environment in backend/.venv..."
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt
  PYTHON_CMD=".venv/bin/python"
elif command -v python >/dev/null 2>&1; then
  echo "Setting up Python virtual environment in backend/.venv..."
  python -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt
  PYTHON_CMD=".venv/bin/python"
else
  echo "Error: Python 3 is required to run the backend."
  exit 1
fi

echo "Starting MedFlow backend on http://127.0.0.1:8000..."
"$PYTHON_CMD" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend service to become available..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "Backend is healthy and listening on http://127.0.0.1:8000"
    break
  fi
  sleep 0.5
done

# Check frontend
if [ -f "$ROOT_DIR/frontend/package.json" ]; then
  cd "$ROOT_DIR/frontend"
  if [ ! -d "node_modules" ] || [ ! -d "node_modules/recharts" ]; then
    echo "Installing frontend dependencies (including recharts)..."
    npm install
  fi
  echo "Starting MedFlow frontend on http://localhost:5173..."
  npm run dev &
else
  echo "Frontend project not initialized yet. Skipping frontend startup."
fi

echo "MedFlow services started. Press Ctrl+C to stop."
wait

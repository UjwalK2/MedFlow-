#!/usr/bin/env bash

# Resolve project root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Clean up child processes on exit or interrupt
cleanup() {
  echo "Shutting down MedFlow services..."
  kill $(jobs -p) 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

echo "Starting MedFlow backend on port 8000..."
(
  cd "$ROOT_DIR/backend"
  if [ -d ".venv" ]; then
    source .venv/bin/activate
  fi
  uvicorn app.main:app --reload --port 8000
) &

if [ -f "$ROOT_DIR/frontend/package.json" ]; then
  echo "Starting MedFlow frontend on port 5173..."
  (
    cd "$ROOT_DIR/frontend"
    npm run dev
  ) &
else
  echo "Frontend project not initialized yet. Skipping frontend startup."
fi

wait

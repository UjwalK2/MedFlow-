"""
Vercel serverless entrypoint for the MedFlow FastAPI backend.

Vercel's Python runtime looks for a module-level `app` (ASGI) object in any
file under /api. We import the real FastAPI app from backend/app/main.py by
putting backend/ on sys.path first (that's the directory uvicorn normally
runs from, and it's what the app's internal `from app.xxx import ...`
imports expect).
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BACKEND_DIR = os.path.join(_ROOT, "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.main import app  # noqa: E402
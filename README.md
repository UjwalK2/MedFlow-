# MedFlow

[![FastAPI](https://img.shields.io/badge/FastAPI-0.141+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2+-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4+-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini-3.5_Flash-4285F4.svg?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)

**MedFlow** is an intelligent hospital operations and clinical triage simulation platform. It blends discrete-event simulation of Emergency Department (ED) workflows with AI-assisted clinical acuity scoring powered by Google Gemini, allowing healthcare administrators, researchers, and clinicians to stress-test patient scheduling policies, resource constraints, and surge scenarios.

---

## Key Features

- **Clinical ESI Triage Engine**:
  - Implements standard 5-level **Emergency Severity Index (ESI)** logic (Levels 1 to 5).
  - Evaluates unstructured clinical nurse intake notes using Google Gemini (`gemini-3.5-flash`).
  - Seamless, automatic offline fallback to a rule-based clinical keyword scoring engine when no API key is provided.
  - Detects clinical red flags, estimates required hospital resources, predicts treatment duration, and quantifies deterioration risk.
  - Supports single-note evaluation and batch ingestion (up to 25 notes).

- **Discrete-Event ED Simulation**:
  - Per-minute discrete-event simulation tracking admissions, waiting rooms, resource allocation, and patient discharge.
  - Dynamic patient deterioration and reneging modeling (patients leaving without being seen if wait times exceed tolerance).
  - Models core hospital resources: Attending Physicians, Triage Nurses, ER Treatment Beds, ICU Beds, CT Scanners, and Operating Rooms.

- **Intelligent Patient Scheduling Policies**:
  - **First-Come, First-Served (FCFS)**: Baseline chronological order.
  - **Strict Clinical Urgency**: Priority driven strictly by acuity (ESI 1 through 5).
  - **Dynamic Weighted Aging**: Non-linear multi-objective optimization balancing clinical urgency ($w_u$), waiting time saturation curve ($w_w, \alpha$), deterioration hazard ($w_r$), and resource fit ($w_f$).
  - **Earliest Deadline First (EDF)**: Prioritizes patients approaching their ESI SLA target wait window.

- **Pre-Configured Stress Scenarios**:
  - **Baseline**: Standard operational ED volume.
  - **Mass Casualty Incident**: Sudden surge of critical trauma cases (ESI 1 & 2).
  - **Staff Shortage**: Severely reduced clinical staffing under elevated arrival rates.
  - **Epidemic Surge**: Heavy influx of urgent respiratory cases (ESI 2 & 3).

- **Multi-Policy Comparative Benchmarking**:
  - Benchmarks all four scheduling policies concurrently against an identical pseudo-random arrival stream.
  - Generates comparative metrics on average wait times, SLA compliance, deterioration incidents, renege rates, and resource utilization.

- **Modern Interactive Dashboard**:
  - Real-time simulation playback with minute-by-minute timeline scrubbing.
  - Live queue breakdowns by ESI acuity color coding.
  - Resource saturation gauges and throughput telemetry.
  - Interactive AI triage evaluation sandbox.

---

## Architecture

```
                      +-----------------------------+
                      |      React 18 + Vite UI     |
                      | (Tailwind CSS, Lucide,      |
                      |  Framer Motion Dashboard)   |
                      +--------------+--------------+
                                     |
                       HTTP / Proxy  | (Port 5173 -> 8000)
                                     v
                      +-----------------------------+
                      |       FastAPI Backend       |
                      |      (Uvicorn on :8000)     |
                      +-------+-------------+-------+
                              |             |
            +-----------------+             +-----------------+
            v                                                 v
  +--------------------+                           +--------------------+
  | Simulation Engine  |                           |  AI Triage Engine  |
  | - Arrivals Stream  |                           | - Google Gemini    |
  | - Resource Pool    |                           |   (gemini-3.5-flash)
  | - Scheduling Logic |                           | - Clinical Rule-   |
  | - Metrics Telemetry|                           |   Based Fallback   |
  +--------------------+                           +--------------------+
```

---

## Project Structure

```
MedFlow/
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   └── triage.py          # Gemini AI & rule-based triage logic
│   │   ├── engine/
│   │   │   ├── arrivals.py        # Poisson/NHPP patient arrival generator
│   │   │   ├── entities.py        # Patient, Bed, Staff data models & ESI specs
│   │   │   ├── metrics.py         # Wait time, throughput & SLA analytics
│   │   │   ├── scheduling.py      # FCFS, Urgency, Weighted Aging, EDF policies
│   │   │   └── simulator.py       # Discrete per-minute hospital ED engine
│   │   └── main.py                # FastAPI endpoints & CORS configuration
│   ├── tests/
│   │   ├── test_ai_triage.py      # Unit tests for AI triage & fallback
│   │   ├── test_api.py            # API route integration tests
│   │   └── test_engine.py         # Simulation engine & policy test cases
│   ├── .env.example               # Backend environment variables template
│   ├── pytest.ini                 # Pytest configuration
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                # Base UI components
│   │   │   └── widgets/           # Dashboard widgets (Queue, Resources, etc.)
│   │   ├── api.ts                 # Typed API client & ESI color definitions
│   │   ├── App.tsx                # Main dashboard layout
│   │   └── main.tsx               # React application entry point
│   ├── package.json               # Frontend dependencies & scripts
│   ├── tailwind.config.js         # Tailwind CSS styling configuration
│   ├── tsconfig.json              # TypeScript configuration
│   └── vite.config.ts             # Vite server & API reverse proxy configuration
├── .gitignore                     # Git ignore rules for Python, Node, & OS
├── README.md                      # Comprehensive project documentation
├── run.bat                        # Windows 1-click startup script
└── run.sh                         # Linux / macOS startup script
```

---

## Prerequisites

- **Python**: Version 3.10 or higher
- **Node.js**: Version 18.0 or higher (with `npm`)
- **Google Gemini API Key** *(Optional)*: Required for live LLM triage inference. If not set, the platform will automatically use built-in rule-based clinical scoring.

---

## Quick Start

### Option 1: Windows (Automated Launcher)

MedFlow includes a Windows batch launcher that automatically checks for Python/Node, initializes the virtual environment, installs dependencies, polls the backend health status, and launches the browser:

```cmd
run.bat
```

> **Note**: You can also simply double-click `run.bat` in Windows File Explorer.

### Option 2: Linux / macOS (Automated Script)

```bash
chmod +x run.sh
./run.sh
```

### Option 3: Manual Startup

#### 1. Setup Backend
```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows (Command Prompt):
# .venv\Scripts\activate.bat
# On Windows (PowerShell):
# .venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# (Optional) Configure Gemini API key
cp .env.example .env
# Edit .env and insert your GEMINI_API_KEY

# Launch FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Setup Frontend
In a separate terminal:
```bash
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```

Open your browser and navigate to **`http://localhost:5173`**.

---

## Environment Configuration

Create a `.env` file in the `backend/` directory (you can copy from `backend/.env.example`):

```ini
# Obtain your Gemini API Key from Google AI Studio (https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# Model selection (defaults to gemini-3.5-flash)
MEDFLOW_MODEL=gemini-3.5-flash
```

If `GEMINI_API_KEY` is omitted or empty, MedFlow operates in **offline rule-based mode** without crashing. The dashboard displays an indicator confirming the AI engine status.

---

## API Documentation

When the backend is running, interactive OpenAPI/Swagger documentation is available at:
- **Interactive Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc UI**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status and API key configuration check. |
| `GET` | `/api/ai-status` | Reports Gemini GenAI readiness and active model name. |
| `GET` | `/api/options` | Returns list of policies, scenarios, default formula weights, and AI status. |
| `POST` | `/api/simulate` | Executes a per-minute discrete simulation; returns timeline snapshots and metrics. |
| `POST` | `/api/compare` | Executes all 4 scheduling policies concurrently on an identical arrival stream. |
| `POST` | `/api/triage` | Analyzes an unstructured nurse note and outputs ESI acuity, resources, and risks. |
| `POST` | `/api/triage/batch` | Evaluates a batch of clinical notes (capped at 25 items per request). |

---

## Running Tests

The backend includes a comprehensive pytest suite covering arrival generators, clinical priority formulas, simulation mechanics, and AI triage fallbacks.

```bash
cd backend
.venv/bin/pytest
```
*(On Windows: `.venv\Scripts\pytest`)*

To build and verify the frontend TypeScript and production bundle:
```bash
cd frontend
npm run build
```

---

## Troubleshooting

### Vite Proxy Error: `ECONNREFUSED`
- **Cause**: The frontend tried to call `/api/...` before the backend service was listening, or Node resolved `localhost` to IPv6 `::1` instead of `127.0.0.1`.
- **Fix**: 
  - Ensure the backend is running on port 8000.
  - [frontend/vite.config.ts](file:///home/ujwal/sd/MedFlow-/frontend/vite.config.ts) is configured to proxy to `http://127.0.0.1:8000`.
  - Use `run.bat` (Windows) or `run.sh` (Linux/macOS), which verify backend health before launching Vite.

### Python `bad interpreter` or Missing Modules
- **Cause**: A `.venv` folder was copied from another machine or path.
- **Fix**: Delete the `.venv` folder and recreate it:
  ```bash
  rm -rf backend/.venv
  python -m venv backend/.venv
  backend/.venv/bin/pip install -r backend/requirements.txt
  ```
  *(On Windows, `run.bat` automatically detects and fixes invalid virtual environments).*

---

## License

This project is licensed under the MIT License.

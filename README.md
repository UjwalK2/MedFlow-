# MedFlow

[![FastAPI](https://img.shields.io/badge/FastAPI-0.141+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2+-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4+-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini-3.5_Flash-4285F4.svg?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)

**MedFlow** is an intelligent hospital operations and clinical triage simulation platform. It couples per-minute discrete-event simulation of Emergency Department (ED) workflows with AI-assisted clinical acuity scoring powered by Google Gemini, allowing healthcare administrators, researchers, and clinicians to stress-test patient scheduling policies, resource constraints, and surge scenarios.

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
  - Dynamic patient deterioration and reneging modeling (Left Without Being Seen / LWBS if wait times exceed tolerance).
  - Models core hospital resources: Attending Physicians, Triage Nurses, ER Treatment Beds, ICU Beds, CT Scanners, and Operating Rooms.

- **Intelligent Patient Scheduling Policies**:
  - **First-Come, First-Served (FCFS)**: Baseline chronological order.
  - **Strict Clinical Urgency**: Priority driven strictly by acuity (ESI 1 through 5).
  - **Dynamic Weighted Aging**: Multi-factor non-linear priority scoring combining safety floors, waiting saturation, deterioration hazard, and resource fit.
  - **Earliest Deadline First (EDF)**: Prioritizes patients approaching their ESI SLA target wait deadline.

- **Pre-Configured Stress Scenarios**:
  - **Baseline**: Standard operational ED volume.
  - **Mass Casualty Incident**: Sudden surge of critical trauma cases (ESI 1 & 2).
  - **Staff Shortage**: Severely reduced clinical staffing under elevated arrival rates.
  - **Epidemic Surge**: Heavy influx of urgent respiratory cases (ESI 2 & 3).

- **Multi-Policy Comparative Benchmarking**:
  - Benchmarks all four scheduling policies concurrently against an identical pseudo-random arrival stream.
  - Generates comparative metrics on average wait times, SLA compliance, deterioration incidents, renege rates, and resource utilization.

- **Modern Interactive Dashboard & Theme Support**:
  - High-contrast typography optimized for both **Dark Mode** and **Light (White Background)** environments.
  - Real-time simulation playback with minute-by-minute timeline scrubbing.
  - Live queue breakdowns by ESI acuity color coding.
  - Draggable, collapsible cards with fullscreen focus mode.

---

## Mathematical Foundations & Algorithm Formulation

MedFlow incorporates stochastic processes, non-linear priority optimization, and queueing theory to model emergency department patient flow.

```
+--------------------------------------------------------------------------------------------------+
|                                  PRIORITY SCORING ENGINE                                         |
|                                                                                                  |
|   Score(p, t) = SafetyFloor[ESI_p] + w_u * U(p) + w_w * W(p,t)^alpha + w_r * R(p,t) + w_f * F(p) |
+--------------------------------------------------------------------------------------------------+
          |                      |               |                    |               |
          v                      v               v                    v               v
   +--------------+       +--------------+  +---------------+  +--------------+  +--------------+
   | Safety Floor |       | Acuity Level |  | Wait Saturation|  | Hazard Risk  |  | Resource Fit |
   | ESI 1: +2.0  |       |   (5 - ESI)/4|  | min(1, w/T)^a |  | 1 - exp(-kw) |  | Free / Demand|
   | ESI 2: +1.0  |       |   in [0, 1]  |  | bounded at 1.0|  | in [0, 1)    |  | in [0, 1]    |
   +--------------+       +--------------+  +---------------+  +--------------+  +--------------+
```

### 1. Dynamic Weighted Aging Priority Formula

In an emergency department, strictly prioritizing by acuity (ESI) causes lower-acuity patients (ESI 3–5) to starve during surges. Conversely, First-Come, First-Served (FCFS) violates clinical safety by treating sprains before heart attacks. 

MedFlow implements a **Dynamic Weighted Aging** algorithm that balances clinical safety, waiting room saturation, physiological deterioration risk, and hospital resource availability:

$$\text{Score}(p, t) = \text{SafetyFloor}(\text{ESI}_p) + w_u \cdot U(p) + w_w \cdot W(p, t)^\alpha + w_r \cdot R(p, t) + w_f \cdot F(p, \mathcal{R}_t)$$

#### Normalized Parameter Constraints
The weights are normalized such that:
$$\sum w_i = w_u + w_w + w_r + w_f = 0.35 + 0.30 + 0.25 + 0.10 = 1.0, \quad \alpha = 1.8$$

---

#### Detailed Mathematical Components

#### A. Lexicographic Safety Floor: $\text{SafetyFloor}(\text{ESI}_p)$
To prevent lower-acuity patients who have waited for hours from leapfrogging critical resuscitation cases, a non-linear safety floor is enforced:

$$\text{SafetyFloor}(\text{ESI}_p) = \begin{cases} 2.0 & \text{for ESI-1 (Resuscitation / Code)} \\ 1.0 & \text{for ESI-2 (Emergent)} \\ 0.0 & \text{for ESI-3, 4, 5} \end{cases}$$

*Mathematical Guarantee*: Because all other terms are bounded in $[0, 1]$ and their weights sum to $1.0$, the maximum possible score for an ESI-3 patient is $0.0 + 1.0 = 1.0$. Consequently, an ESI-1 patient (minimum score $2.0$) or an ESI-2 patient (minimum score $1.0$) is guaranteed strict priority over ESI 3–5 patients, preserving critical clinical safety.

---

#### B. Clinical Acuity / Urgency: $U(p)$
Measures normalized static clinical acuity at triage:

$$U(p) = \frac{5 - \text{ESI}_p}{4} \in [0, 1]$$

| Acuity Tier | Description | $U(p)$ | Target Wait ($T_{\text{target}}$) |
|---|---|---|---|
| **ESI-1** | Resuscitation | $1.00$ | $1$ minute |
| **ESI-2** | Emergent | $0.75$ | $10$ minutes |
| **ESI-3** | Urgent | $0.50$ | $30$ minutes |
| **ESI-4** | Less Urgent | $0.25$ | $60$ minutes |
| **ESI-5** | Non-Urgent | $0.00$ | $120$ minutes |

---

#### C. Non-Linear Waiting Time Saturation: $W(p, t)^\alpha$
Let $w_p(t) = t - t_{\text{arrival}}$ denote the elapsed waiting time in minutes. The waiting component is defined as:

$$\text{Ratio}(p, t) = \min\left(1.0, \frac{w_p(t)}{T_{\text{target}}(\text{ESI}_p)}\right)$$

$$W(p, t)^\alpha = \left(\text{Ratio}(p, t)\right)^\alpha, \quad \alpha = 1.8$$

*Properties*:
1. **Convex Escalation ($\alpha > 1$)**: When a patient's wait time is well below the clinical target, the ratio contributes marginally. As $w_p(t) \to T_{\text{target}}$, the penalty accelerates sharply.
2. **Strict Saturation at $1.0$**: Capping at $1.0$ guarantees that no patient's waiting component can grow indefinitely.

---

#### D. Physiological Deterioration Hazard Function: $R(p, t)$
In emergency medicine, unadmitted patients deteriorate over time according to a hazard function. MedFlow models this with an exponential failure cumulative distribution function:

$$R(p, t) = 1 - \exp\left(-k_{\text{ESI}} \cdot w_p(t)\right) \in [0, 1)$$

The decay constant $k_{\text{ESI}}$ is calibrated to clinical deterioration speeds:

| ESI Tier | $k_{\text{ESI}}$ ($\text{min}^{-1}$) | Time to Deterioration Threshold ($R \ge 0.55$) |
|---|---|---|
| **ESI-1** | $0.0800$ | $\approx 10$ minutes |
| **ESI-2** | $0.0200$ | $\approx 40$ minutes |
| **ESI-3** | $0.0050$ | $\approx 160$ minutes ($2.6$ hours) |
| **ESI-4** | $0.0010$ | $\approx 800$ minutes ($13.3$ hours) |
| **ESI-5** | $0.0002$ | $\approx 4000$ minutes ($66.7$ hours) |

When $R(p, t) \ge 0.55$, the patient is flagged as **clinically deteriorated** in the waiting room, impacting clinical quality metrics.

---

#### E. Hospital Resource Fit / Feasibility: $F(p, \mathcal{R}_t)$
Prevents queue head-of-line blocking when a high-priority patient requires resources that are currently occupied (e.g., an ICU bed or CT scanner):

$$F(p, \mathcal{R}_t) = \frac{\sum_{r \in \mathcal{K}_p} \mathbb{I}\left(A_t(r) \ge D_p(r)\right)}{|\mathcal{K}_p|} \in [0, 1]$$

where:
- $\mathcal{K}_p$ is the set of required resource categories for patient $p$.
- $D_p(r)$ is patient $p$'s demand for resource $r$.
- $A_t(r)$ is the available capacity of resource $r$ in the pool at minute $t$.
- $\mathbb{I}(\cdot)$ is the indicator function ($1$ if available, $0$ otherwise).

---

### 2. Patient Arrival Process: Non-Homogeneous Poisson Process (NHPP)

Patient arrivals are modeled as an NHPP with time-varying arrival rate $\lambda(t)$:

$$\lambda(t) = \lambda_{\text{base}} \cdot \prod_{e \in \mathcal{E}_{\text{active}}(t)} m_e$$

#### Lewis-Shedler Thinning Algorithm
1. Compute the maximum arrival rate $\lambda_{\max} = \sup_{t \in [0, T]} \lambda(t)$.
2. Generate candidate arrival intervals:
   $$\Delta t_k \sim \text{Exponential}(\lambda_{\max}) \implies t_{k} = t_{k-1} + \Delta t_k$$
3. Accept candidate arrival $t_k$ with acceptance probability:
   $$P(\text{accept} \mid t_k) = \frac{\lambda(t_k)}{\lambda_{\max}}$$
4. For accepted arrivals, draw patient acuity from the current distribution:
   $$\text{ESI}_p \sim \text{Categorical}(\vec{p}_{\text{acuity}}(t))$$

#### Treatment Service Duration: Log-Normal Distribution
Resource occupancy duration $S$ (in minutes) follows a log-normal distribution:

$$S_p \sim \text{Lognormal}(\mu_{\text{ESI}}, \sigma_{\text{ESI}})$$

$$\mathbb{E}[S_p] = \exp\left(\mu + \frac{\sigma^2}{2}\right), \quad \text{Var}(S_p) = \left[\exp(\sigma^2) - 1\right] \exp\left(2\mu + \sigma^2\right)$$

- **ESI-1**: $\mu = 4.2, \sigma = 0.40 \implies \mathbb{E}[S] \approx 72\text{ mins}$
- **ESI-2**: $\mu = 3.8, \sigma = 0.35 \implies \mathbb{E}[S] \approx 48\text{ mins}$
- **ESI-3**: $\mu = 3.4, \sigma = 0.30 \implies \mathbb{E}[S] \approx 31\text{ mins}$
- **ESI-4**: $\mu = 2.7, \sigma = 0.25 \implies \mathbb{E}[S] \approx 15\text{ mins}$
- **ESI-5**: $\mu = 2.0, \sigma = 0.20 \implies \mathbb{E}[S] \approx 8\text{ mins}$

#### Patient Reneging (Left Without Being Seen / LWBS)
Patients renege if elapsed waiting time exceeds their patience threshold $T_{\text{patience}}$:
- **ESI-1**: $T_{\text{patience}} = \infty$ (never leaves)
- **ESI-2**: $T_{\text{patience}} = 360$ mins ($6$ hours)
- **ESI-3**: $T_{\text{patience}} = 180$ mins ($3$ hours)
- **ESI-4**: $T_{\text{patience}} = 120$ mins ($2$ hours)
- **ESI-5**: $T_{\text{patience}} = 90$ mins ($1.5$ hours)

---

### 3. Queueing Theory Verification & Telemetry

#### Erlang-C ($M/M/c$) Delay Model
To benchmark the empirical simulation against analytical queueing theory, MedFlow computes theoretical steady-state delay for $c$ parallel medical servers:

$$\text{Offered Load: } u = \frac{\lambda}{\mu}, \quad \text{Server Utilization: } \rho = \frac{u}{c} = \frac{\lambda}{c \mu}$$

For $\rho < 1$, the Erlang-C waiting probability $C(c, u)$ is:

$$P_0 = \left[ \sum_{k=0}^{c-1} \frac{u^k}{k!} + \frac{u^c}{c!(1 - \rho)} \right]^{-1}$$

$$C(c, u) = \frac{u^c}{c!(1 - \rho)} \cdot P_0$$

$$\mathbb{E}[W_q] = \frac{C(c, u)}{c \mu (1 - \rho)}$$

#### Little's Law Verification
Every simulation run verifies consistency with Little's Law ($L = \lambda W$):

$$\bar{L} = \frac{1}{T} \sum_{t=0}^T Q(t)$$

$$\Delta_{\text{Little}} = \frac{|\bar{L} - \lambda_{\text{eff}} \bar{W}|}{\bar{L}} \times 100\%$$

where $\bar{L}$ is the empirical time-averaged waiting room queue length and $\bar{W}$ is the mean elapsed waiting time.

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
  | - Arrivals (NHPP)  |                           | - Google Gemini    |
  | - Resource Pool    |                           |   (gemini-3.5-flash)
  | - Dynamic Aging    |                           | - Clinical Rule-   |
  | - Erlang-C & Little|                           |   Based Fallback   |
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
│   │   │   ├── metrics.py         # Wait time, throughput, Erlang-C & Little's Law
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
│   │   │   ├── ui/                # Base UI & DraggableWidgetGrid
│   │   │   └── widgets/           # Dashboard widgets (Queue, Resources, etc.)
│   │   ├── api.ts                 # Typed API client & ESI color definitions
│   │   ├── App.tsx                # Main dashboard layout & theme toggle
│   │   ├── index.css              # Light/Dark high-contrast typography rules
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

## White Background & High-Contrast Typography

MedFlow is designed with accessible typography for both dark and white/light background situations:
- **Automatic Contrast Adaptation**: Whenever elements are placed inside a white or light background container (`.bg-white`, `.bg-zinc-100`, or light mode), text, headers, and labels automatically render in crisp dark black (`#09090b` / `#0f172a`), with secondary subtext rendered in high-contrast slate (`#475569`).
- **Native Select & Option Fix**: Eliminates the white-on-white text bug common in Windows Chromium browsers by enforcing dark background and light text in dark mode, and white background with black text in light situations.
- **Theme Toggle**: Switch between **Dark Mode** and **Light (White Background) Mode** at any time using the Sun/Moon button in the command center header.
- **Print Optimization**: Automatically formats full black-on-white text in print mode.

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
- **Cause**: The frontend called `/api/...` before the backend was listening, or Node resolved `localhost` to IPv6 `::1`.
- **Fix**: 
  - Ensure the backend is running on port 8000.
  - [frontend/vite.config.ts](file:///home/ujwal/sd/MedFlow-/frontend/vite.config.ts) is configured to proxy to `http://127.0.0.1:8000`.
  - Use `run.bat` (Windows) or `run.sh` (Linux/macOS), which verify backend health before launching Vite.

### Python `bad interpreter`
- **Cause**: A `.venv` folder was copied from another machine or path.
- **Fix**: Delete `.venv` and let `run.bat` or `run.sh` recreate it:
  ```bash
  rm -rf backend/.venv
  python -m venv backend/.venv
  backend/.venv/bin/pip install -r backend/requirements.txt
  ```

---

## License

This project is licensed under the MIT License.

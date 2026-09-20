# MedFlow

[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036.svg?style=flat&logoColor=white)](https://groq.com/)

**MedFlow** is an intelligent hospital operations and clinical triage simulation platform. It couples a per-minute discrete-event simulation of Emergency Department (ED) workflows with AI-assisted clinical acuity scoring powered by **Groq** (Llama 3.3 70B), allowing healthcare administrators, researchers, and clinicians to stress-test patient scheduling policies, resource constraints, and surge scenarios.

---

## Key Features

- **Clinical ESI Triage Engine**
  - Implements standard 5-level **Emergency Severity Index (ESI)** logic (Levels 1–5).
  - Evaluates unstructured clinical nurse intake notes using **Groq's OpenAI-compatible chat API** (default model: `llama-3.3-70b-versatile`).
  - Seamless, automatic offline fallback to a transparent rule-based clinical keyword scoring engine when no API key is provided or the model call fails.
  - Detects clinical red flags, estimates required hospital resources, predicts treatment duration, and quantifies deterioration risk.
  - Supports single-note evaluation and batch ingestion (capped at 25 notes per request).

- **Discrete-Event ED Simulation**
  - Per-minute discrete-event simulation tracking admissions, waiting rooms, resource allocation, and patient discharge.
  - Dynamic patient deterioration and reneging modeling (Left Without Being Seen / LWBS if wait times exceed patience thresholds).
  - Models a shared hospital resource pool of **beds, doctors, and nurses**, with per-ESI-level resource demand and scenario-level capacity events (e.g., a mid-shift physician shortage).

- **Intelligent Patient Scheduling Policies**
  - **First-Come, First-Served (FCFS)**: Baseline chronological order.
  - **Strict Clinical Urgency**: Priority driven strictly by acuity (ESI 1 through 5).
  - **Dynamic Weighted Aging**: Multi-factor non-linear priority scoring combining a clinical safety floor, waiting saturation, deterioration hazard, and resource fit.
  - **Earliest Deadline First (EDF)**: Prioritizes patients approaching their ESI SLA target wait deadline.

- **Pre-Configured Stress Scenarios**
  - **Baseline**: Standard operational ED volume.
  - **Mass Casualty Incident**: Sudden surge of critical trauma cases (ESI 1 & 2) at minute 60.
  - **Staff Shortage**: Mid-shift reduction in physician and nursing capacity.
  - **Epidemic Surge**: Sustained +75% arrival rate throughout the shift.

- **Multi-Policy Comparative Benchmarking**
  - Benchmarks all four scheduling policies concurrently against an identical pseudo-random arrival stream.
  - Generates comparative metrics on average wait times, SLA compliance, deterioration incidents, renege rates, and resource utilization.

- **Modern Interactive Dashboard & Theme Support**
  - High-contrast typography optimized for both **Dark Mode** and **Light (White Background)** environments.
  - Draggable, collapsible widget cards: Run, Queue, Resources, Compare, Outcomes, Triage, and AI Status.
  - Live queue breakdowns by ESI acuity color coding.

---

## Mathematical Foundations & Algorithm Formulation

MedFlow incorporates stochastic processes, non-linear priority optimization, and queueing theory to model emergency department patient flow.

```
+--------------------------------------------------------------------------------------------------+
|                                  PRIORITY SCORING ENGINE                                          |
|                                                                                                   |
|   Score(p, t) = SafetyFloor[ESI_p] + w_u * U(p) + w_w * W(p,t)^alpha + w_r * R(p,t) + w_f * F(p)  |
+--------------------------------------------------------------------------------------------------+
          |                      |               |                    |               |
          v                      v               v                    v               v
   +--------------+      +--------------+  +-----------------+  +--------------+  +---------------+
   | Safety Floor |      | Acuity Level |  | Wait Saturation |  | Hazard Risk  |  | Resource Fit  |
   | ESI 1: +2.0  |      |   (5 - ESI)/4|  | min(1, w/T)^a   |  | 1 - exp(-kw) |  | Free / Demand |
   | ESI 2: +1.0  |      |   in [0, 1]  |  | bounded at 1.0  |  | in [0, 1)    |  | in [0, 1]     |
   +--------------+      +--------------+  +-----------------+  +--------------+  +---------------+
```

### 1. Dynamic Weighted Aging Priority Formula

In an emergency department, strictly prioritizing by acuity (ESI) causes lower-acuity patients (ESI 3–5) to starve during surges. Conversely, First-Come, First-Served (FCFS) violates clinical safety by treating sprains before heart attacks.

MedFlow implements a **Dynamic Weighted Aging** algorithm that balances clinical safety, waiting-room saturation, physiological deterioration risk, and hospital resource availability:

$$\text{Score}(p, t) = \text{SafetyFloor}(\text{ESI}_p) + w_u \cdot U(p) + w_w \cdot W(p, t)^\alpha + w_r \cdot R(p, t) + w_f \cdot F(p, \mathcal{R}_t)$$

**Normalized Parameter Constraints** — the weights are normalized such that:

$$\sum w_i = w_u + w_w + w_r + w_f = 0.35 + 0.30 + 0.25 + 0.10 = 1.0, \quad \alpha = 1.8$$

#### A. Lexicographic Safety Floor: $\text{SafetyFloor}(\text{ESI}_p)$

To prevent lower-acuity patients who have waited for hours from leapfrogging critical resuscitation cases, a non-linear safety floor is enforced:

$$\text{SafetyFloor}(\text{ESI}_p) = \begin{cases} 2.0 & \text{ESI-1 (Resuscitation)} \\ 1.0 & \text{ESI-2 (Emergent)} \\ 0.0 & \text{ESI-3, 4, 5} \end{cases}$$

Because all other terms are bounded in $[0, 1]$ and their weights sum to $1.0$, the maximum possible score for an ESI-3 patient is $0.0 + 1.0 = 1.0$. An ESI-1 patient (minimum score $2.0$) or ESI-2 patient (minimum score $1.0$) is therefore guaranteed strict priority over ESI 3–5 patients.

#### B. Clinical Acuity / Urgency: $U(p)$

$$U(p) = \frac{5 - \text{ESI}_p}{4} \in [0, 1]$$

| Acuity Tier | Description   | $U(p)$ | Target Wait ($T_{\text{target}}$) | Patience Limit (LWBS) |
| ----------- | ------------- | ------ | ---------------------------------- | ---------------------- |
| **ESI-1**   | Resuscitation | $1.00$ | 1 minute                           | Never leaves |
| **ESI-2**   | Emergent      | $0.75$ | 10 minutes                         | 360 minutes (6 hrs) |
| **ESI-3**   | Urgent        | $0.50$ | 30 minutes                         | 180 minutes (3 hrs) |
| **ESI-4**   | Less Urgent   | $0.25$ | 60 minutes                         | 120 minutes (2 hrs) |
| **ESI-5**   | Non-Urgent    | $0.00$ | 120 minutes                        | 90 minutes (1.5 hrs) |

#### C. Non-Linear Waiting Time Saturation: $W(p, t)^\alpha$

Let $w_p(t) = t - t_{\text{arrival}}$ denote elapsed wait time in minutes:

$$\text{Ratio}(p, t) = \min\left(1.0, \frac{w_p(t)}{T_{\text{target}}(\text{ESI}_p)}\right), \qquad W(p, t)^\alpha = \left(\text{Ratio}(p, t)\right)^\alpha, \quad \alpha = 1.8$$

Because $\alpha > 1$, the waiting penalty accelerates sharply as a patient's wait approaches their clinical target, while the $\min(1.0, \cdot)$ cap guarantees the waiting component never grows unbounded.

#### D. Physiological Deterioration Hazard Function: $R(p, t)$

MedFlow models patient deterioration while unadmitted using an exponential hazard function:

$$R(p, t) = 1 - \exp\left(-k_{\text{ESI}} \cdot w_p(t)\right) \in [0, 1)$$

| ESI Tier  | $k_{\text{ESI}}$ ($\text{min}^{-1}$) | Time to Deterioration Threshold ($R \ge 0.55$) |
| --------- | -------------------------------------- | ----------------------------------------------- |
| **ESI-1** | $0.0800$                                | $\approx 10$ minutes |
| **ESI-2** | $0.0200$                                | $\approx 40$ minutes |
| **ESI-3** | $0.0050$                                | $\approx 160$ minutes ($2.6$ hrs) |
| **ESI-4** | $0.0010$                                | $\approx 800$ minutes ($13.3$ hrs) |
| **ESI-5** | $0.0002$                                | $\approx 4000$ minutes ($66.7$ hrs) |

When $R(p, t) \ge 0.55$, the patient is flagged as **clinically deteriorated** in the waiting room and this is reflected in simulation metrics and event logs.

#### E. Hospital Resource Fit / Feasibility: $F(p, \mathcal{R}_t)$

Prevents head-of-line blocking when a high-priority patient requires resources that are currently occupied:

$$F(p, \mathcal{R}_t) = \frac{\sum_{r \in \mathcal{K}_p} \mathbb{I}\left(A_t(r) \ge D_p(r)\right)}{|\mathcal{K}_p|} \in [0, 1]$$

where $\mathcal{K}_p$ is the set of resource categories required by patient $p$, $D_p(r)$ is $p$'s demand for resource $r$, $A_t(r)$ is available capacity of $r$ at minute $t$, and $\mathbb{I}(\cdot)$ is the indicator function.

**Per-ESI default resource demand** (bed / doctor / nurse pool):

| ESI Level | Required Resources |
| --------- | ------------------- |
| ESI-1 | 1 bed, 1 doctor, 2 nurses |
| ESI-2 | 1 bed, 1 doctor, 1 nurse |
| ESI-3 | 1 bed, 1 doctor |
| ESI-4 | 1 bed |
| ESI-5 | 1 bed |

The simulator greedily allocates resources each tick but **skips** (rather than blocks on) any patient whose full resource bundle isn't currently free, so one high-priority patient waiting on a scarce resource cannot stall lower-priority patients behind them.

### 2. Patient Arrival Process: Non-Homogeneous Poisson Process (NHPP)

Patient arrivals are modeled as an NHPP with time-varying arrival rate $\lambda(t)$:

$$\lambda(t) = \lambda_{\text{base}} \cdot \prod_{e \in \mathcal{E}_{\text{active}}(t)} m_e$$

**Lewis–Shedler thinning algorithm:**

1. Compute the maximum arrival rate $\lambda_{\max} = \sup_{t \in [0, T]} \lambda(t)$.
2. Generate candidate inter-arrival intervals $\Delta t_k \sim \text{Exponential}(\lambda_{\max})$, so $t_k = t_{k-1} + \Delta t_k$.
3. Accept candidate arrival $t_k$ with probability $P(\text{accept} \mid t_k) = \lambda(t_k) / \lambda_{\max}$.
4. For accepted arrivals, draw patient acuity from the scenario's current ESI distribution.

**Treatment service duration** follows a log-normal distribution $S_p \sim \text{Lognormal}(\mu_{\text{ESI}}, \sigma_{\text{ESI}})$:

- **ESI-1**: $\mu = 4.2, \sigma = 0.40 \Rightarrow \mathbb{E}[S] \approx 72$ min
- **ESI-2**: $\mu = 3.8, \sigma = 0.35 \Rightarrow \mathbb{E}[S] \approx 48$ min
- **ESI-3**: $\mu = 3.4, \sigma = 0.30 \Rightarrow \mathbb{E}[S] \approx 31$ min
- **ESI-4**: $\mu = 2.7, \sigma = 0.25 \Rightarrow \mathbb{E}[S] \approx 15$ min
- **ESI-5**: $\mu = 2.0, \sigma = 0.20 \Rightarrow \mathbb{E}[S] \approx 8$ min

### 3. Queueing Theory Verification & Telemetry

**Erlang-C ($M/M/c$) delay model** benchmarks the empirical simulation against analytical queueing theory using offered load $u = \lambda/\mu$ and utilization $\rho = u/c$:

$$P_0 = \left[ \sum_{k=0}^{c-1} \frac{u^k}{k!} + \frac{u^c}{c!(1 - \rho)} \right]^{-1}, \qquad C(c, u) = \frac{u^c}{c!(1 - \rho)} \cdot P_0, \qquad \mathbb{E}[W_q] = \frac{C(c, u)}{c \mu (1 - \rho)}$$

**Little's Law verification** — every simulation run checks consistency with $L = \lambda W$:

$$\bar{L} = \frac{1}{T} \sum_{t=0}^T Q(t), \qquad \Delta_{\text{Little}} = \frac{|\bar{L} - \lambda_{\text{eff}} \bar{W}|}{\bar{L}} \times 100\%$$

where $\bar{L}$ is the empirical time-averaged queue length and $\bar{W}$ is the mean elapsed waiting time.

---

## Architecture

```
                    +-----------------------------+
                    |      React 18 + Vite UI     |
                    |  (Tailwind CSS, Lucide,     |
                    |   Motion, draggable widgets)|
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
| - Arrivals (NHPP)  |                           | - Groq (OpenAI-    |
| - Resource Pool    |                           |   compatible API,  |
| - Dynamic Aging    |                           |   llama-3.3-70b)   |
| - Erlang-C & Little|                           | - Rule-Based       |
|   verification     |                           |   Fallback         |
+--------------------+                           +--------------------+
```

---

## Project Structure

```
MedFlow/
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   └── triage.py          # Groq (OpenAI-compatible) & rule-based triage logic
│   │   ├── engine/
│   │   │   ├── arrivals.py        # NHPP patient arrival generator (Lewis-Shedler thinning)
│   │   │   ├── entities.py        # Patient, ResourcePool data models & ESI constants
│   │   │   ├── metrics.py         # Wait time, throughput, Erlang-C & Little's Law metrics
│   │   │   ├── scheduling.py      # FCFS, Urgency, Weighted Aging, EDF policies
│   │   │   └── simulator.py       # Discrete per-minute hospital ED tick-loop engine
│   │   └── main.py                # FastAPI endpoints & CORS configuration
│   ├── tests/
│   │   ├── test_ai_triage.py      # Unit tests for AI triage & rule-based fallback
│   │   ├── test_api.py            # API route integration tests
│   │   └── test_engine.py         # Simulation engine & policy test cases
│   ├── .env.example               # Backend environment variables template
│   ├── pytest.ini                 # Pytest configuration
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                # DraggableWidgetGrid base component
│   │   │   └── widgets/           # RunWidget, QueueWidget, ResourcesWidget,
│   │   │                          # CompareWidget, OutcomesWidget, TriageWidget,
│   │   │                          # AiStatusWidget
│   │   ├── lib/utils.ts           # Shared frontend utility helpers
│   │   ├── api.ts                 # Typed API client & ESI color/theme constants
│   │   ├── App.tsx                # Main dashboard layout & theme toggle
│   │   ├── index.css              # Light/Dark high-contrast typography rules
│   │   └── main.tsx               # React application entry point
│   ├── package.json               # Frontend dependencies & scripts
│   ├── tailwind.config.js         # Tailwind CSS styling configuration
│   ├── tsconfig.json              # TypeScript configuration
│   └── vite.config.ts             # Vite dev server & /api, /health reverse proxy
├── .gitignore                     # Git ignore rules for Python, Node, & OS
├── README.md                      # Project documentation (this file)
├── run.bat                        # Windows one-click startup script
└── run.sh                         # Linux / macOS startup script
```

---

## Quick Start

### Option 1: Windows (Automated Launcher)

MedFlow includes a Windows batch launcher that automatically checks for Python/Node, initializes the virtual environment, installs dependencies, polls the backend health status, and launches the browser:

```bat
run.bat
```
> You can also simply double-click `run.bat` in Windows File Explorer.

### Option 2: Linux / macOS (Automated Script)

```bash
chmod +x run.sh
./run.sh
```

### Option 3: Manual Startup

**1. Setup Backend**

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

# (Optional) Configure Groq API key
cp .env.example .env
# Edit .env and insert your GROQ_API_KEY

# Launch FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**2. Setup Frontend**

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

MedFlow is designed with accessible typography for both dark and light-background contexts:

- **Automatic Contrast Adaptation**: Elements placed inside a white or light-background container automatically render text, headers, and labels in high-contrast dark tones, with secondary subtext in high-contrast slate.
- **Native Select & Option Fix**: Avoids white-on-white text issues in Windows Chromium browsers by enforcing dark background/light text in dark mode and light background/dark text in light mode.
- **Theme Toggle**: Switch between **Dark Mode** and **Light Mode** at any time from the dashboard header.
- **Print Optimization**: Formats black-on-white text in print mode.

---

## Environment Configuration

Create a `.env` file in the `backend/` directory (you can copy from `backend/.env.example`):

```env
# MedFlow Configuration
# Obtain your Groq API Key from the Groq Console (https://console.groq.com/)
GROQ_API_KEY=your_groq_api_key_here

# Optional model selection (defaults to llama-3.3-70b-versatile)
MEDFLOW_MODEL=llama-3.3-70b-versatile
```

If `GROQ_API_KEY` is omitted or empty, MedFlow operates in **offline rule-based mode** without crashing — the AI triage engine transparently falls back to the keyword classifier in `app/ai/triage.py`, and responses are tagged `"source": "rule_fallback"` instead of `"source": "model"`. The dashboard's AI Status widget reflects which mode is currently active.

---

## API Documentation

When the backend is running, interactive OpenAPI/Swagger documentation is available at:

- **Interactive Swagger UI**: <http://127.0.0.1:8000/docs>
- **ReDoc UI**: <http://127.0.0.1:8000/redoc>

### Core Endpoints

| Method | Endpoint            | Description                                                                        |
| ------ | -------------------- | ----------------------------------------------------------------------------------- |
| `GET`  | `/health`             | Service health status and Groq API key configuration check.                        |
| `GET`  | `/api/ai-status`      | Reports Groq readiness and the active model name.                                  |
| `GET`  | `/api/options`        | Returns available policies, scenarios, default priority-formula weights, and AI status. |
| `POST` | `/api/simulate`       | Executes a per-minute discrete simulation; returns timeline snapshots and metrics. |
| `POST` | `/api/compare`        | Executes all 4 scheduling policies concurrently on an identical arrival stream.    |
| `POST` | `/api/triage`         | Analyzes an unstructured nurse note and returns ESI acuity, resources, and risks.  |
| `POST` | `/api/triage/batch`   | Evaluates a batch of clinical notes (capped at 25 items per request).              |

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
  - `frontend/vite.config.ts` is configured to proxy `/api` and `/health` to `http://127.0.0.1:8000`.
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

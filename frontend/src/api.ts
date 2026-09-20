/**
 * MedFlow API Client and Clinical ESI Triage Constants
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

// ============================================================================
// ESI Clinical Color and Severity Theme Constants (Dark Theme Optimized)
// ============================================================================

export interface ESIConfig {
  level: number
  label: string
  acuity: string
  targetWaitMinutes: number
  targetWaitText: string
  color: string
  badgeClass: string
  bgLightClass: string
  borderClass: string
  textClass: string
  dotClass: string
  glowClass: string
}

export const ESI_COLORS: Record<number, ESIConfig> = {
  1: {
    level: 1,
    label: "ESI-1",
    acuity: "Resuscitation",
    targetWaitMinutes: 1,
    targetWaitText: "Immediate (< 1 min)",
    color: "#f43f5e", // Rose 500
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    bgLightClass: "bg-rose-950/30",
    borderClass: "border-rose-500/50",
    textClass: "text-rose-400",
    dotClass: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]",
    glowClass: "shadow-[0_0_15px_rgba(244,63,94,0.25)]",
  },
  2: {
    level: 2,
    label: "ESI-2",
    acuity: "Emergent",
    targetWaitMinutes: 10,
    targetWaitText: "10 mins",
    color: "#f97316", // Orange 500
    badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    bgLightClass: "bg-orange-950/30",
    borderClass: "border-orange-500/50",
    textClass: "text-orange-400",
    dotClass: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]",
    glowClass: "shadow-[0_0_15px_rgba(249,115,22,0.25)]",
  },
  3: {
    level: 3,
    label: "ESI-3",
    acuity: "Urgent",
    targetWaitMinutes: 30,
    targetWaitText: "30 mins",
    color: "#eab308", // Yellow 500
    badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    bgLightClass: "bg-yellow-950/20",
    borderClass: "border-yellow-500/40",
    textClass: "text-yellow-400",
    dotClass: "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]",
    glowClass: "shadow-[0_0_15px_rgba(234,179,8,0.25)]",
  },
  4: {
    level: 4,
    label: "ESI-4",
    acuity: "Less Urgent",
    targetWaitMinutes: 60,
    targetWaitText: "60 mins",
    color: "#10b981", // Emerald 500
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    bgLightClass: "bg-emerald-950/20",
    borderClass: "border-emerald-500/40",
    textClass: "text-emerald-400",
    dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]",
    glowClass: "shadow-[0_0_15px_rgba(16,185,129,0.25)]",
  },
  5: {
    level: 5,
    label: "ESI-5",
    acuity: "Non-Urgent",
    targetWaitMinutes: 120,
    targetWaitText: "120 mins",
    color: "#64748b", // Slate 500 / Blue-Grey
    badgeClass: "bg-slate-500/20 text-slate-300 border-slate-500/40",
    bgLightClass: "bg-slate-900/30",
    borderClass: "border-slate-600/40",
    textClass: "text-slate-400",
    dotClass: "bg-slate-500",
    glowClass: "",
  },
}

export function getESIConfig(esi: number): ESIConfig {
  return ESI_COLORS[esi] || ESI_COLORS[5]
}


// ============================================================================
// TypeScript API Request & Response Types
// ============================================================================

export interface PriorityWeights {
  w_u: number
  w_w: number
  w_r: number
  w_f: number
  alpha: number
}

export interface PolicyOption {
  id: string
  name: string
  description: string
}

export interface ScenarioOption {
  id: string
  name: string
  description: string
  duration_minutes: number
  base_rate: number
  initial_resources: Record<string, number>
}

export interface AIStatusResponse {
  configured: boolean
  model: string
  status: string
  details?: string
}

export interface OptionsResponse {
  policies: PolicyOption[]
  scenarios: ScenarioOption[]
  default_weights: PriorityWeights
  ai_status: AIStatusResponse
}

export interface SimulateRequest {
  policy?: string
  scenario?: string
  seed?: number | null
  duration_minutes?: number | null
  weights?: PriorityWeights | null
  custom_resources?: Record<string, number> | null
}

export interface CompareRequest {
  scenario?: string
  seed?: number | null
  duration_minutes?: number | null
  weights?: PriorityWeights | null
}

export interface TriageNoteRequest {
  note: string
}

export interface TriageBatchRequest {
  notes: string[]
}

export interface TriageResponse {
  esi: number
  required_resources: string[]
  estimated_service_minutes: number
  deterioration_risk: "low" | "moderate" | "high"
  red_flags: string[]
  rationale: string
  source: "model" | "rule_fallback"
}

export interface TriageBatchResponse {
  count: number
  results: TriageResponse[]
}

export interface QueuePatientSummary {
  id: string
  esi: number
  arrival_time: number
  wait_time: number
  target_wait: number
  priority_score: number
  deterioration_risk: number
  resource_fit: number
  required_resources: Record<string, number>
  sla_breached: boolean
}

export interface InServicePatientSummary {
  id: string
  esi: number
  start_service_time: number | null
  completion_time: number | null
  remaining_service: number
  required_resources: Record<string, number>
}

export interface SimulationSnapshot {
  minute: number
  waiting_count: number
  in_service_count: number
  completed_count: number
  reneged_count: number
  deteriorated_count: number
  available_resources: Record<string, number>
  total_resources: Record<string, number>
  resource_utilization: Record<string, number>
  queue: QueuePatientSummary[]
  in_service: InServicePatientSummary[]
  events: string[]
}

export interface PatientRecord {
  id: string
  esi: number
  arrival_time: number
  target_wait: number
  required_resources: Record<string, number>
  service_time: number
  wait_time: number
  start_service_time: number | null
  completion_time: number | null
  deteriorated: boolean
  deterioration_time: number | null
  deterioration_risk: number
  reneged: boolean
  reneged_time: number | null
  sla_breached: boolean
}

export interface SimulationMetrics {
  total_patients: number
  admitted_patients: number
  treated_patients: number
  reneged_patients: number
  deteriorated_patients: number
  overall_mean_wait: number
  per_esi_mean_wait: Record<number, number>
  overall_sla_breach_rate: number
  per_esi_sla_breach_rate: Record<number, number>
  per_esi_sla_breach_count: Record<number, number>
  erlang_c_mean_delay: number | null
  erlang_c_server_utilization: number
  erlang_c_is_stable: boolean
  littles_law_L: number
  littles_law_lambda_W: number
  littles_law_diff_pct: number
}

export interface SimulateResponse {
  policy_id: string
  scenario_id: string
  seed: number | null
  duration_minutes: number
  snapshots: SimulationSnapshot[]
  patients: PatientRecord[]
  metrics: SimulationMetrics
}

export interface CompareResponse {
  scenario_id: string
  seed: number | null
  total_patients: number
  policies: Record<string, SimulateResponse>
  metrics_summary: Record<string, SimulationMetrics>
}


// ============================================================================
// Typed Fetch API Client (Uses Vite Proxy -> /api)
// ============================================================================

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`
    try {
      const errJson = await res.json()
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail)
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail)
  }

  return res.json()
}

export const api = {
  /**
   * Fetches available policies, scenarios, default weights, and AI status.
   */
  getOptions(): Promise<OptionsResponse> {
    return fetchJson<OptionsResponse>(`${API_BASE}/options`)
  },

  /**
   * Runs a full discrete per-minute simulation.
   */
  simulate(req: SimulateRequest = {}): Promise<SimulateResponse> {
    return fetchJson<SimulateResponse>(`${API_BASE}/simulate`, {
      method: "POST",
      body: JSON.stringify(req),
    })
  },

  /**
   * Compares all four policies against a single identical arrival stream.
   */
  compare(req: CompareRequest = {}): Promise<CompareResponse> {
    return fetchJson<CompareResponse>(`${API_BASE}/compare`, {
      method: "POST",
      body: JSON.stringify(req),
    })
  },

  /**
   * Evaluates a single triage clinical note using GenAI (or rule fallback).
   */
  triage(req: TriageNoteRequest): Promise<TriageResponse> {
    return fetchJson<TriageResponse>(`${API_BASE}/triage`, {
      method: "POST",
      body: JSON.stringify(req),
    })
  },

  /**
   * Evaluates a batch of clinical triage notes (capped at 25 items).
   */
  triageBatch(req: TriageBatchRequest): Promise<TriageBatchResponse> {
    return fetchJson<TriageBatchResponse>(`${API_BASE}/triage/batch`, {
      method: "POST",
      body: JSON.stringify(req),
    })
  },

  /**
   * Checks whether the Groq API key is configured.
   */
  getAIStatus(): Promise<AIStatusResponse> {
    return fetchJson<AIStatusResponse>(`${API_BASE}/ai-status`)
  },

  /**
   * Service health check.
   */
  health(): Promise<{ status: string; groq_api_key_configured: boolean }> {
    return fetchJson<{ status: string; groq_api_key_configured: boolean }>("/health")
  },
}

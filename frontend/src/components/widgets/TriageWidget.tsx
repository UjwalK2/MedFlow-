import { useState } from "react"
import { Sparkles, Send, Stethoscope, Users, Clock, AlertCircle } from "lucide-react"
import { api, getESIConfig, type TriageResponse } from "@/api"
import { WidgetBig, WidgetDot, WidgetRow } from "@/components/ui/draggable-widget-grid"

export interface WaitingRoomCard {
  id: string
  note: string
  arrivalMinute: number
  arrivalTime: string
  esi: number
  deterioration_risk: "low" | "moderate" | "high"
  estimated_service_minutes: number
  required_resources: string[]
  rationale: string
  source: "model" | "rule_fallback"
  red_flags?: string[]
}

const PRESETS = [
  "58yo crushing chest pain, dyspneic",
  "Unresponsive trauma patient, agonal",
  "Severe lower quadrant abdominal pain",
  "Sore throat and mild cough x 2 days",
]

// Seed initial waiting room patients so the sidebar feels alive immediately
const INITIAL_WAITING_ROOM: WaitingRoomCard[] = [
  {
    id: "P-001",
    note: "42yo sudden onset severe headache, photophobia",
    arrivalMinute: 12,
    arrivalTime: "07:12 AM",
    esi: 2,
    deterioration_risk: "moderate",
    estimated_service_minutes: 45,
    required_resources: ["bed", "doctor", "nurse"],
    rationale: "Potential subarachnoid hemorrhage workup required immediately.",
    source: "rule_fallback",
  },
  {
    id: "P-002",
    note: "24yo laceration right forearm with active bleeding, controlled",
    arrivalMinute: 25,
    arrivalTime: "07:25 AM",
    esi: 4,
    deterioration_risk: "low",
    estimated_service_minutes: 20,
    required_resources: ["bed"],
    rationale: "Isolated minor trauma requiring primary closure and irrigation.",
    source: "rule_fallback",
  },
  {
    id: "P-003",
    note: "67yo persistent productive cough, fever 38.6C, SpO2 93%",
    arrivalMinute: 31,
    arrivalTime: "07:31 AM",
    esi: 3,
    deterioration_risk: "moderate",
    estimated_service_minutes: 35,
    required_resources: ["bed", "doctor"],
    rationale: "Community acquired pneumonia risk, supplemental O2 and chest x-ray indicated.",
    source: "rule_fallback",
  },
]

export function TriageWidget() {
  const [note, setNote] = useState("58yo crushing chest pain, dyspneic")
  const [result, setResult] = useState<TriageResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitingRoom, setWaitingRoom] = useState<WaitingRoomCard[]>(INITIAL_WAITING_ROOM)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [patientCounter, setPatientCounter] = useState(4)

  const handleTriage = async (textToTriage?: string) => {
    const query = textToTriage || note
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.triage({ note: query })
      setResult(res)

      // Format current timestamp
      const now = new Date()
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      const pid = `P-${String(patientCounter).padStart(3, "0")}`
      setPatientCounter((prev) => prev + 1)

      const newRecord: WaitingRoomCard = {
        id: pid,
        note: query,
        arrivalMinute: Math.floor(Math.random() * 45) + 35,
        arrivalTime: timeStr,
        esi: res.esi,
        deterioration_risk: res.deterioration_risk,
        estimated_service_minutes: res.estimated_service_minutes,
        required_resources: res.required_resources,
        rationale: res.rationale,
        source: res.source,
        red_flags: res.red_flags,
      }

      // Append evaluated patient record to the Live Waiting Room sidebar
      setWaitingRoom((prev) => [...prev, newRecord])
      setSelectedPatientId(newRecord.id)
    } catch (err: any) {
      setError(err.message || "Triage failed")
    } finally {
      setLoading(false)
    }
  }

  // Active displayed evaluation (either latest result or currently selected card)
  const activeRecord = selectedPatientId
    ? waitingRoom.find((p) => p.id === selectedPatientId)
    : null

  const displayESI = activeRecord ? activeRecord.esi : result ? result.esi : 2
  const esiConfig = getESIConfig(displayESI)

  const getBorderColor = (esi: number) => {
    switch (esi) {
      case 1:
        return "border-l-rose-500 bg-rose-950/25 hover:bg-rose-950/40"
      case 2:
        return "border-l-orange-500 bg-orange-950/20 hover:bg-orange-950/35"
      case 3:
        return "border-l-yellow-500 bg-yellow-950/15 hover:bg-yellow-950/30"
      case 4:
        return "border-l-emerald-500 bg-emerald-950/15 hover:bg-emerald-950/30"
      case 5:
        return "border-l-slate-500 bg-slate-900/30 hover:bg-slate-900/50"
      default:
        return "border-l-zinc-500 bg-zinc-900/40 hover:bg-zinc-800/60"
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 w-full">
      {/* ====================================================================
          LEFT: 70% Clinical Triage Intake & Assessment
         ==================================================================== */}
      <div className="lg:col-span-7 flex flex-col justify-between space-y-2.5">
        {/* Quick Input Bar & Presets */}
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTriage()}
              placeholder="Clinical intake triage note (e.g. chest pain, dyspnea, trauma)..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-background text-foreground placeholder:text-muted-foreground border border-input text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors"
            />
            <button
              onClick={() => handleTriage()}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer shadow-sm shadow-rose-600/20"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Evaluate
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex-shrink-0">
              Presets:
            </span>
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setNote(preset)
                  handleTriage(preset)
                }}
                className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 whitespace-nowrap transition-colors cursor-pointer"
              >
                {preset.split(",")[0]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-800/60 p-2 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Headline ESI Acuity Card */}
        <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-2">
          <WidgetBig
            label={activeRecord ? `Patient Assessment · ${activeRecord.id}` : "Clinical Acuity Assessment"}
            value={
              <span className="flex items-center gap-2">
                <span className={esiConfig.textClass}>{esiConfig.label}</span>
                <span className="text-lg font-medium text-zinc-300">({esiConfig.acuity})</span>
              </span>
            }
            badge={
              (activeRecord?.source || result?.source) === "model" ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 font-mono">
                  <Sparkles className="w-3 h-3 text-indigo-400" /> GenAI Model
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-mono">
                  <Stethoscope className="w-3 h-3 text-amber-400" /> Rule Fallback
                </span>
              )
            }
            subtext={`Target SLA Wait: ${esiConfig.targetWaitText}`}
          />

          {/* Clinical Supporting Rows */}
          <div className="space-y-0.5 pt-1 border-t border-zinc-800/60">
            <WidgetRow
              label="Deterioration Hazard"
              value={
                <span className="flex items-center gap-1.5 capitalize font-mono tabular-nums">
                  <WidgetDot
                    color={
                      (activeRecord?.deterioration_risk || result?.deterioration_risk) === "high"
                        ? "bg-rose-500"
                        : (activeRecord?.deterioration_risk || result?.deterioration_risk) === "moderate"
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }
                    pulse={(activeRecord?.deterioration_risk || result?.deterioration_risk) === "high"}
                  />
                  {(activeRecord?.deterioration_risk || result?.deterioration_risk || "moderate")} Risk
                </span>
              }
            />
            <WidgetRow
              label="Required Resource Bundle"
              value={
                <span className="font-mono tabular-nums">
                  {(activeRecord?.estimated_service_minutes || result?.estimated_service_minutes || 45)}m (
                  {(activeRecord?.required_resources || result?.required_resources || ["bed", "doctor"]).join(" + ")}
                  )
                </span>
              }
            />
            <WidgetRow
              label="Target Wait Window"
              value={
                <span className="font-mono tabular-nums text-indigo-400 font-semibold">
                  ≤ {esiConfig.targetWaitMinutes} min SLA
                </span>
              }
            />
            <div className="py-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-0.5">
                Clinical Rationale & Chief Complaint
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-2 rounded-lg border border-zinc-850">
                {activeRecord?.rationale ||
                  result?.rationale ||
                  "Acute presentation requiring continuous telemetry, immediate physician bedside evaluation, and intravenous line placement."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          RIGHT: 30% Live Waiting Room List
         ==================================================================== */}
      <div className="lg:col-span-3 flex flex-col bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-2.5 space-y-2">
        {/* Waiting Room Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80 select-none">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-white tracking-tight">Live Waiting Room</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono font-medium tabular-nums">
            {waitingRoom.length} Patients
          </span>
        </div>

        {/* Scrollable Patient Card List */}
        <div className="overflow-y-auto max-h-[360px] space-y-2 pr-0.5">
          {waitingRoom.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-xs">
              Waiting room is empty. Click Evaluate to admit patients.
            </div>
          ) : (
            waitingRoom.map((patient) => {
              const pEsiConfig = getESIConfig(patient.esi)
              const isSelected = selectedPatientId === patient.id
              const cardColorClass = getBorderColor(patient.esi)

              return (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={`border-l-4 rounded-r-lg p-2 transition-all cursor-pointer border-y border-r border-zinc-800/70 text-left ${cardColorClass} ${
                    isSelected ? "ring-1 ring-white/30 shadow-md" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-white tabular-nums">
                        {patient.id}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${pEsiConfig.badgeClass}`}
                      >
                        {pEsiConfig.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono tabular-nums flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {patient.arrivalTime}
                    </span>
                  </div>

                  {/* Patient Note snippet */}
                  <p className="text-[11px] text-zinc-200 line-clamp-1 mt-1 font-normal">
                    {patient.note}
                  </p>

                  {/* Card Footer: SLA target wait & resource bundle */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1.5 pt-1 border-t border-zinc-800/40">
                    <span className="font-mono tabular-nums text-zinc-300">
                      Target: &lt;{pEsiConfig.targetWaitText}
                    </span>
                    <span className="capitalize text-[9px] text-zinc-400 font-mono tabular-nums flex items-center gap-1">
                      <WidgetDot
                        color={
                          patient.deterioration_risk === "high"
                            ? "bg-rose-500"
                            : patient.deterioration_risk === "moderate"
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                        }
                      />
                      {patient.deterioration_risk} risk
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="text-[10px] text-zinc-500 text-center pt-1 border-t border-zinc-800/50">
          Click any card to inspect triage evaluation
        </div>
      </div>
    </div>
  )
}

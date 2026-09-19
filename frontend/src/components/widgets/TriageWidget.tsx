import { useState } from "react"
import { Sparkles, Send, Stethoscope } from "lucide-react"
import { api, getESIConfig, type TriageResponse } from "@/api"
import { WidgetBig, WidgetDot, WidgetRow, WidgetShell } from "@/components/ui/draggable-widget-grid"

const PRESETS = [
  "58yo crushing chest pain, dyspneic",
  "Unresponsive trauma patient, agonal",
  "Severe lower quadrant abdominal pain",
  "Sore throat and mild cough x 2 days",
]

export function TriageWidget() {
  const [note, setNote] = useState("58yo crushing chest pain, dyspneic")
  const [result, setResult] = useState<TriageResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTriage = async (textToTriage?: string) => {
    const query = textToTriage || note
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.triage({ note: query })
      setResult(res)
    } catch (err: any) {
      setError(err.message || "Triage failed")
    } finally {
      setLoading(false)
    }
  }

  const esiConfig = result ? getESIConfig(result.esi) : getESIConfig(2)

  return (
    <WidgetShell>
      {/* Quick Input Bar & Presets */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTriage()}
            placeholder="Clinical intake triage note..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-850 border border-zinc-750 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
          />
          <button
            onClick={() => handleTriage()}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0"
          >
            {loading ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Evaluate
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setNote(preset)
                handleTriage(preset)
              }}
              className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 whitespace-nowrap transition-colors"
            >
              {preset.split(",")[0]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-xs text-rose-400 py-1">{error}</div>}

      {/* 1 Headline Value / ESI Level */}
      <WidgetBig
        label="Triage Acuity Assessment"
        value={
          <span className="flex items-center gap-2">
            <span className={esiConfig.textClass}>{esiConfig.label}</span>
            <span className="text-lg font-medium text-zinc-300">({esiConfig.acuity})</span>
          </span>
        }
        badge={
          result?.source === "model" ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 font-mono">
              <Sparkles className="w-3 h-3" /> GenAI Model
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-mono">
              <Stethoscope className="w-3 h-3" /> Rule Fallback
            </span>
          )
        }
      />

      {/* Max 3 Supporting Lines */}
      <div className="space-y-1">
        <WidgetRow
          label="Deterioration Hazard"
          value={
            <span className="flex items-center gap-1.5 capitalize">
              <WidgetDot
                color={
                  result?.deterioration_risk === "high"
                    ? "bg-rose-500"
                    : result?.deterioration_risk === "moderate"
                    ? "bg-amber-400"
                    : "bg-emerald-400"
                }
              />
              {result?.deterioration_risk || "High"} Risk
            </span>
          }
        />
        <WidgetRow
          label="Required Resource Bundle"
          value={`${result?.estimated_service_minutes || 50}m (${(result?.required_resources || ["bed", "doctor"]).join(" + ")})`}
        />
        <WidgetRow
          label="Clinical Rationale"
          value={
            <span className="text-[11px] text-zinc-400 truncate max-w-[200px]" title={result?.rationale || "Chest pain protocol"}>
              {result?.rationale || "Acute coronary presentation requiring immediate telemetry."}
            </span>
          }
        />
      </div>
    </WidgetShell>
  )
}

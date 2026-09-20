import { useEffect, useState } from "react"
import { Cpu, Sparkles, ShieldCheck } from "lucide-react"
import { api, type AIStatusResponse } from "@/api"
import { WidgetBig, WidgetDot, WidgetRow, WidgetShell } from "@/components/ui/draggable-widget-grid"

export function AiStatusWidget() {
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAIStatus()
      .then((data) => {
        setAiStatus(data)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const isConfigured = aiStatus?.configured ?? false
  const modelName = aiStatus?.model ?? "llama-3.3-70b-versatile"

  return (
    <WidgetShell>
      {/* 1 Headline Value */}
      <WidgetBig
        label="Triage Decision Support Engine"
        value={
          <span className="flex items-center gap-2">
            {isConfigured ? (
              <>
                <span className="text-emerald-400">Groq Online</span>
              </>
            ) : (
              <>
                <span className="text-amber-400">Rule Fallback</span>
              </>
            )}
          </span>
        }
        subtext={
          isConfigured
            ? `Groq Llama Active (${modelName})`
            : "Deterministic clinical keyword triage active"
        }
        badge={
          isConfigured ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Connected
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              Resilient
            </span>
          )
        }
      />

      {/* Max 3 Supporting Lines */}
      <div className="space-y-1">
        <WidgetRow
          label="API Key Status"
          value={
            loading ? (
              <span className="text-zinc-500">Checking...</span>
            ) : isConfigured ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <WidgetDot color="bg-emerald-400" pulse />
                GROQ_API_KEY Configured
              </span>
            ) : (
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <WidgetDot color="bg-amber-400" />
                Unset (Local Rules Active)
              </span>
            )
          }
          icon={<Cpu className="w-3.5 h-3.5" />}
        />
        <WidgetRow
          label="Model Architecture"
          value={<span className="font-mono text-[11px] text-zinc-300">{modelName}</span>}
          dotColor="bg-indigo-400"
        />
        <WidgetRow
          label="Fallback Safety Guarantee"
          value={<span className="text-emerald-400 text-xs">100% Availability (Offline Safe)</span>}
          dotColor="bg-emerald-400"
        />
      </div>
    </WidgetShell>
  )
}

import { useState } from "react"
import { Play } from "lucide-react"
import { api, type OptionsResponse, type SimulateResponse } from "@/api"
import { WidgetBig, WidgetRow, WidgetShell } from "@/components/ui/draggable-widget-grid"

export function RunWidget({
  options,
  onSimulationComplete,
}: {
  options: OptionsResponse | null
  onSimulationComplete: (result: SimulateResponse) => void
}) {
  const [selectedScenario, setSelectedScenario] = useState("baseline")
  const [selectedPolicy, setSelectedPolicy] = useState("weighted_aging")
  const [seed, setSeed] = useState<number>(42)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.simulate({
        policy: selectedPolicy,
        scenario: selectedScenario,
        seed: seed,
        duration_minutes: 480,
      })
      onSimulationComplete(res)
    } catch (err: any) {
      setError(err.message || "Simulation failed")
    } finally {
      setLoading(false)
    }
  }

  const scenarioName =
    options?.scenarios.find((s) => s.id === selectedScenario)?.name || "Standard ED Flow"
  const policyName =
    options?.policies.find((p) => p.id === selectedPolicy)?.name.split("(")[0].trim() ||
    "Weighted Aging"

  return (
    <WidgetShell>
      {/* 1 Headline Value */}
      <WidgetBig
        label="Simulation Engine"
        value={scenarioName}
        subtext={`8-Hour Shift (480 min) — Policy: ${policyName}`}
        badge={
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
            Discrete Tick
          </span>
        }
      />

      {error && <div className="text-xs text-rose-400 py-1">{error}</div>}

      {/* Interactive Controls Bar */}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-zinc-850 border border-zinc-750 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
        >
          {(options?.scenarios || []).map((s) => (
            <option key={s.id} value={s.id} className="bg-white text-zinc-950 dark:bg-zinc-900 dark:text-zinc-100">
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={selectedPolicy}
          onChange={(e) => setSelectedPolicy(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-zinc-850 border border-zinc-750 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
        >
          {(options?.policies || []).map((p) => (
            <option key={p.id} value={p.id} className="bg-white text-zinc-950 dark:bg-zinc-900 dark:text-zinc-100">
              {p.name.split("(")[0]}
            </option>
          ))}
        </select>
      </div>

      {/* Max 3 Supporting Lines */}
      <div className="space-y-1">
        <WidgetRow
          label="Active Queuing Policy"
          value={<span className="text-indigo-400 font-semibold">{policyName}</span>}
          dotColor="bg-indigo-400"
        />
        <WidgetRow
          label="Random Seed (NHPP)"
          value={
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="w-14 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[11px] text-right font-mono"
              />
              <span className="text-[10px] text-zinc-500">Fixed</span>
            </div>
          }
        />
        <WidgetRow
          label="Execution Status"
          value={
            <button
              onClick={handleRun}
              disabled={loading}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/20"
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-white" />
                  Run Shift
                </>
              )}
            </button>
          }
        />
      </div>
    </WidgetShell>
  )
}

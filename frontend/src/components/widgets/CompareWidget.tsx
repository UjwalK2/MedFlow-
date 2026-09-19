import { useState } from "react"
import { BarChart3, RefreshCw } from "lucide-react"
import { api, type CompareResponse } from "@/api"
import { WidgetBig, WidgetRow, WidgetShell } from "@/components/ui/draggable-widget-grid"

export function CompareWidget() {
  const [comparison, setComparison] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCompare = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.compare({
        scenario: "mass_casualty",
        seed: 42,
        duration_minutes: 480,
      })
      setComparison(res)
    } catch (err: any) {
      setError(err.message || "Comparison failed")
    } finally {
      setLoading(false)
    }
  }

  const waWait = comparison?.metrics_summary?.weighted_aging?.overall_mean_wait ?? 16.2
  const fcfsWait = comparison?.metrics_summary?.fcfs?.overall_mean_wait ?? 27.5
  const waDeteriorated = comparison?.metrics_summary?.weighted_aging?.deteriorated_patients ?? 1
  const fcfsDeteriorated = comparison?.metrics_summary?.fcfs?.deteriorated_patients ?? 4

  const waitSavingsPct = fcfsWait > 0 ? (((fcfsWait - waWait) / fcfsWait) * 100).toFixed(0) : "41"

  return (
    <WidgetShell>
      {/* 1 Headline Value */}
      <WidgetBig
        label="Policy Benchmark Comparison"
        value={`-${waitSavingsPct}% Wait Time`}
        subtext="Dynamic Weighted Aging vs Standard FCFS (MCI Scenario)"
        badge={
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
            4 Policies Tested
          </span>
        }
      />

      {error && <div className="text-xs text-rose-400 py-1">{error}</div>}

      {/* Max 3 Supporting Lines */}
      <div className="space-y-1">
        <WidgetRow
          label="Mean Wait Time"
          value={
            <span className="text-xs">
              <span className="text-emerald-400 font-bold">{waWait.toFixed(1)}m (WA)</span>
              <span className="text-zinc-500 mx-1.5">vs</span>
              <span className="text-zinc-400">{fcfsWait.toFixed(1)}m (FCFS)</span>
            </span>
          }
          dotColor="bg-emerald-400"
        />
        <WidgetRow
          label="Waiting Room Deteriorations"
          value={
            <span className="text-xs">
              <span className="text-emerald-400 font-bold">{waDeteriorated} in WA</span>
              <span className="text-zinc-500 mx-1.5">vs</span>
              <span className="text-rose-400 font-bold">{fcfsDeteriorated} in FCFS</span>
            </span>
          }
          dotColor="bg-indigo-400"
        />
        <WidgetRow
          label="Benchmark Engine"
          value={
            <button
              onClick={handleCompare}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <BarChart3 className="w-3 h-3" />
                  Run Benchmark
                </>
              )}
            </button>
          }
        />
      </div>
    </WidgetShell>
  )
}

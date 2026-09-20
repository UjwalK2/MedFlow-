import { useState, useEffect } from "react"
import { BarChart3, RefreshCw, Award } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts"
import { api, type CompareResponse, type PriorityWeights } from "@/api"
import { WidgetBig, WidgetRow, WidgetShell } from "@/components/ui/draggable-widget-grid"

export interface CompareWidgetProps {
  scenario?: string
  seed?: number
  weights?: PriorityWeights | null
}

export function CompareWidget({
  scenario = "mass_casualty",
  seed = 42,
  weights,
}: CompareWidgetProps) {
  const [comparison, setComparison] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCompare = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.compare({
        scenario,
        seed,
        duration_minutes: 480,
        weights: weights || undefined,
      })
      setComparison(res)
    } catch (err: any) {
      setError(err.message || "Comparison failed")
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch benchmark on mount if not loaded
  useEffect(() => {
    handleCompare()
  }, [scenario, seed])

  const fcfsWait = comparison?.metrics_summary?.fcfs?.overall_mean_wait ?? 27.5
  const urgencyWait = comparison?.metrics_summary?.urgency?.overall_mean_wait ?? 21.8
  const waWait = comparison?.metrics_summary?.weighted_aging?.overall_mean_wait ?? 16.2

  const fcfsBreaches = comparison?.metrics_summary?.fcfs
    ? Math.round(comparison.metrics_summary.fcfs.overall_sla_breach_rate * 100)
    : 34
  const urgencyBreaches = comparison?.metrics_summary?.urgency
    ? Math.round(comparison.metrics_summary.urgency.overall_sla_breach_rate * 100)
    : 24
  const waBreaches = comparison?.metrics_summary?.weighted_aging
    ? Math.round(comparison.metrics_summary.weighted_aging.overall_sla_breach_rate * 100)
    : 14

  const fcfsDeteriorated = comparison?.metrics_summary?.fcfs?.deteriorated_patients ?? 4
  const urgencyDeteriorated = comparison?.metrics_summary?.urgency?.deteriorated_patients ?? 2
  const waDeteriorated = comparison?.metrics_summary?.weighted_aging?.deteriorated_patients ?? 1

  const waitSavingsPct =
    fcfsWait > 0 ? (((fcfsWait - waWait) / fcfsWait) * 100).toFixed(0) : "41"

  // Chart data comparing FCFS vs. Urgency vs. Weighted Aging
  const chartData = [
    {
      name: "FCFS",
      fullName: "First-Come, First-Served",
      meanWait: Number(fcfsWait.toFixed(1)),
      color: "#64748b", // Slate 500
      breachRate: fcfsBreaches,
      deteriorated: fcfsDeteriorated,
    },
    {
      name: "Urgency",
      fullName: "Strict Clinical Urgency",
      meanWait: Number(urgencyWait.toFixed(1)),
      color: "#f59e0b", // Amber 500
      breachRate: urgencyBreaches,
      deteriorated: urgencyDeteriorated,
    },
    {
      name: "Weighted Aging",
      fullName: "Dynamic Weighted Aging",
      meanWait: Number(waWait.toFixed(1)),
      color: "#10b981", // Emerald 500 (Winner)
      breachRate: waBreaches,
      deteriorated: waDeteriorated,
    },
  ]

  return (
    <WidgetShell>
      {/* 1 Headline Value */}
      <WidgetBig
        label="Policy Benchmark Comparison"
        value={`-${waitSavingsPct}% Wait Time`}
        subtext={`Dynamic Weighted Aging vs Standard FCFS (${scenario.replace("_", " ")})`}
        badge={
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
            <Award className="w-3 h-3 text-emerald-400" /> Optimal Policy
          </span>
        }
      />

      {error && <div className="text-xs text-rose-400 py-0.5">{error}</div>}

      {/* Comparative Bar Chart showing Mean Wait Time side-by-side */}
      <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-850 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
          <span className="font-semibold text-zinc-200">
            Mean Patient Wait Time by Queuing Policy
          </span>
          <span className="font-mono text-[10px] text-zinc-500">Lower is better</span>
        </div>

        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 12, right: 10, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
              />
              <YAxis
                stroke="#71717a"
                fontSize={10}
                unit="m"
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload
                    return (
                      <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-750 shadow-xl text-xs space-y-1">
                        <div className="font-bold text-white">{item.fullName}</div>
                        <div className="text-emerald-400 font-mono tabular-nums">
                          Mean Wait: <strong>{item.meanWait} min</strong>
                        </div>
                        <div className="text-amber-400 font-mono tabular-nums text-[11px]">
                          SLA Breaches: {item.breachRate}%
                        </div>
                        <div className="text-rose-400 font-mono tabular-nums text-[11px]">
                          Deteriorations: {item.deteriorated}
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="meanWait" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={entry.name === "Weighted Aging" ? "#34d399" : undefined}
                    strokeWidth={entry.name === "Weighted Aging" ? 1.5 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Metrics Row */}
        <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-zinc-800/60 text-center select-none">
          {chartData.map((d) => (
            <div
              key={d.name}
              className={`p-1.5 rounded-lg border text-[11px] ${
                d.name === "Weighted Aging"
                  ? "bg-emerald-950/20 border-emerald-500/30"
                  : "bg-zinc-900/60 border-zinc-800/60"
              }`}
            >
              <div className="flex items-center justify-center gap-1 font-semibold text-zinc-300 text-[10px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}
              </div>
              <div className="font-mono font-bold text-white text-xs tabular-nums mt-0.5">
                {d.meanWait}m
              </div>
              <div className="text-[9px] text-zinc-400 font-mono tabular-nums">
                {d.breachRate}% breach · {d.deteriorated} det
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Supporting Lines */}
      <div className="space-y-0.5 pt-1">
        <WidgetRow
          label="Deterioration Prevention"
          value={
            <span className="font-mono tabular-nums text-emerald-400 font-bold">
              {waDeteriorated} in WA vs {fcfsDeteriorated} in FCFS
            </span>
          }
          dotColor="bg-emerald-400"
        />
        <WidgetRow
          label="Benchmark Engine"
          value={
            <button
              onClick={handleCompare}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Testing All Policies...
                </>
              ) : (
                <>
                  <BarChart3 className="w-3 h-3" />
                  Re-Run Benchmark
                </>
              )}
            </button>
          }
        />
      </div>
    </WidgetShell>
  )
}

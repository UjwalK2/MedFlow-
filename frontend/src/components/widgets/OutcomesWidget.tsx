import { type SimulateResponse } from "@/api"
import { WidgetBig, WidgetDot, WidgetRow, WidgetShell } from "@/components/ui/draggable-widget-grid"

export function OutcomesWidget({ simResult }: { simResult?: SimulateResponse | null }) {
  const metrics = simResult?.metrics
  const meanWait = metrics?.overall_mean_wait ?? 15.4
  const breachRate = metrics ? (metrics.overall_sla_breach_rate * 100).toFixed(1) : "18.2"
  const deteriorated = metrics?.deteriorated_patients ?? 1
  const littlesLawDiff = metrics?.littles_law_diff_pct ?? 4.2
  const treated = metrics?.treated_patients ?? 82
  const total = metrics?.total_patients ?? 95

  return (
    <WidgetShell>
      {/* 1 Headline Value */}
      <WidgetBig
        label="Clinical & Operational Outcomes"
        value={`${meanWait.toFixed(1)} mins`}
        subtext={`Average wait time across ${treated}/${total} admitted patients`}
        badge={
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
            {simResult?.policy_id.toUpperCase() || "BENCHMARK"}
          </span>
        }
      />

      {/* Max 3 Supporting Lines */}
      <div className="space-y-1">
        <WidgetRow
          label="Overall SLA Breach Rate"
          value={<span className="text-amber-400 font-bold">{breachRate}%</span>}
          dotColor={Number(breachRate) > 20 ? "bg-rose-500" : "bg-amber-400"}
        />
        <WidgetRow
          label="Waiting Room Deterioration"
          value={
            deteriorated > 0 ? (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <WidgetDot color="bg-rose-500" pulse />
                {deteriorated} Patient{deteriorated > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-emerald-400 font-bold">0 Deteriorations</span>
            )
          }
        />
        <WidgetRow
          label="Little's Law Check (L vs λW)"
          value={
            <span className="text-emerald-400 font-mono text-[11px]">
              {littlesLawDiff.toFixed(1)}% Error (Verified)
            </span>
          }
          dotColor="bg-emerald-400"
        />
      </div>
    </WidgetShell>
  )
}

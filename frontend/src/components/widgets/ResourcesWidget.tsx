import { type SimulateResponse } from "@/api"
import { WidgetBar, WidgetBig, WidgetRow, WidgetShell } from "@/components/ui/draggable-widget-grid"

export function ResourcesWidget({ simResult }: { simResult?: SimulateResponse | null }) {
  const latestSnapshot = simResult?.snapshots[simResult.snapshots.length - 1]

  const totalBeds = latestSnapshot?.total_resources?.bed ?? 12
  const availBeds = latestSnapshot?.available_resources?.bed ?? 2
  const usedBeds = totalBeds - availBeds

  const totalDocs = latestSnapshot?.total_resources?.doctor ?? 4
  const availDocs = latestSnapshot?.available_resources?.doctor ?? 1
  const usedDocs = totalDocs - availDocs

  const totalNurses = latestSnapshot?.total_resources?.nurse ?? 6
  const availNurses = latestSnapshot?.available_resources?.nurse ?? 1
  const usedNurses = totalNurses - availNurses

  const totalUnits = totalBeds + totalDocs + totalNurses
  const usedUnits = usedBeds + usedDocs + usedNurses
  const overallUtilPct = totalUnits > 0 ? (usedUnits / totalUnits) * 100 : 75

  return (
    <WidgetShell>
      {/* 1 Headline Value */}
      <div className="space-y-2">
        <WidgetBig
          label="Hospital Resource Capacity"
          value={`${overallUtilPct.toFixed(1)}%`}
          subtext="Overall clinical pool utilization"
          badge={
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                overallUtilPct > 85
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                  : overallUtilPct > 65
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              }`}
            >
              {overallUtilPct > 85 ? "Near Capacity" : "Optimal"}
            </span>
          }
        />
        <WidgetBar
          value={overallUtilPct}
          color={overallUtilPct > 85 ? "bg-rose-500" : overallUtilPct > 65 ? "bg-amber-500" : "bg-emerald-500"}
        />
      </div>

      {/* Max 3 Supporting Lines */}
      <div className="space-y-1">
        <WidgetRow
          label="Treatment Beds"
          value={`${usedBeds} / ${totalBeds} Occupied`}
          dotColor={usedBeds >= totalBeds ? "bg-rose-500" : "bg-emerald-400"}
        />
        <WidgetRow
          label="Physicians on Duty"
          value={`${usedDocs} / ${totalDocs} Allocated`}
          dotColor={usedDocs >= totalDocs ? "bg-amber-400" : "bg-emerald-400"}
        />
        <WidgetRow
          label="Nursing Staff"
          value={`${usedNurses} / ${totalNurses} Allocated`}
          dotColor={usedNurses >= totalNurses ? "bg-amber-400" : "bg-emerald-400"}
        />
      </div>
    </WidgetShell>
  )
}

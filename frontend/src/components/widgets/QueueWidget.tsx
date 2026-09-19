import { ESI_COLORS, type SimulateResponse } from "@/api"
import { WidgetBig, WidgetDot, WidgetRow, WidgetShell } from "@/components/ui/draggable-widget-grid"

export function QueueWidget({ simResult }: { simResult?: SimulateResponse | null }) {
  // Use latest snapshot or compute queue statistics
  const latestSnapshot = simResult?.snapshots[simResult.snapshots.length - 1]
  const waitingCount = latestSnapshot?.waiting_count ?? 14

  // Count by ESI in current waiting queue
  const queuePatients = latestSnapshot?.queue || []
  const esiCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let maxWait = 0
  let slaBreachCount = 0

  if (queuePatients.length > 0) {
    for (const p of queuePatients) {
      esiCounts[p.esi] = (esiCounts[p.esi] || 0) + 1
      if (p.wait_time > maxWait) maxWait = p.wait_time
      if (p.sla_breached) slaBreachCount++
    }
  } else {
    // Default preview counts
    esiCounts[1] = 1
    esiCounts[2] = 3
    esiCounts[3] = 6
    esiCounts[4] = 3
    esiCounts[5] = 1
    maxWait = 34.5
    slaBreachCount = 2
  }

  return (
    <WidgetShell>
      {/* 1 Headline Value */}
      <WidgetBig
        label="Waiting Room Population"
        value={`${waitingCount} Patients`}
        subtext={simResult ? `At simulation minute ${latestSnapshot?.minute || 0}` : "Active triage queue depth"}
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
            {slaBreachCount} in SLA breach
          </span>
        }
      />

      {/* Max 3 Supporting Lines */}
      <div className="space-y-1">
        <WidgetRow
          label="Acuity Distribution"
          value={
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((esi) => (
                <span key={esi} className="flex items-center gap-1 text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${ESI_COLORS[esi].dotClass}`} />
                  <span className="font-semibold text-zinc-200">{esiCounts[esi]}</span>
                </span>
              ))}
            </div>
          }
        />
        <WidgetRow
          label="Longest Elapsed Wait"
          value={<span className="text-amber-400 font-bold">{maxWait.toFixed(1)} mins</span>}
          dotColor="bg-amber-400"
        />
        <WidgetRow
          label="SLA Compliance Status"
          value={
            slaBreachCount > 0 ? (
              <span className="flex items-center gap-1 text-rose-400">
                <WidgetDot color="bg-rose-500" pulse />
                {slaBreachCount} Active Breaches
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400">
                <WidgetDot color="bg-emerald-400" />
                All Within SLA
              </span>
            )
          }
        />
      </div>
    </WidgetShell>
  )
}

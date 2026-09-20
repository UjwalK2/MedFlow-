import { Sliders, Info } from "lucide-react"
import { type OptionsResponse } from "@/api"
import { WidgetBig, WidgetRow, WidgetShell } from "@/components/ui/draggable-widget-grid"

export interface RunWidgetProps {
  options: OptionsResponse | null
  selectedScenario: string
  setSelectedScenario: (val: string) => void
  selectedPolicy: string
  setSelectedPolicy: (val: string) => void
  seed: number
  setSeed: (val: number) => void
}

export function RunWidget({
  options,
  selectedScenario,
  setSelectedScenario,
  selectedPolicy,
  setSelectedPolicy,
  seed,
  setSeed,
}: RunWidgetProps) {
  const scenarioName =
    options?.scenarios.find((s) => s.id === selectedScenario)?.name || "Standard ED Flow"
  const policyObj = options?.policies.find((p) => p.id === selectedPolicy)
  const policyName = policyObj?.name.split("(")[0].trim() || "Weighted Aging"

  return (
    <WidgetShell>
      {/* 1 Headline Value */}
      <WidgetBig
        label="Priority & Setup"
        value={scenarioName}
        subtext={`8-Hour Shift (480 min) — Policy: ${policyName}`}
        badge={
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
            Configured
          </span>
        }
      />

      {/* One-line explanation of what happens next */}
      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-zinc-850/80 border border-zinc-800 text-xs text-zinc-300">
        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Configure ED arrival volume and queuing priority weights below. Next, you will launch the 8-hour simulation to inspect live queue states and resource allocations.
        </p>
      </div>

      {/* Interactive Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-zinc-400">Arrival Scenario</label>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-background text-foreground border border-input text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors"
          >
            {(options?.scenarios || []).map((s) => (
              <option key={s.id} value={s.id} className="bg-background text-foreground">
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-zinc-400">Queuing Policy</label>
          <select
            value={selectedPolicy}
            onChange={(e) => setSelectedPolicy(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-background text-foreground border border-input text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors"
          >
            {(options?.policies || []).map((p) => (
              <option key={p.id} value={p.id} className="bg-background text-foreground">
                {p.name.split("(")[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Max 3 Supporting Lines */}
      <div className="space-y-1 pt-1">
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
                className="w-16 px-1.5 py-0.5 rounded-lg bg-background text-foreground placeholder:text-muted-foreground border border-input text-[11px] text-right font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              />
              <span className="text-[10px] text-zinc-500">Fixed</span>
            </div>
          }
        />
        <WidgetRow
          label="Simulation Ready"
          value={<span className="text-emerald-400 text-xs font-medium">Ready to Execute</span>}
          icon={<Sliders className="w-3.5 h-3.5" />}
        />
      </div>
    </WidgetShell>
  )
}


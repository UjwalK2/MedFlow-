import { Sliders, RotateCcw, Sparkles, Scale } from "lucide-react"
import { type OptionsResponse, type PriorityWeights } from "@/api"
import { WidgetBig, WidgetRow, WidgetShell } from "@/components/ui/draggable-widget-grid"

export interface RunWidgetProps {
  options: OptionsResponse | null
  selectedScenario: string
  setSelectedScenario: (val: string) => void
  selectedPolicy: string
  setSelectedPolicy: (val: string) => void
  seed: number
  setSeed: (val: number) => void
  weights: PriorityWeights
  setWeights: React.Dispatch<React.SetStateAction<PriorityWeights>>
}

const DEFAULT_WEIGHTS: PriorityWeights = {
  w_u: 0.35,
  w_w: 0.30,
  w_r: 0.25,
  w_f: 0.10,
  alpha: 1.8,
}

const WEIGHT_PRESETS: { name: string; weights: PriorityWeights; description: string }[] = [
  {
    name: "Balanced Default",
    weights: { w_u: 0.35, w_w: 0.30, w_r: 0.25, w_f: 0.10, alpha: 1.8 },
    description: "Equitable balance between high acuity safety and wait time saturation",
  },
  {
    name: "Anti-Starvation",
    weights: { w_u: 0.20, w_w: 0.50, w_r: 0.20, w_f: 0.10, alpha: 1.8 },
    description: "Stronger wait aging penalty to prevent lower acuity patients from starving",
  },
  {
    name: "Critical Resuscitation",
    weights: { w_u: 0.55, w_w: 0.15, w_r: 0.25, w_f: 0.05, alpha: 1.8 },
    description: "Dominant clinical urgency weight for mass casualty or trauma center",
  },
  {
    name: "Bed/Staff Fit",
    weights: { w_u: 0.25, w_w: 0.25, w_r: 0.20, w_f: 0.30, alpha: 1.8 },
    description: "Maximizes ED throughput by prioritizing patients with ready resource bundles",
  },
]

export function RunWidget({
  options,
  selectedScenario,
  setSelectedScenario,
  selectedPolicy,
  setSelectedPolicy,
  seed,
  setSeed,
  weights,
  setWeights,
}: RunWidgetProps) {
  const scenarioName =
    options?.scenarios.find((s) => s.id === selectedScenario)?.name || "Standard ED Flow"
  const policyObj = options?.policies.find((p) => p.id === selectedPolicy)
  const policyName = policyObj?.name.split("(")[0].trim() || "Dynamic Weighted Aging"

  const isWeightedAging = selectedPolicy === "weighted_aging"
  const weightSum = weights.w_u + weights.w_w + weights.w_r + weights.w_f

  const handleSliderChange = (key: keyof PriorityWeights, value: number) => {
    setWeights((prev) => ({
      ...prev,
      [key]: Math.round(value * 100) / 100,
    }))
  }

  const handleNormalize = () => {
    if (weightSum === 0) return
    setWeights((prev) => ({
      ...prev,
      w_u: Math.round((prev.w_u / weightSum) * 100) / 100,
      w_w: Math.round((prev.w_w / weightSum) * 100) / 100,
      w_r: Math.round((prev.w_r / weightSum) * 100) / 100,
      w_f: Math.round((prev.w_f / weightSum) * 100) / 100,
    }))
  }

  return (
    <WidgetShell>
      {/* 1 Headline Value */}
      <WidgetBig
        label="Priority & Queue Policy Setup"
        value={scenarioName}
        subtext={`8-Hour Shift (480 min) — Policy: ${policyName}`}
        badge={
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
            Configured
          </span>
        }
      />

      {/* Interactive Scenario & Policy Dropdowns Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
            Arrival Scenario
          </label>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-background text-foreground border border-input text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors cursor-pointer"
          >
            {(options?.scenarios || []).map((s) => (
              <option key={s.id} value={s.id} className="bg-background text-foreground">
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
            Queuing Policy
          </label>
          <select
            value={selectedPolicy}
            onChange={(e) => setSelectedPolicy(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-background text-foreground border border-input text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors cursor-pointer font-semibold"
          >
            {(options?.policies || []).map((p) => (
              <option key={p.id} value={p.id} className="bg-background text-foreground">
                {p.name.split("(")[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ====================================================================
          MATHEMATICAL WEIGHTS TUNING PANEL (Rendered when Weighted Aging selected)
         ==================================================================== */}
      {isWeightedAging && (
        <div className="p-3 rounded-xl bg-zinc-900/90 border border-indigo-500/30 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-indigo-400" />
                <h4 className="text-xs font-bold text-white tracking-tight">
                  Dynamic Priority Mathematical Weights
                </h4>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  P(p, t) Tuning
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Adjust multi-factor coefficient weights to control ranking between acuity, wait times, risk, and resource fit.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`text-[10px] font-mono tabular-nums px-2 py-0.5 rounded border ${
                  Math.abs(weightSum - 1.0) < 0.05
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                }`}
              >
                Σ Weights = {weightSum.toFixed(2)}
              </span>
              <button
                onClick={handleNormalize}
                title="Normalize weights to sum to 1.0"
                className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
              >
                Normalize
              </button>
              <button
                onClick={() => setWeights(DEFAULT_WEIGHTS)}
                title="Reset to default weights"
                className="p-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* 4 Interactive Range Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* 1. Acuity (w_u) */}
            <div className="p-2.5 rounded-lg bg-zinc-850/60 border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Clinical Acuity (w_u)
                </label>
                <span className="font-mono text-xs font-bold text-rose-400 tabular-nums bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                  {weights.w_u.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={weights.w_u}
                onChange={(e) => handleSliderChange("w_u", parseFloat(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg appearance-none"
              />
              <p className="text-[10px] text-zinc-400 leading-tight">
                Prioritizes high-acuity resuscitation patients (ESI 1–2).
              </p>
            </div>

            {/* 2. Wait Time Saturation (w_w) */}
            <div className="p-2.5 rounded-lg bg-zinc-850/60 border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Wait Time Saturation (w_w)
                </label>
                <span className="font-mono text-xs font-bold text-amber-400 tabular-nums bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {weights.w_w.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={weights.w_w}
                onChange={(e) => handleSliderChange("w_w", parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-700 rounded-lg appearance-none"
              />
              <p className="text-[10px] text-zinc-400 leading-tight">
                Accelerates priority as wait time approaches ESI SLA deadline.
              </p>
            </div>

            {/* 3. Deterioration Risk (w_r) */}
            <div className="p-2.5 rounded-lg bg-zinc-850/60 border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  Deterioration Risk (w_r)
                </label>
                <span className="font-mono text-xs font-bold text-indigo-400 tabular-nums bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  {weights.w_r.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={weights.w_r}
                onChange={(e) => handleSliderChange("w_r", parseFloat(e.target.value))}
                className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-zinc-700 rounded-lg appearance-none"
              />
              <p className="text-[10px] text-zinc-400 leading-tight">
                Escalates patients whose condition risk is exponentially worsening.
              </p>
            </div>

            {/* 4. Resource Fit (w_f) */}
            <div className="p-2.5 rounded-lg bg-zinc-850/60 border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Resource Fit (w_f)
                </label>
                <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  {weights.w_f.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={weights.w_f}
                onChange={(e) => handleSliderChange("w_f", parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-zinc-700 rounded-lg appearance-none"
              />
              <p className="text-[10px] text-zinc-400 leading-tight">
                Favors patients whose complete bed and staffing bundle is ready.
              </p>
            </div>
          </div>

          {/* Quick Presets Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-zinc-800/60">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Presets:
            </span>
            {WEIGHT_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => setWeights(preset.weights)}
                className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors cursor-pointer flex items-center gap-1"
                title={preset.description}
              >
                <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                {preset.name}
              </button>
            ))}
          </div>

          {/* Formula Callout */}
          <div className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-850 text-[11px] font-mono text-zinc-300 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-zinc-500">Formula: </span>
              <span className="text-white font-semibold">P(p,t)</span> = Floor +{" "}
              <span className="text-rose-400 font-bold">{weights.w_u.toFixed(2)}</span>·Urgency +{" "}
              <span className="text-amber-400 font-bold">{weights.w_w.toFixed(2)}</span>·Wait<sup>1.8</sup> +{" "}
              <span className="text-indigo-400 font-bold">{weights.w_r.toFixed(2)}</span>·Risk +{" "}
              <span className="text-emerald-400 font-bold">{weights.w_f.toFixed(2)}</span>·Fit
            </div>
            <span className="text-[10px] text-zinc-400 font-sans">
              Bounded in [0, 3.0]
            </span>
          </div>
        </div>
      )}

      {/* Max 3 Supporting Lines */}
      <div className="space-y-0.5 pt-1">
        <WidgetRow
          label="Active Queuing Policy"
          value={<span className="text-indigo-400 font-semibold">{policyName}</span>}
          dotColor="bg-indigo-400"
        />
        <WidgetRow
          label="Random Seed (NHPP Arrival Stream)"
          value={
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="w-16 px-1.5 py-0.5 rounded bg-background text-foreground border border-input text-[11px] text-right font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              />
              <span className="text-[10px] text-zinc-500">Reproducible</span>
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

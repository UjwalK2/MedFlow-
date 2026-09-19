import { useEffect, useState } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  BrainCircuit,
  Building2,
  Cpu,
  Layers,
  Sparkles,
  Users,
  Play,
} from "lucide-react"
import { api, type OptionsResponse, type SimulateResponse } from "@/api"
import { DraggableWidgetGrid, type GridItem } from "@/components/ui/draggable-widget-grid"
import { TriageWidget } from "@/components/widgets/TriageWidget"
import { QueueWidget } from "@/components/widgets/QueueWidget"
import { ResourcesWidget } from "@/components/widgets/ResourcesWidget"
import { RunWidget } from "@/components/widgets/RunWidget"
import { OutcomesWidget } from "@/components/widgets/OutcomesWidget"
import { CompareWidget } from "@/components/widgets/CompareWidget"
import { AiStatusWidget } from "@/components/widgets/AiStatusWidget"

export default function App() {
  const [options, setOptions] = useState<OptionsResponse | null>(null)
  const [simResult, setSimResult] = useState<SimulateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Initial fetch of options and baseline simulation
    Promise.all([
      api.getOptions(),
      api.simulate({ policy: "weighted_aging", scenario: "baseline", seed: 42, duration_minutes: 480 }),
    ])
      .then(([optsData, simData]) => {
        setOptions(optsData)
        setSimResult(simData)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || "Failed to initialize MedFlow engine")
        setLoading(false)
      })
  }, [])

  // Seven Widget Items Configuration
  const widgetItems: GridItem[] = [
    {
      id: "run-widget",
      title: "Simulation Launcher",
      subtitle: "Scenario & Queuing Policies",
      icon: <Play className="w-4 h-4 text-rose-400" />,
      colSpan: 1,
      content: <RunWidget options={options} onSimulationComplete={(res) => setSimResult(res)} />,
    },
    {
      id: "triage-widget",
      title: "Clinical AI Triage",
      subtitle: "Gemini Clinical Decision Support",
      icon: <BrainCircuit className="w-4 h-4 text-indigo-400" />,
      colSpan: 1,
      content: <TriageWidget />,
    },
    {
      id: "queue-widget",
      title: "Waiting Room & Queue",
      subtitle: "Live Acuity Depth & SLA Clocks",
      icon: <Users className="w-4 h-4 text-amber-400" />,
      colSpan: 1,
      content: <QueueWidget simResult={simResult} />,
    },
    {
      id: "resources-widget",
      title: "Resource Pool Allocation",
      subtitle: "Beds, Physicians & Nursing Staff",
      icon: <Building2 className="w-4 h-4 text-emerald-400" />,
      colSpan: 1,
      content: <ResourcesWidget simResult={simResult} />,
    },
    {
      id: "outcomes-widget",
      title: "Operational Outcomes",
      subtitle: "Mean Wait, SLA Breaches & Deterioration",
      icon: <BarChart3 className="w-4 h-4 text-blue-400" />,
      colSpan: 1,
      content: <OutcomesWidget simResult={simResult} />,
    },
    {
      id: "compare-widget",
      title: "Policy Benchmarking",
      subtitle: "Multi-Policy Fair Comparison",
      icon: <Layers className="w-4 h-4 text-purple-400" />,
      colSpan: 1,
      content: <CompareWidget />,
    },
    {
      id: "ai-status-widget",
      title: "AI Engine Health",
      subtitle: "Gemini Integration & Fallback State",
      icon: <Bot className="w-4 h-4 text-emerald-400" />,
      colSpan: 1,
      content: <AiStatusWidget />,
    },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-rose-500/30">
      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/75 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              MedFlow Command Center
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-medium">
                Live Engine
              </span>
            </h1>
            <p className="text-xs text-zinc-400">Intelligent Emergency Department Queue & Triage Platform</p>
          </div>
        </div>

        {/* Global Status Chip */}
        <div className="flex items-center gap-3">
          {options?.ai_status ? (
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-zinc-850 border border-zinc-800 text-zinc-300">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Engine:</span>
              {options.ai_status.configured ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Gemini ({options.ai_status.model})
                </span>
              ) : (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Rule Fallback
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-ping" />
              Connecting to backend...
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 flex items-center gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Draggable Command Center Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 font-medium tracking-wide">
              Drag and rearrange cards to customize your command center layout.
            </p>
            {loading && (
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-zinc-500/30 border-t-zinc-400 rounded-full animate-spin" />
                Updating simulation...
              </span>
            )}
          </div>

          <DraggableWidgetGrid
            items={widgetItems}
            renderItem={(item) => item.content}
            columns={2}
            allowReorder={true}
            allowMinimize={true}
            allowHide={true}
            showControls={true}
          />
        </section>
      </main>
    </div>
  )
}

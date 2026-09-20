import { useEffect, useState, useRef } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Cpu,
  Layers,
  Sparkles,
  Play,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Lock,
  X,
} from "lucide-react"
import {
  api,
  type OptionsResponse,
  type SimulateResponse,
  type AIStatusResponse,
  type PriorityWeights,
} from "@/api"
import { DraggableWidgetGrid, type GridItem, WidgetDot, WidgetRow } from "@/components/ui/draggable-widget-grid"
import { TriageWidget } from "@/components/widgets/TriageWidget"
import { RunWidget } from "@/components/widgets/RunWidget"
import { TrackBoardWidget } from "@/components/widgets/TrackBoardWidget"
import { OutcomesWidget } from "@/components/widgets/OutcomesWidget"
import { CompareWidget } from "@/components/widgets/CompareWidget"

const STEPS = [
  { id: "triage", stepNumber: 1, label: "Triage", subtitle: "Clinical AI & Waiting Room", icon: BrainCircuit },
  { id: "setup", stepNumber: 2, label: "Setup", subtitle: "Priority & Math Weights", icon: Layers },
  { id: "run", stepNumber: 3, label: "Run", subtitle: "Track Board & Gauges", icon: Play },
  { id: "results", stepNumber: 4, label: "Results", subtitle: "Recharts & Little's Law", icon: BarChart3 },
]

const DEFAULT_WEIGHTS: PriorityWeights = {
  w_u: 0.35,
  w_w: 0.30,
  w_r: 0.25,
  w_f: 0.10,
  alpha: 1.8,
}

export default function App() {
  const [options, setOptions] = useState<OptionsResponse | null>(null)
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null)
  const [simResult, setSimResult] = useState<SimulateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [simError, setSimError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(true)

  // Guided 4-step navigation state
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]))

  // Simulation setup state shared between Step 2 (configuration) and Step 3 (execution)
  const [selectedScenario, setSelectedScenario] = useState("baseline")
  const [selectedPolicy, setSelectedPolicy] = useState("weighted_aging")
  const [seed, setSeed] = useState<number>(42)
  const [weights, setWeights] = useState<PriorityWeights>(DEFAULT_WEIGHTS)

  // AI Popover state
  const [isAiPopoverOpen, setIsAiPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    if (nextDark) {
      document.documentElement.classList.add("dark")
      document.documentElement.classList.remove("light")
    } else {
      document.documentElement.classList.remove("dark")
      document.documentElement.classList.add("light")
    }
  }

  useEffect(() => {
    // Initial fetch of options and AI status
    Promise.all([api.getOptions(), api.getAIStatus()])
      .then(([optsData, aiData]) => {
        setOptions(optsData)
        setAiStatus(aiData)
        if (optsData.default_weights) {
          setWeights(optsData.default_weights)
        }
        setLoading(false)

        // Pre-run default baseline simulation so Track Board is instantly populated
        api.simulate({
          policy: "weighted_aging",
          scenario: "baseline",
          seed: 42,
          duration_minutes: 480,
          weights: optsData.default_weights,
        })
          .then((res) => setSimResult(res))
          .catch(() => {})
      })
      .catch((err) => {
        setError(err.message || "Failed to initialize MedFlow engine")
        setLoading(false)
      })
  }, [])

  // Close AI popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsAiPopoverOpen(false)
      }
    }
    if (isAiPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isAiPopoverOpen])

  const goToStep = (stepIndex: number) => {
    if (visitedSteps.has(stepIndex) || stepIndex <= currentStep) {
      setCurrentStep(stepIndex)
      setVisitedSteps((prev) => new Set([...prev, stepIndex]))
    }
  }

  const handleNextStep = () => {
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1
      setCurrentStep(next)
      setVisitedSteps((prev) => new Set([...prev, next]))
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleRunShift = async () => {
    setSimulating(true)
    setSimError(null)
    try {
      const res = await api.simulate({
        policy: selectedPolicy,
        scenario: selectedScenario,
        seed: seed,
        duration_minutes: 480,
        weights: selectedPolicy === "weighted_aging" ? weights : undefined,
      })
      setSimResult(res)
    } catch (err: any) {
      setSimError(err.message || "Simulation run failed")
    } finally {
      setSimulating(false)
    }
  }

  const currentScenarioName =
    options?.scenarios.find((s) => s.id === selectedScenario)?.name || "Standard ED Flow"
  const currentPolicyName =
    options?.policies.find((p) => p.id === selectedPolicy)?.name.split("(")[0].trim() || "Weighted Aging"

  // Step 1 Widget: Triage (70/30 split live waiting room)
  const triageWidgets: GridItem[] = [
    {
      id: "triage-widget",
      title: "Clinical AI Triage & Live Waiting Room",
      subtitle: "Groq Clinical Decision Support with Real-Time Acuity Intake",
      icon: <BrainCircuit className="w-4 h-4 text-indigo-400" />,
      colSpan: "full",
      content: <TriageWidget />,
    },
  ]

  // Step 2 Widget: Setup (Priority & Expose Mathematical Weights)
  const setupWidgets: GridItem[] = [
    {
      id: "run-widget",
      title: "Priority Formula & Setup",
      subtitle: "Scenario, Policies & Mathematical Coefficient Sliders",
      icon: <Layers className="w-4 h-4 text-rose-400" />,
      colSpan: "full",
      content: (
        <RunWidget
          options={options}
          selectedScenario={selectedScenario}
          setSelectedScenario={setSelectedScenario}
          selectedPolicy={selectedPolicy}
          setSelectedPolicy={setSelectedPolicy}
          seed={seed}
          setSeed={setSeed}
          weights={weights}
          setWeights={setWeights}
        />
      ),
    },
  ]

  // Step 4 Widgets: Outcomes & Compare together with Recharts & Little's Law
  const resultsWidgets: GridItem[] = [
    {
      id: "outcomes-widget",
      title: "Deterioration Curve & Little's Law Math Proof",
      subtitle: "Waiting Room Curve, Surge Highlight & Theoretical Erlang-C Validation",
      icon: <BarChart3 className="w-4 h-4 text-blue-400" />,
      colSpan: 1,
      content: <OutcomesWidget simResult={simResult} selectedScenario={selectedScenario} />,
    },
    {
      id: "compare-widget",
      title: "Policy Benchmarking Bar Chart",
      subtitle: "FCFS vs Urgency vs Weighted Aging Mean Wait Times",
      icon: <Layers className="w-4 h-4 text-purple-400" />,
      colSpan: 1,
      content: (
        <CompareWidget
          scenario={selectedScenario}
          seed={seed}
          weights={selectedPolicy === "weighted_aging" ? weights : undefined}
        />
      ),
    },
  ]

  const isConfiguredAi = aiStatus?.configured ?? options?.ai_status?.configured ?? false
  const modelName = aiStatus?.model ?? options?.ai_status?.model ?? "llama-3.3-70b-versatile"

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-rose-500/30">
      {/* Top Navigation Bar - Dense 4px/8px padding */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/75 backdrop-blur px-4 py-2.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              MedFlow Command Center
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-medium">
                Live Engine
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400">Intelligent Emergency Department Queue & Triage Operations</p>
          </div>
        </div>

        {/* Header Controls & Expandable AI Engine Popover */}
        <div className="flex items-center gap-2 relative" ref={popoverRef}>
          {/* Interactive AI Status Pill / Button */}
          <button
            onClick={() => setIsAiPopoverOpen(!isAiPopoverOpen)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-all cursor-pointer shadow-sm group"
            title="Click to inspect AI Engine Health & Architecture"
            aria-expanded={isAiPopoverOpen}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline text-zinc-400">Engine:</span>
            {loading ? (
              <span className="text-zinc-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                Connecting...
              </span>
            ) : isConfiguredAi ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Groq ({modelName})
              </span>
            ) : (
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Rule Fallback
              </span>
            )}
            <ChevronDown
              className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${
                isAiPopoverOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* AI Status Expandable Popover */}
          {isAiPopoverOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl bg-zinc-900 border border-zinc-750 shadow-2xl p-3 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-semibold text-zinc-200">AI Decision Support Engine</h3>
                </div>
                <button
                  onClick={() => setIsAiPopoverOpen(false)}
                  className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-2.5 space-y-2">
                <div className="p-2 rounded-lg bg-zinc-850/70 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      Active AI Runtime
                    </div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                      {isConfiguredAi ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-emerald-400">Groq Online</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span className="text-amber-400">Rule Fallback Active</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isConfiguredAi ? (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" /> Connected
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-400" /> Resilient
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  <WidgetRow
                    label="API Key Status"
                    value={
                      isConfiguredAi ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1.5 text-[11px]">
                          <WidgetDot color="bg-emerald-400" pulse />
                          GROQ_API_KEY Active
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold flex items-center gap-1.5 text-[11px]">
                          <WidgetDot color="bg-amber-400" />
                          Unset (Offline Safety)
                        </span>
                      )
                    }
                  />
                  <WidgetRow
                    label="Model Architecture"
                    value={<span className="font-mono text-[10px] text-zinc-300">{modelName}</span>}
                    dotColor="bg-indigo-400"
                  />
                  <WidgetRow
                    label="Fallback Guarantee"
                    value={<span className="text-emerald-400 text-[11px]">100% Availability</span>}
                    dotColor="bg-emerald-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* White / Dark Background Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle light/dark background theme"
            className="px-2 py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title={isDark ? "Switch to Light Background" : "Switch to Dark Background"}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline text-zinc-300 text-xs">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline text-zinc-700 text-xs">Dark</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Guided Workflow Container - Tight 4px/8px System */}
      <main className="flex-1 p-3 md:p-4 max-w-7xl mx-auto w-full space-y-3 flex flex-col">
        {/* Error Banner */}
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 flex items-center gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stepper / Tab Bar Navigation */}
        <section className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-1.5 md:p-2 shadow-sm">
          <div className="flex items-center justify-between overflow-x-auto gap-1 sm:gap-2">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === idx
              const isVisited = visitedSteps.has(idx)
              const StepIcon = step.icon

              return (
                <div key={step.id} className="flex items-center flex-1 min-w-[120px]">
                  <button
                    onClick={() => goToStep(idx)}
                    disabled={!isVisited}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg w-full text-left transition-all ${
                      isActive
                        ? "bg-rose-500/15 border border-rose-500/40 text-white shadow-[0_0_12px_rgba(244,63,94,0.15)] cursor-default"
                        : isVisited
                        ? "hover:bg-zinc-800/70 border border-transparent text-zinc-300 hover:text-white cursor-pointer"
                        : "opacity-40 text-zinc-600 border border-transparent cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-all flex-shrink-0 ${
                        isActive
                          ? "bg-rose-500 text-white shadow-sm"
                          : isVisited
                          ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                          : "bg-zinc-850 text-zinc-600 border border-zinc-800"
                      }`}
                    >
                      {isVisited && !isActive ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : !isVisited ? (
                        <Lock className="w-3 h-3 text-zinc-600" />
                      ) : (
                        step.stepNumber
                      )}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold tracking-tight flex items-center gap-1.5">
                        <StepIcon className={`w-3.5 h-3.5 ${isActive ? "text-rose-400" : "text-zinc-400"}`} />
                        <span>{step.stepNumber}. {step.label}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 hidden md:block truncate">
                        {step.subtitle}
                      </div>
                    </div>
                  </button>

                  {idx < STEPS.length - 1 && (
                    <div className="text-zinc-700 font-bold px-0.5 hidden sm:block select-none">·</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Step Content Area - Only Current Step Visible */}
        <section className="flex-1 space-y-3">
          {/* Step 1: Clinical AI Triage & Live Waiting Room (70/30 Grid) */}
          {currentStep === 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
                    <span>Step 1 · Clinical AI Triage</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                      70/30 Intake & Waiting Room
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Evaluate clinical intake presentations and populate the live emergency waiting room.
                  </p>
                </div>
              </div>

              <DraggableWidgetGrid
                items={triageWidgets}
                renderItem={(item) => item.content}
                columns={1}
                allowReorder={false}
                allowMinimize={false}
                allowHide={false}
                showControls={false}
              />
            </div>
          )}

          {/* Step 2: Priority & Setup (Mathematical Weights Tuning) */}
          {currentStep === 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
                    <span>Step 2 · Priority & Setup</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                      Exposed Mathematical Weights
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Tune priority weights w_u, w_w, w_r, and w_f to balance urgency protection and starvation avoidance.
                  </p>
                </div>
              </div>

              <DraggableWidgetGrid
                items={setupWidgets}
                renderItem={(item) => item.content}
                columns={1}
                allowReorder={false}
                allowMinimize={false}
                allowHide={false}
                showControls={false}
              />
            </div>
          )}

          {/* Step 3: Run & Allocate (Live Simulation Dashboard & Resource Gauges) */}
          {currentStep === 2 && (
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80 shadow-sm">
                <div>
                  <h2 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
                    <span>Step 3 · Track Board & Resource Gauges</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-medium">
                      {currentScenarioName} · {currentPolicyName}
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Scrub the 480-minute shift, monitor real-time bed & staff utilization, and watch queue re-sorting.
                  </p>
                </div>

                {/* Re-Run Shift Simulation Action Button */}
                <button
                  onClick={handleRunShift}
                  disabled={simulating}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-600/25 flex-shrink-0 cursor-pointer"
                >
                  {simulating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Simulating Shift...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-white" />
                      {simResult ? "Re-Run Shift Simulation" : "Run Shift Simulation"}
                    </>
                  )}
                </button>
              </div>

              {simError && (
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{simError}</span>
                </div>
              )}

              {/* Live Track Board and Resource Gauges Component */}
              <TrackBoardWidget
                simResult={simResult}
                simulating={simulating}
                onRunShift={handleRunShift}
                selectedPolicy={selectedPolicy}
                selectedScenario={selectedScenario}
              />
            </div>
          )}

          {/* Step 4: Results (Recharts & Mathematical Little's Law Proof) */}
          {currentStep === 3 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
                    <span>Step 4 · Operational Results & Benchmarking</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                      Recharts Visuals & Little's Law Proof
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Comparative bar charts across policies, 8-hour deterioration surge curves, and Erlang-C queuing proofs.
                  </p>
                </div>
              </div>

              <DraggableWidgetGrid
                items={resultsWidgets}
                renderItem={(item) => item.content}
                columns={2}
                allowReorder={true}
                allowMinimize={true}
                allowHide={true}
                showControls={true}
              />
            </div>
          )}
        </section>

        {/* Guided Step Bottom Navigation Bar */}
        <footer className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2.5 mt-auto">
          {currentStep > 0 ? (
            <button
              onClick={handlePrevStep}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back: {STEPS[currentStep - 1].label}
            </button>
          ) : (
            <div />
          )}

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={handleNextStep}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-rose-600/20"
            >
              Next: {STEPS[currentStep + 1].label}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => goToStep(0)}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Restart Guided Flow
            </button>
          )}
        </footer>
      </main>
    </div>
  )
}

import { useEffect, useState, useRef } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Building2,
  Cpu,
  Layers,
  Sparkles,
  Users,
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
import { api, type OptionsResponse, type SimulateResponse, type AIStatusResponse } from "@/api"
import { DraggableWidgetGrid, type GridItem, WidgetDot, WidgetRow } from "@/components/ui/draggable-widget-grid"
import { TriageWidget } from "@/components/widgets/TriageWidget"
import { QueueWidget } from "@/components/widgets/QueueWidget"
import { ResourcesWidget } from "@/components/widgets/ResourcesWidget"
import { RunWidget } from "@/components/widgets/RunWidget"
import { OutcomesWidget } from "@/components/widgets/OutcomesWidget"
import { CompareWidget } from "@/components/widgets/CompareWidget"

const STEPS = [
  { id: "triage", stepNumber: 1, label: "Triage", subtitle: "Clinical AI Assessment", icon: BrainCircuit },
  { id: "setup", stepNumber: 2, label: "Setup", subtitle: "Priority & Policies", icon: Layers },
  { id: "run", stepNumber: 3, label: "Run", subtitle: "Run & Allocate", icon: Play },
  { id: "results", stepNumber: 4, label: "Results", subtitle: "Outcomes & Comparison", icon: BarChart3 },
]

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
        setLoading(false)
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

  // Step 1 Widget: Triage alone
  const triageWidgets: GridItem[] = [
    {
      id: "triage-widget",
      title: "Clinical AI Triage",
      subtitle: "Groq Clinical Decision Support",
      icon: <BrainCircuit className="w-4 h-4 text-indigo-400" />,
      colSpan: "full",
      content: <TriageWidget />,
    },
  ]

  // Step 2 Widget: Setup (Priority & Setup)
  const setupWidgets: GridItem[] = [
    {
      id: "run-widget",
      title: "Priority & Setup",
      subtitle: "Scenario & Queuing Policies",
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
        />
      ),
    },
  ]

  // Step 3 Widgets: Queue & Resources together
  const runWidgets: GridItem[] = [
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
  ]

  // Step 4 Widgets: Outcomes & Compare together
  const resultsWidgets: GridItem[] = [
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
  ]

  const isConfiguredAi = aiStatus?.configured ?? options?.ai_status?.configured ?? false
  const modelName = aiStatus?.model ?? options?.ai_status?.model ?? "llama-3.3-70b-versatile"

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

        {/* Header Controls & Expandable AI Engine Popover */}
        <div className="flex items-center gap-3 relative" ref={popoverRef}>
          {/* Interactive AI Status Pill / Button */}
          <button
            onClick={() => setIsAiPopoverOpen(!isAiPopoverOpen)}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-all cursor-pointer shadow-sm group"
            title="Click to inspect AI Engine Health & Architecture"
            aria-expanded={isAiPopoverOpen}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>Engine:</span>
            {loading ? (
              <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                Connecting...
              </span>
            ) : isConfiguredAi ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Groq ({modelName})
              </span>
            ) : (
              <span className="text-amber-400 font-medium flex items-center gap-1.5">
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
            <div className="absolute right-0 top-full mt-2 w-84 sm:w-96 rounded-2xl bg-zinc-900 border border-zinc-750 shadow-2xl p-4 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-semibold text-zinc-200">AI Decision Support Engine</h3>
                </div>
                <button
                  onClick={() => setIsAiPopoverOpen(false)}
                  className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-3 space-y-3">
                <div className="p-3 rounded-xl bg-zinc-850/70 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      Active AI Runtime
                    </div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                      {isConfiguredAi ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-emerald-400">Groq Online</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="text-amber-400">Rule Fallback Active</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isConfiguredAi ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" /> Connected
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-400" /> Resilient
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <WidgetRow
                    label="API Key Status"
                    value={
                      isConfiguredAi ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                          <WidgetDot color="bg-emerald-400" pulse />
                          GROQ_API_KEY Active
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                          <WidgetDot color="bg-amber-400" />
                          Unset (Offline Safety)
                        </span>
                      )
                    }
                  />
                  <WidgetRow
                    label="Model Architecture"
                    value={<span className="font-mono text-[11px] text-zinc-300">{modelName}</span>}
                    dotColor="bg-indigo-400"
                  />
                  <WidgetRow
                    label="Fallback Guarantee"
                    value={<span className="text-emerald-400 text-xs">100% Availability (Offline Safe)</span>}
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
            className="px-2.5 py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title={isDark ? "Switch to White / Light Background" : "Switch to Dark Background"}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline text-zinc-300">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline text-zinc-700">Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Guided Workflow Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 flex flex-col">
        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 flex items-center gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stepper / Tab Bar Navigation */}
        <section className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-2 md:p-3 shadow-md">
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
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl w-full text-left transition-all ${
                      isActive
                        ? "bg-rose-500/15 border border-rose-500/40 text-white shadow-[0_0_12px_rgba(244,63,94,0.15)] cursor-default"
                        : isVisited
                        ? "hover:bg-zinc-800/70 border border-transparent text-zinc-300 hover:text-white cursor-pointer"
                        : "opacity-40 text-zinc-600 border border-transparent cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all flex-shrink-0 ${
                        isActive
                          ? "bg-rose-500 text-white shadow-sm"
                          : isVisited
                          ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                          : "bg-zinc-850 text-zinc-600 border border-zinc-800"
                      }`}
                    >
                      {isVisited && !isActive ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : !isVisited ? (
                        <Lock className="w-3.5 h-3.5 text-zinc-600" />
                      ) : (
                        step.stepNumber
                      )}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold tracking-tight flex items-center gap-1.5">
                        <StepIcon className={`w-3.5 h-3.5 ${isActive ? "text-rose-400" : "text-zinc-400"}`} />
                        <span>{step.stepNumber} {step.label}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 hidden md:block truncate">
                        {step.subtitle}
                      </div>
                    </div>
                  </button>

                  {idx < STEPS.length - 1 && (
                    <div className="text-zinc-700 font-bold px-1 hidden sm:block select-none">·</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Step Content Area - Only Current Step Visible */}
        <section className="flex-1 space-y-4">
          {/* Step 1: Clinical AI Triage */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                    Step 1 · Clinical AI Triage
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Evaluate free-text clinical intake notes with Groq decision support and ESI acuity assignment.
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

          {/* Step 2: Priority & Setup */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                    Step 2 · Priority & Setup
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Select the patient arrival scenario, queue triage policy, and random seed parameters.
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

          {/* Step 3: Run & Allocate */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                    <span>Step 3 · Run & Allocate</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-medium">
                      {currentScenarioName} · {currentPolicyName}
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Execute the 8-hour shift simulation and monitor real-time queue acuity and clinical resources.
                  </p>
                </div>

                {/* Prominent Run Shift Action Button */}
                <button
                  onClick={handleRunShift}
                  disabled={simulating}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/25 flex-shrink-0 cursor-pointer"
                >
                  {simulating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Executing Shift Simulation...
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
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{simError}</span>
                </div>
              )}

              {/* Disabled Content / Placeholder state when simulation has not run */}
              {!simResult ? (
                <div className="p-10 rounded-2xl bg-zinc-900/60 border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="p-3.5 rounded-2xl bg-zinc-850 border border-zinc-800 text-zinc-500">
                    <Play className="w-8 h-8 text-rose-400/80 fill-rose-500/20" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="text-sm font-semibold text-zinc-200">
                      Run the simulation to see this
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Launch the 8-hour shift simulation using the button above to populate live waiting room acuity depth and clinical resource pool allocations.
                    </p>
                  </div>
                  <button
                    onClick={handleRunShift}
                    disabled={simulating}
                    className="px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    Launch Simulation Now
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 font-medium">
                    Drag and rearrange cards to inspect queue dynamics and resource utilization.
                  </p>
                  <DraggableWidgetGrid
                    items={runWidgets}
                    renderItem={(item) => item.content}
                    columns={2}
                    allowReorder={true}
                    allowMinimize={true}
                    allowHide={true}
                    showControls={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Results */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                    Step 4 · Operational Results & Benchmarking
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Review mean wait times, SLA compliance, deterioration prevention, and multi-policy benchmarks.
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
        <footer className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-3 mt-auto">
          {currentStep > 0 ? (
            <button
              onClick={handlePrevStep}
              className="px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Back: {STEPS[currentStep - 1].label}
            </button>
          ) : (
            <div />
          )}

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={handleNextStep}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-rose-600/20"
            >
              Next: {STEPS[currentStep + 1].label}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => goToStep(0)}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restart Guided Flow
            </button>
          )}
        </footer>
      </main>
    </div>
  )
}


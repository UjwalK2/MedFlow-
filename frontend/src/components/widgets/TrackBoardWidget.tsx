import { useState, useEffect, useMemo } from "react"
import { motion } from "motion/react"
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Users,
  Clock,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Activity,
  Bed,
  Stethoscope,
  HeartPulse,
} from "lucide-react"
import { getESIConfig, type SimulateResponse, type QueuePatientSummary } from "@/api"

export interface TrackBoardWidgetProps {
  simResult: SimulateResponse | null
  simulating: boolean
  onRunShift: () => void
  selectedPolicy: string
  selectedScenario: string
}

export function TrackBoardWidget({
  simResult,
  simulating,
  onRunShift,
  selectedPolicy,
  selectedScenario,
}: TrackBoardWidgetProps) {
  const [currentMinute, setCurrentMinute] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [speed, setSpeed] = useState<number>(2) // 1x, 2x, 5x, 10x
  const [filterEsi, setFilterEsi] = useState<number | null>(null)

  // Auto-run simulation on mount if result is missing
  useEffect(() => {
    if (!simResult && !simulating) {
      onRunShift()
    }
  }, [simResult, simulating, onRunShift])

  // Reset to minute 0 whenever a new simulation result arrives
  useEffect(() => {
    if (simResult) {
      setCurrentMinute(0)
      setIsPlaying(false)
    }
  }, [simResult?.seed, simResult?.policy_id, simResult?.scenario_id])

  const totalMinutes = simResult ? Math.max(1, simResult.snapshots.length - 1) : 480

  // Playback timer tick loop
  useEffect(() => {
    if (!isPlaying || !simResult) return

    const intervalMs = speed === 1 ? 250 : speed === 2 ? 120 : speed === 5 ? 50 : 25
    const stepIncrement = speed === 10 ? 2 : 1

    const timer = setInterval(() => {
      setCurrentMinute((prev) => {
        if (prev >= totalMinutes) {
          setIsPlaying(false)
          return totalMinutes
        }
        return Math.min(totalMinutes, prev + stepIncrement)
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [isPlaying, speed, simResult, totalMinutes])

  // Current timeline snapshot
  const currentSnapshot = simResult?.snapshots[currentMinute] || simResult?.snapshots[0]

  // Format hospital shift clock (07:00 AM base)
  const getClockTime = (minute: number) => {
    const totalMinutesSinceMidnight = 7 * 60 + minute
    const hours24 = Math.floor(totalMinutesSinceMidnight / 60) % 24
    const mins = totalMinutesSinceMidnight % 60
    const period = hours24 >= 12 ? "PM" : "AM"
    const displayHours = hours24 % 12 === 0 ? 12 : hours24 % 12
    return `${String(displayHours).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`
  }

  // Calculate Resource Allocations & ICU Utilization
  const totalBeds = currentSnapshot?.total_resources?.bed ?? 12
  const totalDocs = currentSnapshot?.total_resources?.doctor ?? 4
  const totalNurses = currentSnapshot?.total_resources?.nurse ?? 6

  // In ED clinical distribution, 4 beds are designated ICU / Resuscitation beds
  const totalIcuBeds = 4
  const totalGenBeds = Math.max(1, totalBeds - totalIcuBeds)

  // In-service patient acuity separation
  const inServicePatients = currentSnapshot?.in_service || []
  const usedIcuBeds = inServicePatients.filter((p) => p.esi === 1 || p.esi === 2).length
  const usedGenBeds = inServicePatients.filter((p) => p.esi >= 3).length

  const availDocs = currentSnapshot?.available_resources?.doctor ?? 1
  const usedDocs = Math.max(0, totalDocs - availDocs)

  const availNurses = currentSnapshot?.available_resources?.nurse ?? 1
  const usedNurses = Math.max(0, totalNurses - availNurses)

  const genUtilPct = Math.min(100, Math.round((usedGenBeds / totalGenBeds) * 100))
  const icuUtilPct = Math.min(100, Math.round((usedIcuBeds / totalIcuBeds) * 100))
  const docUtilPct = Math.min(100, Math.round((usedDocs / totalDocs) * 100))
  const nurseUtilPct = Math.min(100, Math.round((usedNurses / totalNurses) * 100))

  const isIcuSaturated = icuUtilPct >= 100

  // Live Queue sorting based on active policy
  const rawQueue: QueuePatientSummary[] = currentSnapshot?.queue || []
  const sortedQueue = useMemo(() => {
    const list = filterEsi !== null ? rawQueue.filter((p) => p.esi === filterEsi) : [...rawQueue]
    return list.sort((a, b) => {
      switch (selectedPolicy) {
        case "fcfs":
          return a.arrival_time - b.arrival_time
        case "urgency":
          if (a.esi !== b.esi) return a.esi - b.esi
          return a.arrival_time - b.arrival_time
        case "edf":
          return a.arrival_time + a.target_wait - (b.arrival_time + b.target_wait)
        case "weighted_aging":
        default:
          return b.priority_score - a.priority_score
      }
    })
  }, [rawQueue, selectedPolicy, filterEsi])

  const slaBreachCount = rawQueue.filter((p) => p.sla_breached).length

  return (
    <div className="space-y-3 w-full">
      {/* ====================================================================
          TOP PLAYBACK & TIMELINE SCRUBBING CONTROLS BAR
         ==================================================================== */}
      <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80 shadow-md space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-zinc-800/70">
          {/* Shift Clock and Minute Display */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-850 border border-zinc-750 text-zinc-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-400" />
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-sm font-bold text-white tabular-nums tracking-tight">
                  {getClockTime(currentMinute)}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase font-mono">
                  (T+{currentMinute}m)
                </span>
              </div>
            </div>

            <div className="hidden sm:block">
              <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Shift Progression
              </div>
              <div className="text-xs font-mono font-semibold text-zinc-300 tabular-nums">
                Minute {currentMinute} / {totalMinutes} ({( (currentMinute / totalMinutes) * 100 ).toFixed(0)}%)
              </div>
            </div>

            {/* Shift Status Tag */}
            <div>
              {currentMinute >= totalMinutes ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-indigo-400" /> Shift Complete
                </span>
              ) : isPlaying ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Simulating
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono font-medium">
                  Paused
                </span>
              )}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Rewind 15m */}
            <button
              onClick={() => setCurrentMinute((prev) => Math.max(0, prev - 15))}
              className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-750 transition-colors cursor-pointer"
              title="Step Back 15 min"
            >
              <Rewind className="w-3.5 h-3.5" />
            </button>

            {/* Play / Pause Main Button */}
            <button
              onClick={() => {
                if (currentMinute >= totalMinutes) setCurrentMinute(0)
                setIsPlaying(!isPlaying)
              }}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-rose-600/30 cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-white" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" /> Play Simulation
                </>
              )}
            </button>

            {/* Fast Forward 15m */}
            <button
              onClick={() => setCurrentMinute((prev) => Math.min(totalMinutes, prev + 15))}
              className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-750 transition-colors cursor-pointer"
              title="Step Forward 15 min"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>

            {/* Speed Multipliers */}
            <div className="flex items-center rounded-lg bg-zinc-850 border border-zinc-750 p-0.5 text-[10px] font-mono">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    speed === s
                      ? "bg-zinc-700 text-white font-bold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Reset to 0 */}
            <button
              onClick={() => {
                setIsPlaying(false)
                setCurrentMinute(0)
              }}
              title="Reset Timeline to Start"
              className="p-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-750 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Mass Casualty Surge Jump Shortcut */}
            {selectedScenario === "mass_casualty" && (
              <button
                onClick={() => setCurrentMinute(60)}
                className="text-[10px] px-2 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Flame className="w-3 h-3 text-rose-400" />
                Jump to Surge (T+60m)
              </button>
            )}
          </div>
        </div>

        {/* Scrubbing Range Slider */}
        <div className="space-y-1">
          <div className="relative">
            <input
              type="range"
              min={0}
              max={totalMinutes}
              value={currentMinute}
              onChange={(e) => {
                setCurrentMinute(Number(e.target.value))
              }}
              className="w-full accent-rose-500 cursor-pointer h-2 bg-zinc-800 rounded-lg appearance-none"
            />
            {/* Visual Surge Indicator marker on slider for Mass Casualty */}
            {selectedScenario === "mass_casualty" && (
              <div
                className="absolute top-0 pointer-events-none h-2 bg-rose-500/40 rounded"
                style={{
                  left: `${(60 / 480) * 100}%`,
                  width: `${(45 / 480) * 100}%`,
                }}
                title="MCI Surge Window (Minute 60–105)"
              />
            )}
          </div>

          {/* Timeline Hour Marks */}
          <div className="flex justify-between text-[9px] font-mono text-zinc-500 tabular-nums select-none px-0.5">
            <span>07:00 (0m)</span>
            <span>09:00 (120m)</span>
            <span>11:00 (240m)</span>
            <span>13:00 (360m)</span>
            <span>15:00 (480m)</span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          PERSISTENT ROW OF RESOURCE UTILIZATION PROGRESS BARS
         ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* 1. General Beds */}
        <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Bed className="w-3.5 h-3.5 text-blue-400" />
              General Beds
            </span>
            <span className="font-mono text-xs font-bold text-white tabular-nums">
              {genUtilPct}%
            </span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                genUtilPct > 85 ? "bg-amber-500" : "bg-blue-500"
              }`}
              style={{ width: `${genUtilPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono tabular-nums">
            <span>{usedGenBeds} / {totalGenBeds} In Use</span>
            <span className={genUtilPct > 85 ? "text-amber-400 font-semibold" : "text-emerald-400"}>
              {totalGenBeds - usedGenBeds} Free
            </span>
          </div>
        </div>

        {/* 2. ICU Beds (CRITICAL FLASHING AT 100% UTILIZATION) */}
        <div
          className={`p-2.5 rounded-xl transition-all duration-300 shadow-sm space-y-1.5 ${
            isIcuSaturated
              ? "bg-rose-950/40 border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse"
              : "bg-zinc-900/90 border border-zinc-800/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
              <HeartPulse
                className={`w-3.5 h-3.5 ${isIcuSaturated ? "text-rose-400 animate-bounce" : "text-rose-400"}`}
              />
              ICU / Resus Beds
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums ${
                isIcuSaturated ? "text-rose-300 font-black" : "text-white"
              }`}
            >
              {icuUtilPct}%
            </span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isIcuSaturated
                  ? "bg-rose-600 shadow-[0_0_8px_rgba(244,63,94,1)] animate-pulse"
                  : icuUtilPct > 75
                  ? "bg-orange-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${icuUtilPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
            <span className="text-zinc-400">{usedIcuBeds} / {totalIcuBeds} Occupied</span>
            {isIcuSaturated ? (
              <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" /> 100% SRO (Critical)
              </span>
            ) : (
              <span className="text-emerald-400">{totalIcuBeds - usedIcuBeds} Free</span>
            )}
          </div>
        </div>

        {/* 3. Physicians / Doctors */}
        <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
              Physicians on Duty
            </span>
            <span className="font-mono text-xs font-bold text-white tabular-nums">
              {docUtilPct}%
            </span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                docUtilPct >= 100 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${docUtilPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono tabular-nums">
            <span>{usedDocs} / {totalDocs} Allocated</span>
            <span className={docUtilPct >= 100 ? "text-amber-400" : "text-emerald-400"}>
              {availDocs} Available
            </span>
          </div>
        </div>

        {/* 4. Nursing Staff */}
        <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              Nursing Staff
            </span>
            <span className="font-mono text-xs font-bold text-white tabular-nums">
              {nurseUtilPct}%
            </span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                nurseUtilPct >= 100 ? "bg-amber-500" : "bg-indigo-500"
              }`}
              style={{ width: `${nurseUtilPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono tabular-nums">
            <span>{usedNurses} / {totalNurses} Allocated</span>
            <span className={nurseUtilPct >= 100 ? "text-amber-400" : "text-emerald-400"}>
              {availNurses} Available
            </span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          LIVE QUEUE DATA TABLE (TRACK BOARD)
         ==================================================================== */}
      <div className="rounded-xl bg-zinc-900/90 border border-zinc-800/80 shadow-md overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-3.5 py-2.5 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-900">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" />
            <div>
              <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-2">
                Live Queue Track Board
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-mono uppercase font-semibold">
                  Policy: {selectedPolicy.replace("_", " ")}
                </span>
              </h3>
              <p className="text-[10px] text-zinc-400">
                Patients dynamically re-sorted by current minute urgency, wait saturation, and priority score.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Acuity Filter Chips */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterEsi(null)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  filterEsi === null
                    ? "bg-zinc-700 text-white font-bold"
                    : "bg-zinc-850 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                All ({rawQueue.length})
              </button>
              {[1, 2, 3, 4, 5].map((esi) => {
                const count = rawQueue.filter((p) => p.esi === esi).length
                const cfg = getESIConfig(esi)
                return (
                  <button
                    key={esi}
                    onClick={() => setFilterEsi(filterEsi === esi ? null : esi)}
                    className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-mono transition-colors cursor-pointer border ${
                      filterEsi === esi
                        ? `${cfg.badgeClass} font-bold`
                        : "bg-zinc-850 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                    <span>{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Breach Alert Pill */}
            {slaBreachCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                {slaBreachCount} SLA Breach{slaBreachCount > 1 ? "es" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-950/60 text-[10px] uppercase font-bold text-zinc-400 tracking-wider select-none">
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Patient ID</th>
                <th className="px-3 py-2">Acuity</th>
                <th className="px-3 py-2 text-right">Arrival</th>
                <th className="px-3 py-2 text-right">Current Wait</th>
                <th className="px-3 py-2 text-right">Target SLA</th>
                <th className="px-3 py-2 text-right">Priority Score</th>
                <th className="px-3 py-2">Deterioration</th>
                <th className="px-3 py-2">Resource Needs</th>
                <th className="px-3 py-2 text-center">SLA Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {sortedQueue.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-zinc-500 text-xs">
                    Waiting room queue is clear at minute {currentMinute}. No patients waiting for beds.
                  </td>
                </tr>
              ) : (
                sortedQueue.map((patient, index) => {
                  const cfg = getESIConfig(patient.esi)
                  const isBreached = patient.sla_breached
                  const waitRatio = patient.wait_time / Math.max(1, patient.target_wait)

                  return (
                    <motion.tr
                      key={patient.id}
                      layout
                      transition={{ duration: 0.15 }}
                      className={`hover:bg-zinc-850/50 transition-colors ${
                        isBreached ? "bg-rose-950/15" : ""
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-3 py-1.5 font-mono text-[11px] font-bold text-zinc-400 tabular-nums">
                        #{index + 1}
                      </td>

                      {/* Patient ID */}
                      <td className="px-3 py-1.5 font-mono text-[11px] font-bold text-white tabular-nums">
                        {patient.id}
                      </td>

                      {/* Acuity Badge */}
                      <td className="px-3 py-1.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${cfg.badgeClass}`}
                        >
                          {cfg.label} ({cfg.acuity})
                        </span>
                      </td>

                      {/* Arrival Time */}
                      <td className="px-3 py-1.5 text-right font-mono text-[11px] text-zinc-300 tabular-nums">
                        T+{patient.arrival_time.toFixed(0)}m
                      </td>

                      {/* Current Wait (Rapidly updating numeral with monospace font) */}
                      <td className="px-3 py-1.5 text-right font-mono text-xs font-bold tabular-nums">
                        <span
                          className={
                            isBreached
                              ? "text-rose-400 font-extrabold"
                              : waitRatio > 0.7
                              ? "text-amber-400"
                              : "text-zinc-200"
                          }
                        >
                          {patient.wait_time.toFixed(1)}m
                        </span>
                      </td>

                      {/* Target SLA */}
                      <td className="px-3 py-1.5 text-right font-mono text-[11px] text-zinc-400 tabular-nums">
                        {patient.target_wait}m
                      </td>

                      {/* Priority Score (Rapidly updating numeral with monospace font) */}
                      <td className="px-3 py-1.5 text-right font-mono text-xs font-bold tabular-nums">
                        <span className="text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                          {patient.priority_score.toFixed(3)}
                        </span>
                      </td>

                      {/* Deterioration Hazard */}
                      <td className="px-3 py-1.5">
                        <span className="font-mono text-[11px] tabular-nums flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              patient.deterioration_risk > 0.5
                                ? "bg-rose-500 animate-pulse"
                                : patient.deterioration_risk > 0.25
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                            }`}
                          />
                          {(patient.deterioration_risk * 100).toFixed(0)}%
                        </span>
                      </td>

                      {/* Resource Needs */}
                      <td className="px-3 py-1.5 text-[10px] text-zinc-300 font-mono">
                        {Object.keys(patient.required_resources || {}).join(" + ") || "bed"}
                      </td>

                      {/* SLA Compliance Status */}
                      <td className="px-3 py-1.5 text-center">
                        {isBreached ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono font-bold uppercase tracking-wider animate-pulse">
                            Breached
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                            Within SLA
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="px-3.5 py-2 border-t border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-[11px] text-zinc-400 font-mono tabular-nums">
          <span>
            Queue Depth: <strong className="text-white">{sortedQueue.length}</strong> patients
          </span>
          <span>
            Active In Treatment:{" "}
            <strong className="text-white">{inServicePatients.length}</strong>
          </span>
          <span>
            Total Discharged:{" "}
            <strong className="text-emerald-400">{currentSnapshot?.completed_count || 0}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

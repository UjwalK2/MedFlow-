import React, { useState, useRef } from "react"

export function ResponsiveContainer({
  children,
  width = "100%",
  height = "100%",
}: {
  children: React.ReactNode
  width?: string | number
  height?: string | number
}) {
  return (
    <div
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        position: "relative",
      }}
      className="w-full h-full select-none"
    >
      {children}
    </div>
  )
}

export function Bar(_props: any) {
  return null
}

export function Cell(_props: any) {
  return null
}

export function Line(_props: any) {
  return null
}

export function XAxis(_props: any) {
  return null
}

export function YAxis(_props: any) {
  return null
}

export function Tooltip(_props: any) {
  return null
}

export function CartesianGrid(_props: any) {
  return null
}

export function ReferenceLine(_props: any) {
  return null
}

export function ReferenceArea(_props: any) {
  return null
}

export interface BarChartProps {
  data: Array<{
    name: string
    fullName?: string
    meanWait: number
    color?: string
    breachRate?: number
    deteriorated?: number
    [key: string]: any
  }>
  children?: React.ReactNode
  margin?: { top?: number; right?: number; bottom?: number; left?: number }
}

export function BarChart({ data, children }: BarChartProps) {
  const [hoveredItem, setHoveredItem] = useState<any | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  if (!data || data.length === 0) {
    return <div className="text-zinc-500 text-xs text-center p-4">No benchmark data</div>
  }

  const maxWait = Math.max(...data.map((d) => d.meanWait), 25)
  const yTicks = [0, Math.round(maxWait / 2), Math.round(maxWait * 1.1)]

  // Look for custom Tooltip child
  let tooltipContentRenderer: any = null
  React.Children.forEach(children, (child: any) => {
    if (child && child.type === Tooltip && child.props.content) {
      tooltipContentRenderer = child.props.content
    }
  })

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between pt-2 pb-1"
      onMouseLeave={() => setHoveredItem(null)}
    >
      {/* Tooltip Overlay */}
      {hoveredItem && tooltipContentRenderer && (
        <div
          className="absolute z-30 pointer-events-none transition-all duration-75"
          style={{
            left: `${Math.min(mousePos.x, 220)}px`,
            top: `${Math.max(0, mousePos.y - 80)}px`,
          }}
        >
          {tooltipContentRenderer({
            active: true,
            payload: [{ payload: hoveredItem }],
          })}
        </div>
      )}

      {/* Bar Graphic Canvas */}
      <div className="relative flex-1 flex items-end justify-around px-8 border-b border-zinc-800">
        {/* Horizontal Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
          <div className="border-b border-dashed border-zinc-700 w-full" />
          <div className="border-b border-dashed border-zinc-700 w-full" />
          <div className="border-b border-dashed border-zinc-700 w-full" />
        </div>

        {/* Y-Axis tick markings */}
        <div className="absolute left-1 top-0 bottom-0 flex flex-col justify-between text-[9px] font-mono text-zinc-500 tabular-nums">
          <span>{yTicks[2]}m</span>
          <span>{yTicks[1]}m</span>
          <span>{yTicks[0]}m</span>
        </div>

        {/* Dynamic Bars */}
        {data.map((item, idx) => {
          const heightPct = Math.max(8, Math.min(95, (item.meanWait / (yTicks[2] || 35)) * 100))
          const isWinner = item.name === "Weighted Aging"
          const barColor = item.color || (isWinner ? "#10b981" : idx === 1 ? "#f59e0b" : "#64748b")

          return (
            <div
              key={item.name}
              className="relative flex flex-col items-center h-full justify-end group z-10 cursor-pointer"
              style={{ width: "24%" }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const parentRect = e.currentTarget.parentElement?.getBoundingClientRect()
                if (parentRect) {
                  setMousePos({
                    x: rect.left - parentRect.left + rect.width / 2,
                    y: rect.top - parentRect.top,
                  })
                }
                setHoveredItem(item)
              }}
            >
              {/* Value Label above bar */}
              <span className="text-[10px] font-mono font-bold text-zinc-300 tabular-nums mb-1 group-hover:text-white transition-colors">
                {item.meanWait}m
              </span>

              {/* Bar Column */}
              <div
                className="w-full rounded-t-md transition-all duration-300 group-hover:brightness-125"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: barColor,
                  border: isWinner ? "1.5px solid #34d399" : undefined,
                  boxShadow: isWinner ? "0 0 10px rgba(16, 185, 129, 0.3)" : undefined,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* X-Axis labels */}
      <div className="flex justify-around px-8 pt-1 text-[11px] text-zinc-400 font-medium select-none">
        {data.map((item) => (
          <span
            key={item.name}
            className={`truncate text-center ${
              item.name === "Weighted Aging" ? "text-emerald-400 font-semibold" : ""
            }`}
            style={{ width: "24%" }}
          >
            {item.name}
          </span>
        ))}
      </div>
    </div>
  )
}

export interface LineChartProps {
  data: Array<{
    minute: number
    waiting: number
    inService?: number
    deteriorated?: number
    [key: string]: any
  }>
  children?: React.ReactNode
  margin?: { top?: number; right?: number; bottom?: number; left?: number }
}

export function LineChart({ data, children }: LineChartProps) {
  const [hoveredItem, setHoveredItem] = useState<any | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  if (!data || data.length === 0) {
    return <div className="text-zinc-500 text-xs text-center p-4">No timeline snapshots</div>
  }

  // Find max values
  const maxWaiting = Math.max(...data.map((d) => Math.max(d.waiting || 0, d.inService || 0)), 12)
  const maxMinute = Math.max(...data.map((d) => d.minute), 480)

  // Look for custom Tooltip and ReferenceLine in children
  let tooltipContentRenderer: any = null
  let surgeMinute = 60
  React.Children.forEach(children, (child: any) => {
    if (child && child.type === Tooltip && child.props.content) {
      tooltipContentRenderer = child.props.content
    }
    if (child && child.type === ReferenceLine && child.props.x) {
      surgeMinute = child.props.x
    }
  })

  // SVG coordinate dimensions
  const svgWidth = 500
  const svgHeight = 150
  const padLeft = 24
  const padRight = 16
  const padTop = 10
  const padBottom = 20

  const chartW = svgWidth - padLeft - padRight
  const chartH = svgHeight - padTop - padBottom

  const getX = (minute: number) => padLeft + (minute / maxMinute) * chartW
  const getY = (val: number) => padTop + chartH - (val / (maxWaiting * 1.15)) * chartH

  // Build SVG Path for waiting
  const waitingPath = data.reduce((acc, pt, i) => {
    const x = getX(pt.minute).toFixed(1)
    const y = getY(pt.waiting).toFixed(1)
    return i === 0 ? `M ${x},${y}` : `${acc} L ${x},${y}`
  }, "")

  // Build SVG Path for inService
  const inServicePath = data.reduce((acc, pt, i) => {
    const x = getX(pt.minute).toFixed(1)
    const y = getY(pt.inService || 0).toFixed(1)
    return i === 0 ? `M ${x},${y}` : `${acc} L ${x},${y}`
  }, "")

  const surgeX = getX(surgeMinute)
  const surgeEndX = getX(surgeMinute + 45)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const currentFraction = Math.max(0, Math.min(1, (mouseX - padLeft) / chartW))
    const targetMinute = currentFraction * maxMinute

    // Find closest data point
    let closest = data[0]
    let minDiff = Infinity
    for (const pt of data) {
      const diff = Math.abs(pt.minute - targetMinute)
      if (diff < minDiff) {
        minDiff = diff
        closest = pt
      }
    }

    setHoveredItem(closest)
    setMousePos({ x: mouseX, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredItem(null)}
      className="relative w-full h-full select-none cursor-crosshair"
    >
      {/* Tooltip Overlay */}
      {hoveredItem && tooltipContentRenderer && (
        <div
          className="absolute z-30 pointer-events-none transition-all duration-75"
          style={{
            left: `${Math.min(Math.max(10, mousePos.x - 60), 240)}px`,
            top: `${Math.max(0, mousePos.y - 75)}px`,
          }}
        >
          {tooltipContentRenderer({
            active: true,
            payload: [{ payload: hoveredItem }],
          })}
        </div>
      )}

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Horizontal grid lines */}
        <line
          x1={padLeft}
          y1={padTop}
          x2={svgWidth - padRight}
          y2={padTop}
          stroke="#27272a"
          strokeDasharray="3 3"
        />
        <line
          x1={padLeft}
          y1={padTop + chartH / 2}
          x2={svgWidth - padRight}
          y2={padTop + chartH / 2}
          stroke="#27272a"
          strokeDasharray="3 3"
        />
        <line
          x1={padLeft}
          y1={padTop + chartH}
          x2={svgWidth - padRight}
          y2={padTop + chartH}
          stroke="#3f3f46"
        />

        {/* Surge Area highlight */}
        <rect
          x={surgeX}
          y={padTop}
          width={Math.max(0, surgeEndX - surgeX)}
          height={chartH}
          fill="#f43f5e"
          fillOpacity={0.12}
        />

        {/* Surge Vertical Reference Line */}
        <line
          x1={surgeX}
          y1={padTop}
          x2={surgeX}
          y2={padTop + chartH}
          stroke="#f43f5e"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        <text
          x={surgeX + 4}
          y={padTop + 10}
          fill="#f43f5e"
          fontSize={8}
          fontFamily="monospace"
          fontWeight="bold"
        >
          Surge T+{surgeMinute}m
        </text>

        {/* In Service Curve (Blue Dashed) */}
        <path
          d={inServicePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />

        {/* Waiting Room Patient Count Curve (Rose Solid) */}
        <path
          d={waitingPath}
          fill="none"
          stroke="#f43f5e"
          strokeWidth={2}
        />

        {/* Active hover vertical cursor line */}
        {hoveredItem && (
          <line
            x1={getX(hoveredItem.minute)}
            y1={padTop}
            x2={getX(hoveredItem.minute)}
            y2={padTop + chartH}
            stroke="#ffffff"
            strokeWidth={1}
            strokeDasharray="2 2"
            opacity={0.6}
          />
        )}

        {/* Y-axis Labels */}
        <text
          x={padLeft - 4}
          y={padTop + 8}
          fill="#71717a"
          fontSize={8}
          textAnchor="end"
          fontFamily="monospace"
        >
          {Math.round(maxWaiting)}
        </text>
        <text
          x={padLeft - 4}
          y={padTop + chartH}
          fill="#71717a"
          fontSize={8}
          textAnchor="end"
          fontFamily="monospace"
        >
          0
        </text>

        {/* X-axis Labels */}
        <text
          x={padLeft}
          y={svgHeight - 4}
          fill="#71717a"
          fontSize={8}
          fontFamily="monospace"
        >
          0m
        </text>
        <text
          x={padLeft + chartW / 2}
          y={svgHeight - 4}
          fill="#71717a"
          fontSize={8}
          textAnchor="middle"
          fontFamily="monospace"
        >
          240m
        </text>
        <text
          x={svgWidth - padRight}
          y={svgHeight - 4}
          fill="#71717a"
          fontSize={8}
          textAnchor="end"
          fontFamily="monospace"
        >
          480m
        </text>
      </svg>
    </div>
  )
}

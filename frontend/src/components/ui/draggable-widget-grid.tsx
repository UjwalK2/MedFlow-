import React, { useState } from "react"
import { motion, AnimatePresence, Reorder } from "motion/react"
import {
  GripVertical,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ============================================================================
// Shell / Big / Row / Dot UI Primitives
// ============================================================================

export function WidgetShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col justify-between h-full space-y-2", className)}>
      {children}
    </div>
  )
}

export function WidgetBig({
  value,
  label,
  subtext,
  badge,
  className,
}: {
  value: React.ReactNode
  label?: string
  subtext?: string
  badge?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      {label && <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</div>}
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-mono tabular-nums">{value}</div>
        {badge}
      </div>
      {subtext && <div className="text-[11px] text-zinc-400">{subtext}</div>}
    </div>
  )
}

export function WidgetRow({
  label,
  value,
  dotColor,
  icon,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  dotColor?: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-xs py-1 border-b border-zinc-800/40 last:border-0",
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-zinc-400 truncate text-[11px]">
        {dotColor && <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColor)} />}
        {icon && <span className="text-zinc-500">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div className="font-semibold text-zinc-200 flex-shrink-0 ml-2 font-mono tabular-nums text-[11px]">{value}</div>
    </div>
  )
}

export function WidgetDot({ color = "bg-emerald-400", pulse = false }: { color?: string; pulse?: boolean }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      {pulse && (
        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", color)} />
      )}
      <span className={cn("relative inline-flex rounded-full h-2 w-2", color)} />
    </span>
  )
}

export function WidgetBar({
  value,
  max = 100,
  color = "bg-rose-500",
}: {
  value: number
  max?: number
  color?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
      <div className={cn("h-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  )
}


// ============================================================================
// Draggable Grid Component
// ============================================================================

export interface GridItem {
  id: string
  title: string
  subtitle?: string
  icon?: React.ReactNode
  colSpan?: 1 | 2 | 3 | 4 | "full"
  minimized?: boolean
  closable?: boolean
  hidden?: boolean
  headerActions?: React.ReactNode
  content?: React.ReactNode
}

export interface DraggableWidgetGridProps<T extends GridItem = GridItem> {
  items?: T[]
  widgets?: T[]
  renderItem?: (item: T) => React.ReactNode
  onItemsChange?: (items: T[]) => void
  onWidgetsChange?: (items: T[]) => void
  className?: string
  columns?: 1 | 2 | 3 | 4
  allowReorder?: boolean
  allowMinimize?: boolean
  allowHide?: boolean
  showControls?: boolean
}

export function DraggableWidgetGrid<T extends GridItem = GridItem>({
  items: initialItems,
  widgets: initialWidgets,
  renderItem,
  onItemsChange,
  onWidgetsChange,
  className,
  columns = 2,
  allowReorder = true,
  allowMinimize = true,
  allowHide = true,
  showControls = true,
}: DraggableWidgetGridProps<T>) {
  const baseItems = (initialItems || initialWidgets || []) as T[]
  const [items, setItems] = useState<T[]>(baseItems)
  const [minimizedMap, setMinimizedMap] = useState<Record<string, boolean>>({})
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [hiddenItemIds, setHiddenItemIds] = useState<Set<string>>(new Set())

  React.useEffect(() => {
    setItems(baseItems)
  }, [initialItems, initialWidgets])

  const handleReorder = (newOrder: T[]) => {
    setItems(newOrder)
    onItemsChange?.(newOrder)
    onWidgetsChange?.(newOrder)
  }

  const toggleMinimize = (id: string) => {
    setMinimizedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const toggleExpand = (id: string) => {
    setExpandedItemId((prev) => (prev === id ? null : id))
  }

  const hideItem = (id: string) => {
    setHiddenItemIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const restoreItem = (id: string) => {
    setHiddenItemIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const resetAll = () => {
    setMinimizedMap({})
    setExpandedItemId(null)
    setHiddenItemIds(new Set())
    setItems(baseItems)
    onItemsChange?.(baseItems)
    onWidgetsChange?.(baseItems)
  }

  const visibleItems = items.filter((w) => !hiddenItemIds.has(w.id) && !w.hidden)
  const hiddenItems = items.filter((w) => hiddenItemIds.has(w.id) || w.hidden)

  const gridColsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 lg:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  }[columns]

  const getItemContent = (item: T) => {
    if (renderItem) {
      return renderItem(item)
    }
    return item.content
  }

  return (
    <div className={cn("space-y-4 w-full", className)}>
      {/* Hidden Widgets Restore Bar */}
      {showControls && hiddenItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs">
          <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
            <Plus className="w-3.5 h-3.5 text-zinc-500" />
            Hidden Cards:
          </span>
          {hiddenItems.map((w) => (
            <button
              key={w.id}
              onClick={() => restoreItem(w.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-colors"
            >
              {w.icon && <span className="opacity-70">{w.icon}</span>}
              <span>{w.title}</span>
              <Plus className="w-3 h-3 text-zinc-400" />
            </button>
          ))}
          <button
            onClick={resetAll}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Layout
          </button>
        </div>
      )}

      {/* Expanded Modal / Focus Mode */}
      <AnimatePresence>
        {expandedItemId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm p-4 md:p-8 flex items-center justify-center overflow-auto"
          >
            {(() => {
              const item = items.find((w) => w.id === expandedItemId)
              if (!item) return null
              return (
                <motion.div
                  layoutId={`widget-${item.id}`}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/90">
                    <div className="flex items-center gap-2.5">
                      {item.icon && <div className="text-zinc-400">{item.icon}</div>}
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">{item.title}</h3>
                        {item.subtitle && <p className="text-xs text-zinc-400">{item.subtitle}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.headerActions}
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                        title="Exit Fullscreen"
                      >
                        <Minimize2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1">{getItemContent(item)}</div>
                </motion.div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reorderable Grid */}
      {allowReorder ? (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={handleReorder}
          className={cn("grid gap-2.5 auto-rows-fr", gridColsClass)}
        >
          <AnimatePresence>
            {visibleItems.map((item) => {
              const isMinimized = minimizedMap[item.id] ?? item.minimized ?? false
              const colSpanClass =
                item.colSpan === "full"
                  ? "col-span-full"
                  : item.colSpan === 2
                  ? "lg:col-span-2"
                  : item.colSpan === 3
                  ? "lg:col-span-3"
                  : item.colSpan === 4
                  ? "lg:col-span-4"
                  : ""

              return (
                <Reorder.Item
                  key={item.id}
                  value={item}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "group bg-zinc-900/90 border border-zinc-800/80 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between",
                    colSpanClass
                  )}
                  whileDrag={{
                    scale: 1.02,
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
                    zIndex: 40,
                  }}
                >
                  {/* Widget Header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/70 bg-zinc-900/80 select-none">
                    <div className="flex items-center gap-2">
                      <div
                        className="cursor-grab active:cursor-grabbing p-0.5 -ml-0.5 text-zinc-600 group-hover:text-zinc-400 hover:text-zinc-200 transition-colors"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      {item.icon && <div className="text-zinc-400">{item.icon}</div>}
                      <div>
                        <h3 className="text-xs font-semibold text-zinc-200 tracking-tight">
                          {item.title}
                        </h3>
                        {item.subtitle && (
                          <p className="text-[10px] text-zinc-500 line-clamp-1">{item.subtitle}</p>
                        )}
                      </div>
                    </div>

                    {/* Header Controls */}
                    <div className="flex items-center gap-1">
                      {item.headerActions}

                      {allowMinimize && (
                        <button
                          onClick={() => toggleMinimize(item.id)}
                          className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                          title={isMinimized ? "Expand" : "Minimize"}
                        >
                          {isMinimized ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronUp className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="Fullscreen"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      {allowHide && item.closable !== false && (
                        <button
                          onClick={() => hideItem(item.id)}
                          className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors"
                          title="Hide widget"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Widget Body */}
                  <AnimatePresence initial={false}>
                    {!isMinimized && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="p-3 flex-1 flex flex-col justify-between"
                      >
                        {getItemContent(item)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Reorder.Item>
              )
            })}
          </AnimatePresence>
        </Reorder.Group>
      ) : (
        <div className={cn("grid gap-2.5", gridColsClass)}>
          {visibleItems.map((item) => {
            const isMinimized = minimizedMap[item.id] ?? item.minimized ?? false
            return (
              <div
                key={item.id}
                className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/70 bg-zinc-900/80">
                  <div className="flex items-center gap-2">
                    {item.icon && <div className="text-zinc-400">{item.icon}</div>}
                    <h3 className="text-xs font-semibold text-zinc-200">{item.title}</h3>
                  </div>
                </div>
                {!isMinimized && <div className="p-3 flex-1">{getItemContent(item)}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

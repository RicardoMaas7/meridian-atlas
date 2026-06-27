import { useEffect, useMemo, useRef, useState } from 'react'
import type { CodeChart } from '../types'
import { startLayout } from '../graph/layout'
import { useI18n } from '../i18n/context'

interface Props {
  chart: CodeChart
  selectedId: number | null
  newIds: Set<number>
  onSelect: (id: number | null) => void
  onHover?: (id: number | null) => void
  onOpenInEditor?: (id: number) => void
  highlightKind?: 'all' | 'function' | 'method' | 'class' | null
  hideRocks?: boolean
  newOnly?: boolean
  searchMatch?: Set<number>
  focusId?: number | null
  focusZoom?: number
}

const PALETTE = {
  void: '#05060a',
  voidSoft: '#0a0c14',
  ink: '#efe7d3',
  inkDim: '#8a8275',
  gold: '#d4a857',
  goldBright: '#f2cf80',
  copper: '#c87856',
  azure: '#4a8fc5',
  rose: '#ff7d6b',
  edge: '#3d3a2f',
  edgeCharted: '#9b7d3e',
  edgeEst: '#3a3a3a',
  edgeHot: '#f2cf80',
  function: '#efe7d3',
  method: '#8eb6ff',
  class: '#f2cf80',
  var: '#c87856',
  module: ['#d4a857', '#8eb6ff', '#c87856', '#b6e1ff', '#ff9b7a', '#a8c87a', '#c08bc8', '#e8c478'],
}

interface NodePos {
  id: number
  x: number
  y: number
  r: number
  fill: string
  stroke: string
  kind: string
  name: string
  file: string
  module: string
  row: number
  inbound: number
  outbound: number
  isNew: boolean
  isRock: boolean
  isLighthouse: boolean
  isPort: boolean
  isExpedition: boolean
  isSearchHit: boolean
  isFaded: boolean
}

interface EdgePath {
  d: string
  source: number
  target: number
  charted: boolean
  incident: boolean
  selected: boolean
  searchRelated: boolean
  isFaded: boolean
}

interface ViewBox {
  minX: number
  minY: number
  size: number
}

export function ChartCanvas({
  chart,
  selectedId,
  newIds,
  onSelect,
  onHover,
  onOpenInEditor,
  highlightKind = 'all',
  hideRocks = false,
  newOnly = false,
  searchMatch,
  focusId,
  focusZoom,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()
  const viewRef = useRef<ViewBox>({ minX: -500, minY: -500, size: 1000 })
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number; button: number } | null>(null)
  const dragMovedRef = useRef(false)
  const lastPinchDist = useRef<number | null>(null)
  // The tooltip ref is read by pointer event listeners (kept in a ref so
  // their identity never changes and React doesn't re-attach them). The
  // state mirrors the ref only for rendering.
  const [tooltip, setTooltipState] = useState<{ x: number; y: number; node: NodePos } | null>(null)
  const tooltipRef = useRef<{ x: number; y: number; node: NodePos } | null>(null)
  const setTooltip = (next: { x: number; y: number; node: NodePos } | null) => {
    tooltipRef.current = next
    setTooltipState(next)
  }
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [showMiniMap, setShowMiniMap] = useState(true)
  const [miniMapTick, setMiniMapTick] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)

  // Pass 1: run the force simulation only when the chart shape or "new"
  // highlights change. This is the expensive step (240 ticks) and must
  // NOT re-run on every keystroke of the search input or every filter
  // toggle.
  const layout = useMemo(() => {
    const { simulation } = startLayout(chart)
    for (let i = 0; i < 240; i++) simulation.tick()
    const pos = new Map<number, { x: number; y: number }>()
    for (const n of chart.nodes) pos.set(n.id, { x: n.x, y: n.y })
    simulation.stop()

    const moduleList = [...new Set(chart.nodes.map((n) => n.module))]
    const modColor = new Map<string, string>()
    moduleList.forEach((m, i) => modColor.set(m, PALETTE.module[i % PALETTE.module.length]))

    const map = new Map<number, NodePos>()
    for (const n of chart.nodes) {
      const p = pos.get(n.id)
      if (!p) continue
      const importance = Math.sqrt(n.inbound + n.outbound)
      const r = 5 + Math.min(importance * 2.2, 22)
      const isRock = n.inbound === 0 && n.outbound === 0
      const isNew = newIds.has(n.id)
      const isLighthouse = n.inbound >= 5
      const isPort = n.inbound === 0 && n.outbound >= 3
      const isExpedition = n.outbound >= 8
      const kindFill =
        n.kind === 'class'
          ? PALETTE.class
          : n.kind === 'method'
            ? PALETTE.method
            : n.kind === 'var'
              ? PALETTE.var
              : PALETTE.function
      const fill = isRock
        ? 'rgba(138, 130, 117, 0.5)'
        : isNew
          ? PALETTE.goldBright
          : kindFill
      const stroke = isNew
        ? PALETTE.goldBright
        : isLighthouse
          ? PALETTE.gold
          : isRock
            ? PALETTE.copper
            : isExpedition
              ? PALETTE.rose
              : 'rgba(239, 231, 211, 0.4)'
      map.set(n.id, {
        id: n.id,
        x: p.x,
        y: p.y,
        r,
        fill,
        stroke,
        kind: n.kind,
        name: n.name,
        file: n.file,
        module: n.module,
        row: n.row,
        inbound: n.inbound,
        outbound: n.outbound,
        isNew,
        isRock,
        isLighthouse,
        isPort,
        isExpedition,
        isSearchHit: false,
        isFaded: false,
      })
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of pos.values()) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    const pad = 120
    minX -= pad
    minY -= pad
    maxX += pad
    maxY += pad
    const size = Math.max(maxX - minX, maxY - minY)

    return {
      nodeMap: map,
      moduleColors: modColor,
      bounds: { minX, minY, maxX, maxY, size },
      pos,
    }
  }, [chart, newIds])

  // Pass 2: cheap filter/highlight/edge-curve computation that can re-run
  // freely on every interaction. Reads the cached `layout` (pos, nodeMap).
  const { nodeMap, edges } = useMemo(() => {
    const map = new Map(layout.nodeMap)
    for (const n of map.values()) {
      n.isSearchHit = searchMatch?.has(n.id) ?? false
      n.isFaded = false
    }

    // Apply kind filter / rocks / new-only: these mutate the working
    // map, so affected IDs are removed from the visible graph and
    // their edges drop out as a side effect.
    const visibleIds = new Set<number>()
    for (const n of map.values()) {
      let keep = true
      if (highlightKind && highlightKind !== 'all' && n.kind !== highlightKind) keep = false
      if (hideRocks && n.isRock) keep = false
      if (newOnly && !n.isNew) keep = false
      if (keep) visibleIds.add(n.id)
    }
    for (const id of Array.from(map.keys())) {
      if (!visibleIds.has(id)) map.delete(id)
    }

    const incident = new Set<number>()
    if (selectedId != null) {
      incident.add(selectedId)
      for (const e of chart.edges) {
        if (e.source === selectedId) incident.add(e.target)
        if (e.target === selectedId) incident.add(e.source)
      }
    }
    const searchRelated = new Set<number>()
    if (searchMatch && searchMatch.size > 0) {
      for (const e of chart.edges) {
        if (searchMatch.has(e.source) || searchMatch.has(e.target)) {
          searchRelated.add(e.source)
          searchRelated.add(e.target)
        }
      }
      for (const id of searchMatch) searchRelated.add(id)
    }
    for (const n of map.values()) {
      const hasSelection = selectedId != null
      const hasHover = hoverId != null && hoverId !== n.id
      n.isFaded =
        (hasSelection && !incident.has(n.id)) ||
        (hasHover && !incident.has(n.id)) ||
        (searchMatch != null && searchMatch.size > 0 && !searchRelated.has(n.id))
    }

    const edgePaths: EdgePath[] = []
    for (const e of chart.edges) {
      const a = layout.pos.get(e.source)
      const b = layout.pos.get(e.target)
      const na = map.get(e.source)
      const nb = map.get(e.target)
      if (!a || !b || !na || !nb) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const curvature = Math.min(0.18, 30 / Math.max(len, 50))
      const mx = (a.x + b.x) / 2 - dy * curvature
      const my = (a.y + b.y) / 2 + dx * curvature
      const ux = dx / len
      const uy = dy / len
      const ax = a.x + ux * (na.r + 1)
      const ay = a.y + uy * (na.r + 1)
      const bx = b.x - ux * (nb.r + 1)
      const by = b.y - uy * (nb.r + 1)
      const d = `M ${ax.toFixed(2)} ${ay.toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)}`
      const isSel = selectedId != null
      const isInc = isSel && (e.source === selectedId || e.target === selectedId)
      const isFadedEdge = isSel && !isInc
      const isSearchRel = searchRelated.has(e.source) && searchRelated.has(e.target)
      edgePaths.push({
        d,
        source: e.source,
        target: e.target,
        charted: e.charted,
        incident: isInc,
        selected: isSel,
        searchRelated: isSearchRel,
        isFaded: isFadedEdge,
      })
    }

    return { nodeMap: map, edges: edgePaths }
  }, [layout, chart.edges, selectedId, hoverId, highlightKind, hideRocks, newOnly, searchMatch])

  const { moduleColors, bounds, pos: _pos } = layout

  useEffect(() => {
    viewRef.current = {
      minX: bounds.minX - (bounds.size - (bounds.maxX - bounds.minX)) / 2,
      minY: bounds.minY - (bounds.size - (bounds.maxY - bounds.minY)) / 2,
      size: bounds.size,
    }
    setMounted(true)
  }, [bounds])

  // Track the container width in state so the tooltip can clamp itself
  // during render without reading a ref (which the linter forbids).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.clientWidth)
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Animate the viewBox to a focused node when focusId changes.
  useEffect(() => {
    if (focusId == null) return
    const target = nodeMap.get(focusId)
    if (!target) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const aspect = rect.width / rect.height
    const targetSize = focusZoom ?? 220
    const size = Math.max(targetSize, 80)
    const cx = target.x
    const cy = target.y
    const minX = aspect >= 1 ? cx - size / 2 : cx - size * aspect / 2
    const minY = aspect >= 1 ? cy - size / (2 * aspect) : cy - size / 2
    const start = { ...viewRef.current }
    const end = { minX, minY, size }
    const duration = 700
    const startTime = performance.now()
    let raf = 0
    const animateView = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      const e = 1 - Math.pow(1 - t, 3)
      const v = {
        minX: start.minX + (end.minX - start.minX) * e,
        minY: start.minY + (end.minY - start.minY) * e,
        size: start.size + (end.size - start.size) * e,
      }
      viewRef.current = v
      const svg = svgRef.current
      if (svg) svg.setAttribute('viewBox', `${v.minX} ${v.minY} ${v.size} ${v.size}`)
      setMiniMapTick((t) => (t + 1) & 0xffff)
      if (t < 1) raf = requestAnimationFrame(animateView)
    }
    raf = requestAnimationFrame(animateView)
    return () => cancelAnimationFrame(raf)
  }, [focusId, focusZoom, nodeMap])

  useEffect(() => {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container) return

    const render = () => {
      const v = viewRef.current
      svg.setAttribute('viewBox', `${v.minX} ${v.minY} ${v.size} ${v.size}`)
      setMiniMapTick((t) => (t + 1) & 0xffff)
    }
    render()

    let dragRaf = 0
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      dragRef.current = { x: e.clientX, y: e.clientY, vx: 0, vy: 0, button: e.button }
      dragMovedRef.current = false
      setIsDragging(true)
    }
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const rect = svg.getBoundingClientRect()
      const v = viewRef.current
      const dxScreen = e.clientX - drag.x
      const dyScreen = e.clientY - drag.y
      if (Math.hypot(dxScreen, dyScreen) > 4) dragMovedRef.current = true
      const scale = v.size / rect.width
      v.minX -= dxScreen * scale
      v.minY -= dyScreen * scale
      drag.vx = -dxScreen * scale
      drag.vy = -dyScreen * scale
      drag.x = e.clientX
      drag.y = e.clientY
      render()
      if (tooltipRef.current) {
        const next = { ...tooltipRef.current, x: e.clientX - rect.left, y: e.clientY - rect.top }
        tooltipRef.current = next
        setTooltipState(next)
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current
      ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
      if (!drag) {
        setIsDragging(false)
        return
      }
      if (!dragMovedRef.current && drag.button === 0) {
        const target = e.target as Element
        const nodeEl = target.closest('[data-node]') as HTMLElement | null
        if (nodeEl) {
          onSelect(Number(nodeEl.dataset.node))
        } else if (target === svg) {
          onSelect(null)
        }
      }
      dragRef.current = null
      setIsDragging(false)
      const applyInertia = () => {
        if (!dragRef.current && Math.hypot(drag.vx, drag.vy) > 0.4) {
          const v = viewRef.current
          v.minX += drag.vx
          v.minY += drag.vy
          drag.vx *= 0.93
          drag.vy *= 0.93
          render()
          dragRaf = requestAnimationFrame(applyInertia)
        }
      }
      dragRaf = requestAnimationFrame(applyInertia)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const v = viewRef.current
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const worldX = v.minX + (cx / rect.width) * v.size
      const worldY = v.minY + (cy / rect.height) * v.size
      const intensity = e.ctrlKey ? 0.01 : 0.0014
      const factor = Math.exp(e.deltaY * intensity)
      v.size = Math.min(Math.max(v.size * factor, 80), 12000)
      v.minX = worldX - (cx / rect.width) * v.size
      v.minY = worldY - (cy / rect.height) * v.size
      render()
    }

    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDist.current = Math.hypot(dx, dy)
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDist.current != null) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const factor = lastPinchDist.current / dist
        const v = viewRef.current
        v.size = Math.min(Math.max(v.size * factor, 80), 12000)
        lastPinchDist.current = dist
        render()
      }
    }
    const onTouchEnd = () => { lastPinchDist.current = null }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const v = viewRef.current
      const step = v.size * 0.18
      if (e.key === 'ArrowLeft') v.minX -= step
      else if (e.key === 'ArrowRight') v.minX += step
      else if (e.key === 'ArrowUp') v.minY -= step
      else if (e.key === 'ArrowDown') v.minY += step
      else if (e.key === '+' || e.key === '=') v.size = Math.max(v.size * 0.82, 80)
      else if (e.key === '-' || e.key === '_') v.size = Math.min(v.size * 1.22, 12000)
      else if (e.key === '0') {
        viewRef.current = {
          minX: bounds.minX - (bounds.size - (bounds.maxX - bounds.minX)) / 2,
          minY: bounds.minY - (bounds.size - (bounds.maxY - bounds.minY)) / 2,
          size: bounds.size,
        }
      } else return
      e.preventDefault()
      render()
    }

    svg.addEventListener('pointerdown', onPointerDown)
    svg.addEventListener('pointermove', onPointerMove)
    svg.addEventListener('pointerup', onPointerUp)
    svg.addEventListener('pointercancel', onPointerUp)
    svg.addEventListener('wheel', onWheel, { passive: false })
    svg.addEventListener('contextmenu', onContextMenu)
    svg.addEventListener('touchstart', onTouchStart, { passive: true })
    svg.addEventListener('touchmove', onTouchMove, { passive: false })
    svg.addEventListener('touchend', onTouchEnd)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(dragRaf)
      svg.removeEventListener('pointerdown', onPointerDown)
      svg.removeEventListener('pointermove', onPointerMove)
      svg.removeEventListener('pointerup', onPointerUp)
      svg.removeEventListener('pointercancel', onPointerUp)
      svg.removeEventListener('wheel', onWheel)
      svg.removeEventListener('contextmenu', onContextMenu)
      svg.removeEventListener('touchstart', onTouchStart)
      svg.removeEventListener('touchmove', onTouchMove)
      svg.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [bounds, onSelect])

  const nodeList = useMemo(() => Array.from(nodeMap.values()), [nodeMap])

  const handleNodeEnter = (n: NodePos, e: React.MouseEvent) => {
    setHoverId(n.id)
    onHover?.(n.id)
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: n })
    }
  }
  const handleNodeMove = (n: NodePos, e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: n })
    }
  }
  const handleNodeLeave = () => {
    setHoverId(null)
    onHover?.(null)
    setTooltip(null)
  }

  const labelCutoff = 12
  const showAllLabels = nodeList.length <= 50

  // Compute mini-map viewport rect — re-runs on every interaction via
  // miniMapTick so the rect tracks pan/zoom/focus in real time.
  const miniMap = useMemo(() => {
    if (!bounds.size) return null
    const mapSize = 168
    const v = viewRef.current
    const visibleMinX = Math.max(v.minX, bounds.minX)
    const visibleMinY = Math.max(v.minY, bounds.minY)
    const visibleMaxX = Math.min(v.minX + v.size, bounds.maxX)
    const visibleMaxY = Math.min(v.minY + v.size, bounds.maxY)
    const scale = mapSize / bounds.size
    return {
      scale,
      vx: (visibleMinX - bounds.minX) * scale,
      vy: (visibleMinY - bounds.minY) * scale,
      vs: (visibleMaxX - visibleMinX) * scale,
      vsh: (visibleMaxY - visibleMinY) * scale,
      size: mapSize,
      bounds,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, nodeList.length, miniMapTick])

  return (
    <div ref={containerRef} className={`chart-canvas-2d ${mounted ? 'mounted' : ''}`}>
      <div className="compass-rose" aria-hidden="true">
        <svg viewBox="-50 -50 100 100" width="120" height="120">
          <defs>
            <radialGradient id="compass-face" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--void-soft)" stopOpacity="0.6" />
              <stop offset="80%" stopColor="var(--void)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="compass-needle-n" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--gold-bright)" />
              <stop offset="100%" stopColor="var(--gold)" />
            </linearGradient>
            <linearGradient id="compass-needle-s" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--ink-dim)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--ink-dim)" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Outer face — soft halo */}
          <circle r="48" fill="url(#compass-face)" />

          {/* Outer ring (the bezel) */}
          <circle r="44" fill="none" stroke="var(--gold-soft)" strokeWidth="0.6" opacity="0.7" />
          <circle r="40" fill="none" stroke="var(--gold-soft)" strokeWidth="0.3" opacity="0.4" />

          {/* Tick marks: major at 8 cardinal/intercardinal, minor every 11.25° */}
          <g className="compass-rose-ticks">
            {Array.from({ length: 32 }, (_, i) => {
              const a = (i * 360) / 32
              const rad = (a - 90) * (Math.PI / 180)
              const isMajor = i % 4 === 0
              const r1 = isMajor ? 30 : 33
              const r2 = 38
              return (
                <line
                  key={i}
                  x1={Math.cos(rad) * r1}
                  y1={Math.sin(rad) * r1}
                  x2={Math.cos(rad) * r2}
                  y2={Math.sin(rad) * r2}
                  stroke={isMajor ? 'var(--gold)' : 'var(--ink-dim)'}
                  strokeWidth={isMajor ? 0.9 : 0.3}
                  opacity={isMajor ? 0.85 : 0.4}
                />
              )
            })}
          </g>

          {/* Cardinal letters */}
          <g className="compass-rose-letters" fontFamily="'Spectral', serif" fontStyle="italic" textAnchor="middle">
            <text x="0" y="-32" fontSize="7" fill="var(--gold-bright)" fontWeight="500">N</text>
            <text x="0" y="36" fontSize="6" fill="var(--ink-dim)">S</text>
            <text x="-35" y="2" fontSize="6" fill="var(--ink-dim)">W</text>
            <text x="35" y="2" fontSize="6" fill="var(--ink-dim)">E</text>
          </g>

          {/* Inner ring (compass card edge) */}
          <circle r="22" fill="none" stroke="var(--gold-soft)" strokeWidth="0.4" opacity="0.6" />

          {/* Compass needle — north half gold, south half dim */}
          <g className="compass-rose-star">
            <polygon points="0,-22 4,0 0,22 -4,0" fill="url(#compass-needle-n)" opacity="0.95" />
            <polygon points="0,22 4,0 0,-22 -4,0" fill="url(#compass-needle-s)" opacity="0.7" />
            {/* Pivot */}
            <circle r="2.2" fill="var(--void)" stroke="var(--gold)" strokeWidth="0.6" />
            <circle r="0.8" fill="var(--gold-bright)" />
          </g>
        </svg>
      </div>
      <svg ref={svgRef} className="chart-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={PALETTE.edgeCharted} />
          </marker>
          <marker id="arrowhead-est" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={PALETTE.edgeEst} />
          </marker>
          <marker id="arrowhead-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={PALETTE.goldBright} />
          </marker>
          <radialGradient id="bgGlow" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#15172a" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#05060a" stopOpacity="0" />
          </radialGradient>
          <filter id="nodeHalo" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
          <radialGradient id="moduleGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="65%" stopColor="currentColor" stopOpacity="0.06" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="-8000" y="-8000" width="16000" height="16000" fill="url(#bgGlow)" />

        <g className="module-halos" opacity="0.18" pointerEvents="none">
          {(() => {
            const groups = new Map<string, { x: number; y: number; nodes: NodePos[] }>()
            const activeModule = hoverId != null
              ? nodeList.find((n) => n.id === hoverId)?.module
              : selectedId != null
                ? nodeList.find((n) => n.id === selectedId)?.module
                : null
            for (const n of nodeList) {
              if (n.isFaded && !n.isLighthouse && !n.isPort) continue
              const g = groups.get(n.module) ?? { x: 0, y: 0, nodes: [] }
              g.x += n.x
              g.y += n.y
              g.nodes.push(n)
              groups.set(n.module, g)
            }
            return Array.from(groups.entries()).map(([m, g]) => {
              const cx = g.x / g.nodes.length
              const cy = g.y / g.nodes.length
              const radius = Math.max(...g.nodes.map((n) => Math.hypot(n.x - cx, n.y - cy))) + 60
              const color = moduleColors.get(m) ?? PALETTE.gold
              const isActive = m === activeModule
              return (
                <g key={m} style={{ color }} className={isActive ? 'module-active' : ''}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="url(#moduleGlow)"
                    stroke={color}
                    strokeWidth={isActive ? 0.8 : 0.4}
                    strokeOpacity={isActive ? 0.55 : 0.22}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius * 1.18}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.2"
                    strokeOpacity={isActive ? 0.3 : 0.1}
                    strokeDasharray="2 4"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from={`0 ${cx} ${cy}`}
                      to={`360 ${cx} ${cy}`}
                      dur="120s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  {isActive && (
                    <text
                      x={cx}
                      y={cy - radius - 14}
                      textAnchor="middle"
                      fontSize="9"
                      letterSpacing="0.18em"
                      fontFamily="IBM Plex Mono, monospace"
                      fill={color}
                      opacity="0.7"
                    >
                      {m.toUpperCase()}
                    </text>
                  )}
                </g>
              )
            })
          })()}
        </g>

        <g className="edges">
          {edges.map((e, i) => {
            const stroke = e.incident
              ? PALETTE.goldBright
              : e.searchRelated
                ? PALETTE.azure
                : e.isFaded
                  ? 'rgba(61, 58, 47, 0.12)'
                  : e.charted
                    ? PALETTE.edgeCharted
                    : PALETTE.edgeEst
            const opacity = e.incident
              ? 0.95
              : e.searchRelated
                ? 0.85
                : e.isFaded
                  ? 0.4
                  : 0.55
            const sw = e.incident ? 2 : e.searchRelated ? 1.6 : e.charted ? 0.9 : 0.6
            const marker = e.incident
              ? 'url(#arrowhead-hot)'
              : e.charted
                ? 'url(#arrowhead)'
                : 'url(#arrowhead-est)'
            return (
              <path
                key={i}
                d={e.d}
                stroke={stroke}
                strokeWidth={sw}
                strokeDasharray={e.charted ? undefined : '4 3'}
                opacity={opacity}
                fill="none"
                markerEnd={marker}
                pointerEvents="none"
                className="edge"
              />
            )
          })}
        </g>

        <g className="nodes">
          {nodeList.map((n) => {
            const isSel = selectedId === n.id
            const isHover = hoverId === n.id
            const showLabel = isSel || isHover || n.r >= labelCutoff || showAllLabels || n.isLighthouse || n.isNew
            const opacity = n.isFaded ? 0.25 : 1
            const fontSize = Math.max(8, Math.min(n.r * 0.85, 14))
            return (
              <g
                key={n.id}
                data-node={n.id}
                transform={`translate(${n.x} ${n.y})`}
                style={{ cursor: 'pointer', opacity }}
                onMouseEnter={(e) => handleNodeEnter(n, e)}
                onMouseMove={(e) => handleNodeMove(n, e)}
                onMouseLeave={handleNodeLeave}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  if (onOpenInEditor) onOpenInEditor(n.id)
                }}
                className={`node ${isSel ? 'selected' : ''} ${isHover ? 'hovered' : ''} ${n.isLighthouse ? 'lighthouse' : ''} ${n.isPort ? 'port' : ''} ${n.isRock ? 'rock' : ''} ${n.isExpedition ? 'expedition' : ''} ${n.isNew ? 'new' : ''} ${n.isSearchHit ? 'search-hit' : ''}`}
              >
                {(isSel || n.isLighthouse || n.isNew) && (
                  <circle
                    r={n.r + 6}
                    fill="none"
                    stroke={isSel ? PALETTE.goldBright : n.isLighthouse ? PALETTE.gold : PALETTE.goldBright}
                    strokeWidth={isSel ? 1.5 : 0.6}
                    opacity={isSel ? 0.8 : 0.45}
                    strokeDasharray={n.isNew && !isSel ? '2 2' : undefined}
                  />
                )}
                {isSel && (
                  <circle r={n.r + 12} fill="none" stroke={PALETTE.goldBright} strokeWidth={0.4} opacity={0.4} />
                )}
                <circle
                  r={n.r}
                  fill={n.fill}
                  fillOpacity={n.isRock ? 0.55 : 0.95}
                  stroke={n.stroke}
                  strokeWidth={isSel ? 1.8 : isHover ? 1.4 : 0.8}
                  className="node-body"
                />
                {n.isExpedition && !n.isRock && (
                  <circle r={n.r * 0.5} fill="none" stroke={PALETTE.rose} strokeWidth={0.6} strokeDasharray="1 1.5" />
                )}
                {showLabel && (
                  <text
                    y={n.r + fontSize + 2}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fill={n.isNew ? PALETTE.goldBright : isSel ? PALETTE.ink : n.isLighthouse ? PALETTE.gold : PALETTE.ink}
                    fontFamily="'IBM Plex Mono', 'Cascadia Mono', monospace"
                    fontWeight={isSel || n.isLighthouse || n.isNew ? 600 : 400}
                    pointerEvents="none"
                    className="node-label"
                  >
                    {n.name}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {tooltip && !isDragging && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(tooltip.x + 14, containerWidth - 240),
            top: Math.max(tooltip.y - 12, 12),
          }}
        >
          <div className="tooltip-kicker">{kindLabel(tooltip.node.kind)} · {tooltip.node.module || 'root'}</div>
          <div className="tooltip-name">{tooltip.node.name}</div>
          <div className="tooltip-stats">
            <span><b>{tooltip.node.inbound}</b> in</span>
            <span><b>{tooltip.node.outbound}</b> out</span>
          </div>
          {tooltip.node.isLighthouse && <div className="tooltip-badge lighthouse">Lighthouse</div>}
          {tooltip.node.isPort && <div className="tooltip-badge port">Port of departure</div>}
          {tooltip.node.isExpedition && <div className="tooltip-badge expedition">Expedition</div>}
          {tooltip.node.isRock && <div className="tooltip-badge rock">Rock</div>}
          {tooltip.node.isNew && <div className="tooltip-badge new">New</div>}
          <div className="tooltip-file">{tooltip.node.file}:{tooltip.node.row}</div>
        </div>
      )}

      {showMiniMap && miniMap && nodeList.length > 5 && (
        <MiniMap
          size={miniMap.size}
          scale={miniMap.scale}
          bounds={miniMap.bounds}
          vx={miniMap.vx}
          vy={miniMap.vy}
          vs={miniMap.vs}
          vsh={miniMap.vsh}
          nodes={nodeList}
          onJump={(worldX, worldY) => {
            const container = containerRef.current
            if (!container) return
            const rect = container.getBoundingClientRect()
            const aspect = rect.width / rect.height
            const v = viewRef.current
            const minX = aspect >= 1 ? worldX - v.size / 2 : worldX - v.size * aspect / 2
            const minY = aspect >= 1 ? worldY - v.size / (2 * aspect) : worldY - v.size / 2
            viewRef.current = { ...v, minX, minY }
            const svg = svgRef.current
            if (svg) svg.setAttribute('viewBox', `${minX} ${minY} ${v.size} ${v.size}`)
            setMiniMapTick((t) => (t + 1) & 0xffff)
          }}
          onClose={() => setShowMiniMap(false)}
          title={t.minimap?.title ?? 'Chart'}
          hideLabel={t.minimap?.hide ?? 'Hide minimap'}
        />
      )}
    </div>
  )
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'function': return 'Function'
    case 'method': return 'Method'
    case 'class': return 'Class'
    case 'var': return 'Variable'
    default: return kind
  }
}

interface MiniMapProps {
  size: number
  scale: number
  bounds: { minX: number; minY: number; maxX: number; maxY: number; size: number }
  vx: number
  vy: number
  vs: number
  vsh: number
  nodes: NodePos[]
  onJump: (worldX: number, worldY: number) => void
  onClose: () => void
  title: string
  hideLabel: string
}

function MiniMap({ size, scale, bounds, vx, vy, vs, vsh, nodes, onJump, onClose, title, hideLabel }: MiniMapProps) {
  const [hover, setHover] = useState<{ vx: number; vy: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * size
    const y = ((e.clientY - rect.top) / rect.height) * size
    setHover({ vx: x, vy: y })
    if (e.buttons & 1) {
      setDragging(true)
      onJump(
        bounds.minX + x / scale,
        bounds.minY + y / scale,
      )
    } else {
      setDragging(false)
    }
  }

  return (
    <div
      className="mini-map"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="mini-map-header">
        <span className="mini-map-title">{title}</span>
        <button
          className="mini-map-close"
          onClick={(e) => { e.stopPropagation(); onClose() }}
          title={hideLabel}
          aria-label={hideLabel}
        >
          ×
        </button>
      </div>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        onPointerDown={(e) => { e.stopPropagation(); handlePointer(e) }}
        onPointerMove={handlePointer}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => { setHover(null); setDragging(false) }}
        style={{ cursor: dragging ? 'grabbing' : 'crosshair' }}
      >
        <rect
          width={size}
          height={size}
          fill="rgba(5, 6, 10, 0.85)"
          stroke="rgba(212, 168, 87, 0.35)"
        />
        {nodes.map((n) => {
          const x = (n.x - bounds.minX) * scale
          const y = (n.y - bounds.minY) * scale
          return (
            <circle
              key={n.id}
              cx={x}
              cy={y}
              r={Math.max(0.8, n.r * scale * 0.45)}
              fill={n.isFaded ? 'rgba(138, 130, 117, 0.3)' : n.fill}
              opacity={n.isFaded ? 0.3 : 0.92}
              pointerEvents="none"
            />
          )
        })}
        {hover && (
          <>
            <line x1={hover.vx} y1={0} x2={hover.vx} y2={size} stroke="rgba(212, 168, 87, 0.3)" strokeDasharray="2 2" pointerEvents="none" />
            <line x1={0} y1={hover.vy} x2={size} y2={hover.vy} stroke="rgba(212, 168, 87, 0.3)" strokeDasharray="2 2" pointerEvents="none" />
          </>
        )}
        <rect
          x={vx}
          y={vy}
          width={vs}
          height={vsh}
          fill="rgba(242, 207, 128, 0.1)"
          stroke={PALETTE.goldBright}
          strokeWidth={1.4}
          pointerEvents="none"
        />
      </svg>
    </div>
  )
}

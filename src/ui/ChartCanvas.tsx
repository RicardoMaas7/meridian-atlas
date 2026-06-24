import { useEffect, useMemo, useRef } from 'react'
import type { CodeChart } from '../types'
import { startLayout } from '../graph/layout'

interface Props {
  chart: CodeChart
  selectedId: number | null
  newIds: Set<number>
  onSelect: (id: number | null) => void
}

const PALETTE = {
  void: '#05060a',
  ink: '#efe7d3',
  inkDim: '#8a8275',
  gold: '#d4a857',
  goldBright: '#f2cf80',
  copper: '#c87856',
  azure: '#4a8fc5',
  edge: '#6a6049',
  edgeHot: '#f2cf80',
  edgeEst: '#4a4536',
}

interface NodePos {
  id: number
  x: number
  y: number
  r: number
  color: string
  stroke: string
  kind: string
  name: string
  inbound: number
  outbound: number
  isNew: boolean
  isRock: boolean
}

interface EdgePath {
  d: string
  mid: { x: number; y: number }
  charted: boolean
  source: number
  target: number
  selected: boolean
  incident: boolean
}

interface ViewBox {
  minX: number
  minY: number
  size: number
}

export function ChartCanvas({ chart, selectedId, newIds, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<ViewBox>({ minX: -500, minY: -500, size: 1000 })
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const dragMovedRef = useRef(false)
  const lastPinchDist = useRef<number | null>(null)

  const { nodeMap, edges, bounds } = useMemo(() => {
    const { simulation } = startLayout(chart)
    for (let i = 0; i < 200; i++) simulation.tick()
    const pos = new Map<number, { x: number; y: number }>()
    for (const n of chart.nodes) pos.set(n.id, { x: n.x, y: n.y })
    simulation.stop()

    const map = new Map<number, NodePos>()
    for (const n of chart.nodes) {
      const p = pos.get(n.id)
      if (!p) continue
      const importance = Math.sqrt(n.inbound + n.outbound)
      const r = 6 + Math.min(importance * 1.6, 14)
      const isRock = n.inbound === 0 && n.outbound === 0
      const isNew = newIds.has(n.id)
      map.set(n.id, {
        id: n.id,
        x: p.x,
        y: p.y,
        r,
        color: isRock ? PALETTE.inkDim : isNew ? PALETTE.goldBright : PALETTE.ink,
        stroke: isNew ? PALETTE.goldBright : isRock ? PALETTE.copper : PALETTE.gold,
        kind: n.kind,
        name: n.name,
        inbound: n.inbound,
        outbound: n.outbound,
        isNew,
        isRock,
      })
    }

    const incident = new Set<number>()
    if (selectedId != null) {
      incident.add(selectedId)
      for (const e of chart.edges) {
        if (e.source === selectedId) incident.add(e.target)
        if (e.target === selectedId) incident.add(e.source)
      }
    }

    const edgePaths: EdgePath[] = chart.edges.flatMap((e) => {
      const a = pos.get(e.source)
      const b = pos.get(e.target)
      if (!a || !b) return []
      const na = map.get(e.source)
      const nb = map.get(e.target)
      if (!na || !nb) return []
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const ax = a.x + ux * na.r
      const ay = a.y + uy * na.r
      const bx = b.x - ux * nb.r
      const by = b.y - uy * nb.r
      const mx = (ax + bx) / 2
      const my = (ay + by) / 2
      const isSel = selectedId != null
      const isInc = isSel && (e.source === selectedId || e.target === selectedId)
      return [{
        d: `M ${ax} ${ay} L ${bx} ${by}`,
        mid: { x: mx, y: my },
        charted: e.charted,
        source: e.source,
        target: e.target,
        selected: isSel,
        incident: isInc,
      }]
    })

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of pos.values()) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    const pad = 80
    minX -= pad
    minY -= pad
    maxX += pad
    maxY += pad
    const size = Math.max(maxX - minX, maxY - minY)

    return { nodeMap: map, edges: edgePaths, bounds: { minX, minY, maxX, maxY, size } }
  }, [chart, newIds, selectedId])

  useEffect(() => {
    viewRef.current = {
      minX: bounds.minX - (bounds.size - (bounds.maxX - bounds.minX)) / 2,
      minY: bounds.minY - (bounds.size - (bounds.maxY - bounds.minY)) / 2,
      size: bounds.size,
    }
  }, [bounds])

  useEffect(() => {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container) return

    const render = () => {
      const v = viewRef.current
      svg.setAttribute('viewBox', `${v.minX} ${v.minY} ${v.size} ${v.size}`)
    }
    render()

    let dragRaf = 0
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      dragRef.current = { x: e.clientX, y: e.clientY, vx: 0, vy: 0 }
      dragMovedRef.current = false
    }
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const rect = svg.getBoundingClientRect()
      const v = viewRef.current
      const dxScreen = e.clientX - drag.x
      const dyScreen = e.clientY - drag.y
      if (Math.hypot(dxScreen, dyScreen) > 3) dragMovedRef.current = true
      const scale = v.size / rect.width
      v.minX -= dxScreen * scale
      v.minY -= dyScreen * scale
      drag.vx = -dxScreen * scale
      drag.vy = -dyScreen * scale
      drag.x = e.clientX
      drag.y = e.clientY
      render()
    }
    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current
      ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
      if (!drag) return
      if (!dragMovedRef.current && e.button === 0) {
        const target = e.target as Element
        const nodeId = target.closest('[data-node]')?.getAttribute('data-node')
        if (nodeId) onSelect(Number(nodeId))
        else if (target === svg) onSelect(null)
      }
      dragRef.current = null
      const applyInertia = () => {
        if (!dragRef.current && Math.hypot(drag.vx, drag.vy) > 0.4) {
          const v = viewRef.current
          v.minX += drag.vx
          v.minY += drag.vy
          drag.vx *= 0.92
          drag.vy *= 0.92
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
      // Natural scroll: wheel up (deltaY < 0) = zoom in (smaller viewBox).
      const intensity = e.ctrlKey ? 0.01 : 0.0015
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

  return (
    <div ref={containerRef} className="chart-canvas-2d">
      <svg ref={svgRef} className="chart-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker
            id="arrowhead"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={PALETTE.gold} />
          </marker>
          <marker
            id="arrowhead-est"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={PALETTE.edgeEst} />
          </marker>
          <marker
            id="arrowhead-hot"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={PALETTE.goldBright} />
          </marker>
          <radialGradient id="bgGlow" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#1a1a2a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#05060a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#bgGlow)" />

        <g className="edges">
          {edges.map((e, i) => {
            const stroke = e.incident
              ? PALETTE.edgeHot
              : e.selected
                ? PALETTE.edge
                : e.charted
                  ? PALETTE.gold
                  : PALETTE.edgeEst
            const opacity = e.selected ? (e.incident ? 0.95 : 0.15) : 0.55
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
                strokeWidth={e.incident ? 1.6 : e.charted ? 1.1 : 0.8}
                strokeDasharray={e.charted ? undefined : '5 4'}
                opacity={opacity}
                fill="none"
                markerEnd={marker}
                pointerEvents="none"
              />
            )
          })}
        </g>

        <g className="nodes">
          {nodeList.map((n) => {
            const isSel = selectedId === n.id
            return (
              <g
                key={n.id}
                data-node={n.id}
                transform={`translate(${n.x} ${n.y})`}
                style={{ cursor: 'pointer' }}
              >
                {isSel && (
                  <circle r={n.r + 8} fill="none" stroke={PALETTE.goldBright} strokeWidth={1.5} opacity={0.7} />
                )}
                <circle
                  r={n.r}
                  fill={n.color}
                  fillOpacity={n.isRock ? 0.6 : 0.95}
                  stroke={n.stroke}
                  strokeWidth={isSel ? 2 : 1}
                />
                {n.inbound + n.outbound >= 3 && (
                  <circle r={n.r + 4} fill="none" stroke={PALETTE.gold} strokeWidth={0.4} opacity={0.5} />
                )}
                {n.isNew && (
                  <circle r={n.r + 3} fill="none" stroke={PALETTE.goldBright} strokeWidth={1} strokeDasharray="2 2" />
                )}
                <text
                  y={n.r + 12}
                  textAnchor="middle"
                  fontSize={Math.max(n.r, 7)}
                  fill={n.isNew ? PALETTE.goldBright : PALETTE.inkDim}
                  fontFamily="'IBM Plex Mono', monospace"
                  pointerEvents="none"
                >
                  {n.name}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

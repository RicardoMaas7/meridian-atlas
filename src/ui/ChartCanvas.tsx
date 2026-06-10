import { useEffect, useRef } from 'react'
import type { CodeChart, ChartNode } from '../types'
import { nodeRadius, startLayout } from '../graph/layout'
import type { SimEdge } from '../graph/layout'

interface Props {
  chart: CodeChart
  selectedId: number | null
  newIds: Set<number>
  onSelect: (id: number | null) => void
}

const INK = '#2a241c'
const ULTRAMARINE = '#1f4e79'
const VERMILION = '#a63d2f'
const PAPER = '#f2e9d8'

interface View {
  x: number
  y: number
  scale: number
}

export function ChartCanvas({ chart, selectedId, newIds, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<View>({ x: 0, y: 0, scale: 1 })
  const edgesRef = useRef<SimEdge[]>([])
  const hoverRef = useRef<ChartNode | null>(null)
  const selectedRef = useRef<number | null>(selectedId)
  const newIdsRef = useRef<Set<number>>(newIds)
  const frameRef = useRef(0)
  const drawRef = useRef<() => void>(() => {})

  selectedRef.current = selectedId
  newIdsRef.current = newIds

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { simulation, simEdges } = startLayout(chart)
    edgesRef.current = simEdges

    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
    }
    resize()
    const ro = new ResizeObserver(() => {
      resize()
      draw()
    })
    ro.observe(canvas)

    // Fit the chart to the viewport once the simulation has roughly settled.
    let fitted = false
    const fit = () => {
      const xs = chart.nodes.map((n) => n.x)
      const ys = chart.nodes.map((n) => n.y)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const scale = Math.min(
        2,
        0.85 * Math.min(w / Math.max(maxX - minX, 100), h / Math.max(maxY - minY, 100)),
      )
      viewRef.current = {
        scale,
        x: w / 2 - ((minX + maxX) / 2) * scale,
        y: h / 2 - ((minY + maxY) / 2) * scale,
      }
    }

    const moduleAnchors = () => {
      const sums = new Map<string, { x: number; y: number; n: number }>()
      for (const node of chart.nodes) {
        const s = sums.get(node.module) ?? { x: 0, y: 0, n: 0 }
        s.x += node.x
        s.y += node.y
        s.n++
        sums.set(node.module, s)
      }
      return sums
    }

    function draw() {
      if (!ctx || !canvas) return
      const view = viewRef.current
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      ctx.save()
      ctx.translate(view.x, view.y)
      ctx.scale(view.scale, view.scale)

      drawGraticule(ctx, view, w, h)

      const selected = selectedRef.current
      const hover = hoverRef.current
      const neighborhood = new Set<number>()
      if (selected != null) {
        neighborhood.add(selected)
        for (const e of edgesRef.current) {
          if (e.source.id === selected) neighborhood.add(e.target.id)
          if (e.target.id === selected) neighborhood.add(e.source.id)
        }
      }

      // Routes (edges): gently curved like plotted courses, with a mid-route
      // arrow giving the direction of the call. Charted = solid ultramarine;
      // estimated = dashed faint ink.
      for (const e of edgesRef.current) {
        const touchesSelection =
          selected != null && (e.source.id === selected || e.target.id === selected)
        const dx = e.target.x - e.source.x
        const dy = e.target.y - e.source.y
        const dist = Math.hypot(dx, dy) || 1
        // Control point offset perpendicular to the route, proportional to length.
        const cx = (e.source.x + e.target.x) / 2 - dy * 0.12
        const cy = (e.source.y + e.target.y) / 2 + dx * 0.12

        ctx.beginPath()
        ctx.moveTo(e.source.x, e.source.y)
        ctx.quadraticCurveTo(cx, cy, e.target.x, e.target.y)
        if (touchesSelection) {
          ctx.strokeStyle = VERMILION
          ctx.globalAlpha = 0.85
          ctx.lineWidth = 1.6 / view.scale
          ctx.setLineDash(e.charted ? [] : [4 / view.scale, 4 / view.scale])
        } else {
          ctx.strokeStyle = e.charted ? ULTRAMARINE : INK
          ctx.globalAlpha = selected != null ? 0.08 : e.charted ? 0.32 : 0.18
          ctx.lineWidth = 1 / view.scale
          ctx.setLineDash(e.charted ? [] : [4 / view.scale, 4 / view.scale])
        }
        ctx.stroke()
        ctx.setLineDash([])

        // Direction arrow at the curve midpoint, oriented along the tangent.
        if (dist > 36 && (touchesSelection || selected == null)) {
          const mx = 0.25 * e.source.x + 0.5 * cx + 0.25 * e.target.x
          const my = 0.25 * e.source.y + 0.5 * cy + 0.25 * e.target.y
          const tx = (e.target.x - e.source.x) / dist
          const ty = (e.target.y - e.source.y) / dist
          const s = 4.5 / view.scale
          ctx.beginPath()
          ctx.moveTo(mx - tx * s - ty * s * 0.8, my - ty * s + tx * s * 0.8)
          ctx.lineTo(mx + tx * s, my + ty * s)
          ctx.lineTo(mx - tx * s + ty * s * 0.8, my - ty * s - tx * s * 0.8)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // Module names drawn like sea names: Spectral italic, sparse, behind nodes.
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const [name, s] of moduleAnchors()) {
        ctx.font = `italic 500 ${26 / view.scale}px Spectral, serif`
        ctx.fillStyle = 'rgba(42, 36, 28, 0.16)'
        ctx.fillText(name.toUpperCase(), s.x / s.n, s.y / s.n)
      }

      // Symbols (nodes): engraved circles, soundings as ring size. Isolated
      // symbols are drawn as rock hazards (+), as on a real chart.
      for (const node of chart.nodes) {
        const r = nodeRadius(node)
        const isSelected = node.id === selected
        const isHover = hover?.id === node.id
        const dimmed = selected != null && !neighborhood.has(node.id)
        ctx.globalAlpha = dimmed ? 0.4 : 1
        ctx.strokeStyle = isSelected ? VERMILION : ULTRAMARINE

        if (node.inbound === 0 && node.outbound === 0 && !isSelected && !isHover) {
          // Uncharted rock: a small +, ink-colored, slightly faint.
          const s = 3.5
          ctx.strokeStyle = 'rgba(42, 36, 28, 0.55)'
          ctx.lineWidth = 1.1 / view.scale
          ctx.beginPath()
          ctx.moveTo(node.x - s, node.y)
          ctx.lineTo(node.x + s, node.y)
          ctx.moveTo(node.x, node.y - s)
          ctx.lineTo(node.x, node.y + s)
          ctx.stroke()
          ctx.globalAlpha = 1
          continue
        }

        const isNew = newIdsRef.current.has(node.id)
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
        // New since last survey: inked solid, the freshly-drawn mark.
        ctx.fillStyle = isNew ? ULTRAMARINE : PAPER
        ctx.fill()
        ctx.lineWidth = (isSelected || isHover ? 2.2 : 1.3) / view.scale
        ctx.stroke()

        if (node.kind === 'class') {
          // Double ring: a class is a lighthouse, not a buoy.
          ctx.beginPath()
          ctx.arc(node.x, node.y, r + 2.5, 0, Math.PI * 2)
          ctx.lineWidth = 0.8 / view.scale
          ctx.stroke()
        } else if (node.kind === 'method') {
          // Methods carry a center dot, like a fixed mark.
          ctx.beginPath()
          ctx.arc(node.x, node.y, 1.2 / view.scale, 0, Math.PI * 2)
          ctx.fillStyle = isSelected ? VERMILION : ULTRAMARINE
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      // Labels: only when legible (zoomed in) or for prominent symbols.
      // A paper-colored halo keeps them readable over routes.
      const labelThreshold = view.scale > 1.1 ? 0 : view.scale > 0.55 ? 3 : 7
      ctx.textAlign = 'left'
      for (const node of chart.nodes) {
        const isFocus =
          node.id === selected || node.id === hover?.id || newIdsRef.current.has(node.id)
        if (!isFocus && node.inbound < labelThreshold) continue
        if (selected != null && !neighborhood.has(node.id) && !isFocus) continue
        const r = nodeRadius(node)
        const lx = node.x + r + 4 / view.scale
        ctx.font = `${11 / view.scale}px 'IBM Plex Mono', monospace`
        ctx.strokeStyle = PAPER
        ctx.lineWidth = 3 / view.scale
        ctx.strokeText(node.name, lx, node.y)
        ctx.fillStyle = isFocus ? VERMILION : 'rgba(42, 36, 28, 0.78)'
        ctx.fillText(node.name, lx, node.y)
        if (isFocus) {
          // The sounding figure, as depth numbers beside a mark.
          ctx.font = `italic ${10 / view.scale}px Spectral, serif`
          ctx.fillStyle = 'rgba(42, 36, 28, 0.6)'
          ctx.fillText(String(node.inbound), lx, node.y + 13 / view.scale)
        }
      }

      ctx.restore()

      drawCompassRose(ctx, w, h)

      // Debug/e2e hook: world→screen data for the current frame.
      ;(window as unknown as { __meridian?: object }).__meridian = {
        view: { ...view },
        nodes: chart.nodes.map((n) => ({ id: n.id, name: n.name, x: n.x, y: n.y })),
      }
    }

    // Screen-space ornament: an engraved compass rose, bottom-right.
    function drawCompassRose(ctx2: CanvasRenderingContext2D, w: number, h: number) {
      const cxr = w - 86
      const cyr = h - 96
      const R = 46
      ctx2.save()
      ctx2.translate(cxr, cyr)
      ctx2.strokeStyle = 'rgba(42, 36, 28, 0.30)'
      ctx2.fillStyle = 'rgba(42, 36, 28, 0.30)'
      ctx2.lineWidth = 1

      ctx2.beginPath()
      ctx2.arc(0, 0, R, 0, Math.PI * 2)
      ctx2.stroke()
      ctx2.beginPath()
      ctx2.arc(0, 0, R - 7, 0, Math.PI * 2)
      ctx2.stroke()

      // 16 graduation ticks
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        const inner = i % 4 === 0 ? R - 14 : R - 10
        ctx2.beginPath()
        ctx2.moveTo(Math.cos(a) * inner, Math.sin(a) * inner)
        ctx2.lineTo(Math.cos(a) * (R - 7), Math.sin(a) * (R - 7))
        ctx2.stroke()
      }

      // Four cardinal points: long slim diamonds.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2
        const tipX = Math.cos(a) * (R - 12)
        const tipY = Math.sin(a) * (R - 12)
        const px = -Math.sin(a)
        const py = Math.cos(a)
        ctx2.beginPath()
        ctx2.moveTo(tipX, tipY)
        ctx2.lineTo(px * 4.5, py * 4.5)
        ctx2.lineTo(-tipX * 0.12, -tipY * 0.12)
        ctx2.lineTo(-px * 4.5, -py * 4.5)
        ctx2.closePath()
        if (i === 3) ctx2.fill()
        else ctx2.stroke()
      }

      ctx2.font = `500 11px Spectral, serif`
      ctx2.textAlign = 'center'
      ctx2.textBaseline = 'middle'
      ctx2.fillText('N', 0, -R - 9)
      ctx2.restore()
    }

    function drawGraticule(
      ctx2: CanvasRenderingContext2D,
      view: View,
      w: number,
      h: number,
    ) {
      const step = 120
      const left = -view.x / view.scale
      const top = -view.y / view.scale
      const right = left + w / view.scale
      const bottom = top + h / view.scale
      ctx2.strokeStyle = 'rgba(42, 36, 28, 0.07)'
      ctx2.lineWidth = 1 / view.scale
      for (let gx = Math.floor(left / step) * step; gx < right; gx += step) {
        ctx2.beginPath()
        ctx2.moveTo(gx, top)
        ctx2.lineTo(gx, bottom)
        ctx2.stroke()
      }
      for (let gy = Math.floor(top / step) * step; gy < bottom; gy += step) {
        ctx2.beginPath()
        ctx2.moveTo(left, gy)
        ctx2.lineTo(right, gy)
        ctx2.stroke()
      }
    }

    simulation.on('tick', () => {
      if (!fitted && simulation.alpha() < 0.5) {
        fit()
        fitted = true
      }
      draw()
    })
    simulation.on('end', () => {
      if (!fitted) {
        fit()
        fitted = true
      }
      draw()
    })

    // --- interactions: pan, zoom, hover, select ---
    let dragging = false
    let moved = false
    let lastX = 0
    let lastY = 0

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const view = viewRef.current
      return {
        x: (clientX - rect.left - view.x) / view.scale,
        y: (clientY - rect.top - view.y) / view.scale,
      }
    }

    const hitTest = (clientX: number, clientY: number): ChartNode | null => {
      const p = toWorld(clientX, clientY)
      let best: ChartNode | null = null
      let bestDist = Infinity
      for (const node of chart.nodes) {
        const r = nodeRadius(node) + 4
        const dx = node.x - p.x
        const dy = node.y - p.y
        const d2 = dx * dx + dy * dy
        if (d2 < r * r && d2 < bestDist) {
          best = node
          bestDist = d2
        }
      }
      return best
    }

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      moved = false
      lastX = e.clientX
      lastY = e.clientY
      canvas.classList.add('dragging')
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // synthetic pointer events (tests) have no active pointer to capture
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - lastX
        const dy = e.clientY - lastY
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true
        viewRef.current.x += dx
        viewRef.current.y += dy
        lastX = e.clientX
        lastY = e.clientY
        draw()
      } else {
        const hit = hitTest(e.clientX, e.clientY)
        if (hit !== hoverRef.current) {
          hoverRef.current = hit
          canvas.style.cursor = hit ? 'pointer' : 'grab'
          draw()
        }
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      canvas.classList.remove('dragging')
      if (!moved) {
        const hit = hitTest(e.clientX, e.clientY)
        onSelect(hit ? hit.id : null)
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const view = viewRef.current
      const factor = Math.exp(-e.deltaY * 0.0012)
      const newScale = Math.min(6, Math.max(0.08, view.scale * factor))
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      view.x = cx - ((cx - view.x) / view.scale) * newScale
      view.y = cy - ((cy - view.y) / view.scale) * newScale
      view.scale = newScale
      draw()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    drawRef.current = draw
    frameRef.current = requestAnimationFrame(draw)

    return () => {
      simulation.stop()
      ro.disconnect()
      cancelAnimationFrame(frameRef.current)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [chart, onSelect])

  // Redraw on selection change without restarting the simulation.
  useEffect(() => {
    drawRef.current()
  }, [selectedId])

  return <canvas ref={canvasRef} className="chart-canvas" />
}

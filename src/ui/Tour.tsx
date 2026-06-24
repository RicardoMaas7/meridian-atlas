import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/context'
import type { CodeChart } from '../types'

interface Props {
  step: number
  chart: CodeChart
  onHighlight: (id: number | null) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onDone: () => void
}

/**
 * A step is a story about one concrete thing on the chart: a specific
 * node, a specific edge, or a specific region. The spotlight + pulse +
 * arrow all anchor on the picked element, not on its container.
 */
type StepDef = {
  key: 'welcome' | 'nodes' | 'edges' | 'select' | 'sidepanel' | 'legend'
  /** Pick a node to highlight. null = nothing to focus. */
  pick: (chart: CodeChart) => number | null
  /** Where the spotlight and arrow should point. */
  target: (chart: CodeChart, pickedId: number | null) => {
    selector: string
    fallback: string
  }
  /** Which side of the spotlight the card should appear on. */
  cardSide: 'top' | 'bottom' | 'left' | 'right'
  /** Optional override for the chart zoom level when the step starts. */
  zoom?: number
}

const STEPS: StepDef[] = [
  {
    key: 'welcome',
    pick: () => null,
    target: () => ({ selector: '.chart-canvas-2d', fallback: '.chart-canvas-2d' }),
    cardSide: 'bottom',
  },
  {
    key: 'nodes',
    pick: (chart) => {
      const found = chart.nodes.find((n) => n.inbound >= 5) ??
        [...chart.nodes].sort((a, b) => b.inbound - a.inbound)[0]
      return found?.id ?? null
    },
    target: (_chart, pickedId) => ({
      selector: `[data-node="${pickedId}"]`,
      fallback: '.chart-svg [data-node]',
    }),
    cardSide: 'right',
    zoom: 280,
  },
  {
    key: 'edges',
    pick: (chart) => {
      const outbound = chart.nodes.find((n) => n.outbound >= 3)
      return outbound?.id ?? null
    },
    target: (_chart, pickedId) => ({
      selector: `[data-node="${pickedId}"]`,
      fallback: '.chart-svg [data-node]',
    }),
    cardSide: 'right',
    zoom: 320,
  },
  {
    key: 'select',
    pick: (chart) => {
      const found = chart.nodes.find((n) => n.inbound >= 1 && n.outbound >= 1)
      return found?.id ?? null
    },
    target: (_chart, pickedId) => ({
      selector: `[data-node="${pickedId}"]`,
      fallback: '.chart-svg [data-node]',
    }),
    cardSide: 'left',
    zoom: 220,
  },
  {
    key: 'sidepanel',
    pick: (chart) => {
      const found = chart.nodes.find((n) => n.inbound >= 1 && n.outbound >= 1)
      return found?.id ?? null
    },
    target: () => ({ selector: '.side-panel', fallback: '.side-panel' }),
    cardSide: 'left',
  },
  {
    key: 'legend',
    pick: () => null,
    target: () => ({ selector: '.chart-legend', fallback: '.chart-legend' }),
    cardSide: 'top',
  },
]

export function Tour({ step, chart, onHighlight, onNext, onBack, onSkip, onDone }: Props) {
  const { t } = useI18n()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const lastHighlightRef = useRef<number | null | undefined>(undefined)

  const def = STEPS[step] ?? STEPS[0]
  const data = t.help.steps[def.key]
  const isLast = step >= STEPS.length - 1

  // Pick a node and pass it to the parent for selection + zoom.
  useEffect(() => {
    const id = def.pick(chart)
    if (id !== lastHighlightRef.current) {
      lastHighlightRef.current = id
      onHighlight(id)
    }
  }, [step, chart, def, onHighlight])

  // Re-measure the target element. We re-measure several times because
  // the chart re-ticks when a node is selected, and the focus zoom
  // animation moves the spotlight target. Layout settles around 1s in.
  const [pickedId, setPickedId] = useState<number | null>(null)
  useEffect(() => {
    setPickedId(def.pick(chart))
  }, [chart, def])

  useEffect(() => {
    const t = def.target(chart, pickedId)
    const update = () => {
      const exact = document.querySelector(t.selector) as HTMLElement | null
      const el = exact ?? (document.querySelector(t.fallback) as HTMLElement | null)
      if (el) setTargetRect(el.getBoundingClientRect())
      else setTargetRect(null)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(document.body)
    window.addEventListener('resize', update)
    const timers = [80, 240, 500, 900, 1400].map((d) => setTimeout(update, d))
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
      timers.forEach(clearTimeout)
    }
  }, [def, pickedId, chart, step])

  const cardPosition = (() => {
    if (!targetRect) {
      return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardW = 480
    const cardH = 240
    const margin = 28
    const r = targetRect
    let left = 0
    let top = 0
    switch (def.cardSide) {
      case 'right':
        left = r.right + margin
        top = r.top + r.height / 2 - cardH / 2
        break
      case 'left':
        left = r.left - cardW - margin
        top = r.top + r.height / 2 - cardH / 2
        break
      case 'top':
        left = r.left + r.width / 2 - cardW / 2
        top = r.top - cardH - margin
        break
      default:
        left = r.left + r.width / 2 - cardW / 2
        top = r.bottom + margin
    }
    left = Math.max(margin, Math.min(left, vw - cardW - margin))
    top = Math.max(margin, Math.min(top, vh - cardH - margin))
    return { left: `${left}px`, top: `${top}px`, transform: 'none' }
  })()

  const isNodeTarget = def.target(chart, pickedId).selector.startsWith('[data-node=')
  const spotlightStyle = targetRect
    ? {
        left: Math.max(0, targetRect.left - 14),
        top: Math.max(0, targetRect.top - 14),
        width: targetRect.width + 28,
        height: targetRect.height + 28,
      }
    : null

  // Compute the arrow that connects the card to the spotlight.
  const arrow = (() => {
    if (!targetRect) return null
    const cw = 480
    const ch = 240
    const cl = parseFloat(cardPosition.left) || 0
    const ct = parseFloat(cardPosition.top) || 0
    const cardCenter = { x: cl + cw / 2, y: ct + ch / 2 }
    const targetCenter = {
      x: targetRect.left + targetRect.width / 2,
      y: targetRect.top + targetRect.height / 2,
    }
    // Decide which side of the card the arrow comes out of
    const side = def.cardSide
    let ax = 0
    let ay = 0
    let tx = 0
    let ty = 0
    if (side === 'right') {
      ax = cl
      ay = cardCenter.y
      tx = targetCenter.x
      ty = targetCenter.y
    } else if (side === 'left') {
      ax = cl + cw
      ay = cardCenter.y
      tx = targetCenter.x
      ty = targetCenter.y
    } else if (side === 'top') {
      ax = cardCenter.x
      ay = ct + ch
      tx = targetCenter.x
      ty = targetCenter.y
    } else {
      ax = cardCenter.x
      ay = ct
      tx = targetCenter.x
      ty = targetCenter.y
    }
    const dx = tx - ax
    const dy = ty - ay
    const len = Math.hypot(dx, dy) || 1
    // The arrow only draws the last 60px of the connector line
    const tipBack = 30
    const t1x = tx - (dx / len) * tipBack
    const t1y = ty - (dy / len) * tipBack
    return {
      x1: ax,
      y1: ay,
      x2: t1x,
      y2: t1y,
      tx,
      ty,
    }
  })()

  return (
    <div className="tour-overlay" ref={wrapperRef}>
      {spotlightStyle && (
        <div className="tour-spotlight" style={spotlightStyle}>
          {isNodeTarget && <div className="tour-pulse" />}
        </div>
      )}
      {arrow && (
        <svg className="tour-arrow-svg" aria-hidden="true">
          <defs>
            <marker
              id="tour-arrow-head"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--gold-bright)" />
            </marker>
          </defs>
          <line
            x1={arrow.x1}
            y1={arrow.y1}
            x2={arrow.tx}
            y2={arrow.ty}
            stroke="var(--gold-bright)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            markerEnd="url(#tour-arrow-head)"
            opacity="0.85"
          />
        </svg>
      )}
      <div className="tour-card-wrapper" style={cardPosition}>
        <div className="tour-card">
          <div className="tour-progress">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`tour-dot ${i === step ? 'active' : i < step ? 'past' : ''}`}
              />
            ))}
            <span className="tour-step-count">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <h3 className="tour-title">{data.title}</h3>
          <p className="tour-body">{data.body}</p>
          <div className="tour-actions">
            <button className="btn btn-ghost btn-sm" onClick={onSkip}>
              {t.help.skip}
            </button>
            <div className="tour-nav">
              {step > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={onBack}>
                  {t.help.back}
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={isLast ? onDone : onNext}
              >
                {isLast ? t.help.done : t.help.next}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

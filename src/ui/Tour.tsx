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

type StepDef = {
  key: 'welcome' | 'nodes' | 'edges' | 'select' | 'sidepanel' | 'legend'
  /** A function that picks a specific node to highlight for this step. */
  pick: (chart: CodeChart) => number | null
  /** The DOM element (CSS selector) the spotlight + card should point at. */
  spot: 'canvas' | 'node' | 'edges' | 'sidepanel' | 'legend'
  /** Which side of the spotlight the card should appear on. */
  cardSide: 'top' | 'bottom' | 'left' | 'right'
  /** Optional override for the chart zoom level. */
  zoom?: number
}

const STEPS: StepDef[] = [
  {
    key: 'welcome',
    pick: () => null,
    spot: 'canvas',
    cardSide: 'bottom',
  },
  {
    key: 'nodes',
    pick: (chart) => {
      const found = chart.nodes.find((n) => n.inbound >= 5) ??
        [...chart.nodes].sort((a, b) => b.inbound - a.inbound)[0]
      return found?.id ?? null
    },
    spot: 'node',
    cardSide: 'right',
    zoom: 260,
  },
  {
    key: 'edges',
    pick: (chart) => chart.nodes.find((n) => n.outbound >= 3)?.id ?? null,
    spot: 'edges',
    cardSide: 'right',
    zoom: 280,
  },
  {
    key: 'select',
    pick: (chart) => {
      const found = chart.nodes.find((n) => n.inbound >= 1 && n.outbound >= 1)
      return found?.id ?? null
    },
    spot: 'node',
    cardSide: 'left',
    zoom: 200,
  },
  {
    key: 'sidepanel',
    pick: (chart) => {
      const found = chart.nodes.find((n) => n.inbound >= 1 && n.outbound >= 1)
      return found?.id ?? null
    },
    spot: 'sidepanel',
    cardSide: 'left',
  },
  {
    key: 'legend',
    pick: () => null,
    spot: 'legend',
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

  // Re-measure the target element on layout changes.
  useEffect(() => {
    const selectors: Record<StepDef['spot'], string> = {
      canvas: '.chart-canvas-2d',
      node: '.chart-svg [data-node]',
      edges: '.chart-svg .edges',
      sidepanel: '.side-panel',
      legend: '.chart-legend',
    }
    const update = () => {
      const el = document.querySelector(selectors[def.spot]) as HTMLElement | null
      if (el) setTargetRect(el.getBoundingClientRect())
      else setTargetRect(null)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(document.body)
    window.addEventListener('resize', update)
    const timers = [120, 400, 800].map((d) => setTimeout(update, d))
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
      timers.forEach(clearTimeout)
    }
  }, [def.spot, def.key, step])

  const cardPosition = (() => {
    if (!targetRect) {
      return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardW = 480
    const cardH = 240
    const margin = 24
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

  const spotlightStyle = targetRect
    ? {
        left: Math.max(0, targetRect.left - 12),
        top: Math.max(0, targetRect.top - 12),
        width: targetRect.width + 24,
        height: targetRect.height + 24,
      }
    : null

  return (
    <div className="tour-overlay" ref={wrapperRef}>
      {spotlightStyle && (
        <div className="tour-spotlight" style={spotlightStyle}>
          {def.spot === 'node' && (
            <div className="tour-pulse" />
          )}
        </div>
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

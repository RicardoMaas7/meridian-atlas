import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/context'

interface Props {
  step: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onDone: () => void
}

const STEPS = ['welcome', 'nodes', 'edges', 'select', 'sidepanel', 'legend'] as const

export function Tour({ step, onNext, onBack, onSkip, onDone }: Props) {
  const { t } = useI18n()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const stepKey = STEPS[step] ?? STEPS[0]
  const data = t.help.steps[stepKey]
  const isLast = step >= STEPS.length - 1

  useEffect(() => {
    const selectors: Record<typeof stepKey, string> = {
      welcome: '.chart-canvas-2d',
      nodes: '.chart-svg .nodes',
      edges: '.chart-svg .edges',
      select: '.chart-svg .nodes',
      sidepanel: '.side-panel',
      legend: '.chart-legend',
    }
    const el = document.querySelector(selectors[stepKey]) as HTMLElement | null
    if (el) {
      setTargetRect(el.getBoundingClientRect())
    } else {
      setTargetRect(null)
    }
  }, [stepKey])

  const card = (
    <div className="tour-card">
      <div className="tour-progress">
        {STEPS.map((_, i) => (
          <span key={i} className={`tour-dot ${i === step ? 'active' : i < step ? 'past' : ''}`} />
        ))}
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
  )

  return (
    <div className="tour-overlay">
      {targetRect && (
        <div
          className="tour-spotlight"
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}
      <div className="tour-card-wrapper">{card}</div>
    </div>
  )
}

import { Fragment, useMemo } from 'react'
import type { CodeChart } from '../types'
import { interpretChart, interpretNode } from '../graph/interpret'
import { relativeTime } from '../graph/snapshot'
import type { SurveyDelta } from '../graph/snapshot'
import { useI18n } from '../i18n/context'

interface Props {
  chart: CodeChart
  selectedId: number | null
  delta: SurveyDelta | null
  onSelect: (id: number) => void
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

function deltaObservation(delta: SurveyDelta, chart: CodeChart, t: ReturnType<typeof useI18n>['t']) {
  const changes: string[] = []
  if (delta.added.length) changes.push(`${delta.added.length} ${t.labels.new}`)
  if (delta.altered.length) changes.push(`${delta.altered.length} ${t.labels.altered}`)
  if (delta.removed.length) changes.push(`${delta.removed.length} ${t.labels.removed}`)
  const rocks = chart.nodes.filter((n) => n.inbound === 0 && n.outbound === 0).length
  const rockLine =
    rocks !== delta.prevRockCount ? ` ${t.labels.rocks} ${delta.prevRockCount} → ${rocks}.` : ''
  if (changes.length === 0) {
    return {
      title: t.labels.noChange,
      body: `The waters are as they were ${relativeTime(delta.prevTakenAt)}.`,
      refs: undefined as { id: number; name: string }[] | undefined,
    }
  }
  return {
    title: `${t.labels.sinceLastSurvey} (${relativeTime(delta.prevTakenAt)})`,
    body:
      `Symbols: ${changes.join(', ')}.` +
      rockLine +
      (delta.removed.length ? ` ${t.labels.gone}: ${delta.removed.slice(0, 4).join(', ')}.` : ''),
    refs: [...delta.added, ...delta.altered]
      .slice(0, 8)
      .map((n) => ({ id: n.id, name: n.name })),
  }
}

export function SidePanel({ chart, selectedId, delta, onSelect }: Props) {
  const { t } = useI18n()
  const node = chart.nodes.find((n) => n.id === selectedId) ?? null
  const observations = useMemo(() => {
    const notes = interpretChart(chart)
    if (delta) notes.unshift(deltaObservation(delta, chart, t))
    return notes
  }, [chart, delta, t])

  if (!node) {
    return (
      <aside className="side-panel">
        <p className="panel-kicker">{t.labels.remarks}</p>
        <p className="directions-intro">{t.labels.selectSymbol}</p>
        {observations.map((obs, i) => (
          <section className="observation" key={obs.title}>
            <h4>
              <span className="numeral">{NUMERALS[i] ?? i + 1}.</span>
              {obs.title}
            </h4>
            <p>{obs.body}</p>
            {obs.refs && (
              <div className="observation-refs">
                {obs.refs.map((ref, j) => (
                  <Fragment key={ref.id}>
                    {j > 0 && <span className="sep">, </span>}
                    <button onClick={() => onSelect(ref.id)}>{ref.name}</button>
                  </Fragment>
                ))}
              </div>
            )}
          </section>
        ))}
      </aside>
    )
  }

  const inboundEdges = chart.edges.filter((e) => e.target === node.id)
  const outboundEdges = chart.edges.filter((e) => e.source === node.id)
  const byId = new Map(chart.nodes.map((n) => [n.id, n]))
  const reading = interpretNode(chart, node)

  return (
    <aside className="side-panel">
      <p className="panel-kicker">{t.kinds[node.kind]}</p>
      <h3>{node.name}</h3>
      <p className="position">
        {node.file}:{node.row}
      </p>

      <div className="soundings">
        <div>
          <div className="figure">{node.inbound}</div>
          <div className="caption">{t.labels.calledBy}</div>
        </div>
        <div>
          <div className="figure">{node.outbound}</div>
          <div className="caption">{t.labels.callsOut}</div>
        </div>
      </div>

      {reading && <p className="node-reading">{reading}</p>}

      <div className="route-list">
        {inboundEdges.length > 0 && (
          <>
            <h4>{t.labels.routesInbound}</h4>
            {inboundEdges.map((e) => {
              const from = byId.get(e.source)
              if (!from) return null
              return (
                <button key={`in-${e.source}`} onClick={() => onSelect(from.id)}>
                  ← {from.name}
                  {!e.charted && <span className="est"> {t.labels.estimated}</span>}
                </button>
              )
            })}
          </>
        )}
        {outboundEdges.length > 0 && (
          <>
            <h4>{t.labels.routesOutbound}</h4>
            {outboundEdges.map((e) => {
              const to = byId.get(e.target)
              if (!to) return null
              return (
                <button key={`out-${e.target}`} onClick={() => onSelect(to.id)}>
                  → {to.name}
                  {!e.charted && <span className="est"> {t.labels.estimated}</span>}
                </button>
              )
            })}
          </>
        )}
      </div>

      <div className="excerpt">
        <p className="panel-kicker">{t.labels.source}</p>
        <pre>{node.excerpt}</pre>
      </div>
    </aside>
  )
}
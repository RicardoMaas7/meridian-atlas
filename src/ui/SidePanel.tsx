import { Fragment, useMemo } from 'react'
import type { CodeChart, ChartNode } from '../types'
import { interpretChart, interpretNode } from '../graph/interpret'
import { relativeTime } from '../graph/snapshot'
import type { SurveyDelta } from '../graph/snapshot'

interface Props {
  chart: CodeChart
  selectedId: number | null
  delta: SurveyDelta | null
  onSelect: (id: number) => void
}

const KIND_LABEL: Record<ChartNode['kind'], string> = {
  function: 'Function',
  method: 'Method',
  class: 'Class',
  var: 'Function (assigned)',
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

function deltaObservation(delta: SurveyDelta, chart: CodeChart) {
  const changes: string[] = []
  if (delta.added.length) changes.push(`${delta.added.length} new`)
  if (delta.altered.length) changes.push(`${delta.altered.length} altered`)
  if (delta.removed.length) changes.push(`${delta.removed.length} removed`)
  const rocks = chart.nodes.filter((n) => n.inbound === 0 && n.outbound === 0).length
  const rockLine =
    rocks !== delta.prevRockCount ? ` Rocks ${delta.prevRockCount} → ${rocks}.` : ''
  if (changes.length === 0) {
    return {
      title: 'No change',
      body: `The waters are as they were ${relativeTime(delta.prevTakenAt)}.`,
      refs: undefined as { id: number; name: string }[] | undefined,
    }
  }
  return {
    title: `Since last survey (${relativeTime(delta.prevTakenAt)})`,
    body:
      `Symbols: ${changes.join(', ')}.` +
      rockLine +
      (delta.removed.length ? ` Gone: ${delta.removed.slice(0, 4).join(', ')}.` : ''),
    refs: [...delta.added, ...delta.altered]
      .slice(0, 8)
      .map((n) => ({ id: n.id, name: n.name })),
  }
}

export function SidePanel({ chart, selectedId, delta, onSelect }: Props) {
  const node = chart.nodes.find((n) => n.id === selectedId) ?? null
  const observations = useMemo(() => {
    const notes = interpretChart(chart)
    if (delta) notes.unshift(deltaObservation(delta, chart))
    return notes
  }, [chart, delta])

  if (!node) {
    return (
      <aside className="side-panel">
        <p className="panel-kicker">Remarks</p>
        <p className="directions-intro">
          Notes from the survey. Select a symbol for its own entry.
        </p>
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
      <p className="panel-kicker">{KIND_LABEL[node.kind]}</p>
      <h3>{node.name}</h3>
      <p className="position">
        {node.file}:{node.row}
      </p>

      <div className="soundings">
        <div>
          <div className="figure">{node.inbound}</div>
          <div className="caption">Called by</div>
        </div>
        <div>
          <div className="figure">{node.outbound}</div>
          <div className="caption">Calls out</div>
        </div>
      </div>

      {reading && <p className="node-reading">{reading}</p>}

      <div className="route-list">
        {inboundEdges.length > 0 && (
          <>
            <h4>Routes inbound</h4>
            {inboundEdges.map((e) => {
              const from = byId.get(e.source)
              if (!from) return null
              return (
                <button key={`in-${e.source}`} onClick={() => onSelect(from.id)}>
                  ← {from.name}
                  {!e.charted && <span className="est"> est.</span>}
                </button>
              )
            })}
          </>
        )}
        {outboundEdges.length > 0 && (
          <>
            <h4>Routes outbound</h4>
            {outboundEdges.map((e) => {
              const to = byId.get(e.target)
              if (!to) return null
              return (
                <button key={`out-${e.target}`} onClick={() => onSelect(to.id)}>
                  → {to.name}
                  {!e.charted && <span className="est"> est.</span>}
                </button>
              )
            })}
          </>
        )}
      </div>

      <div className="excerpt">
        <p className="panel-kicker">Source</p>
        <pre>{node.excerpt}</pre>
      </div>
    </aside>
  )
}

import { Fragment, useMemo, useState } from 'react'
import type { CodeChart } from '../types'
import { interpretChart, interpretNode, type Observation } from '../graph/interpret'
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
      body: `${t.noChanges} (${relativeTime(delta.prevTakenAt)})`,
      refs: undefined as { id: number; name: string }[] | undefined,
    }
  }
  return {
    title: `${t.labels.sinceLastSurvey} (${relativeTime(delta.prevTakenAt)})`,
    body:
      `${changes.join(', ')}.` +
      rockLine +
      (delta.removed.length ? ` ${t.labels.gone}: ${delta.removed.slice(0, 4).join(', ')}.` : ''),
    refs: [...delta.added, ...delta.altered]
      .slice(0, 8)
      .map((n) => ({ id: n.id, name: n.name })),
  }
}

function classifyNode(node: { inbound: number; outbound: number; kind: string; row: number; excerpt: string }): {
  label: string
  body: string
  badge?: string
} {
  if (node.inbound === 0 && node.outbound === 0) {
    return {
      label: 'rock',
      body: 'A rock. No route touches it: dead code, or called from outside the survey (tests, templates, reflection).',
      badge: 'rock',
    }
  }
  if (node.inbound >= 5) {
    return {
      label: 'lighthouse',
      body: `A lighthouse. Called by ${node.inbound} other symbols. A change here ripples through the chart.`,
      badge: 'lighthouse',
    }
  }
  if (node.inbound === 0 && node.outbound >= 3) {
    return {
      label: 'port',
      body: 'A port of departure. Nothing in the survey calls it: an entry point, handler, or exported API.',
      badge: 'port',
    }
  }
  if (node.outbound >= 8) {
    return {
      label: 'expedition',
      body: `An expedition. ${node.outbound} routes set out from here; complexity gathers in symbols like this.`,
      badge: 'expedition',
    }
  }
  if (node.kind === 'class' && node.inbound >= 1) {
    return {
      label: 'instantiated',
      body: `Instantiated or referenced ${node.inbound} time${node.inbound === 1 ? '' : 's'} on the chart.`,
    }
  }
  return { label: 'unremarkable', body: '' }
}

function complexityBand(outbound: number): { band: 'low' | 'mid' | 'high'; label: string } {
  if (outbound >= 8) return { band: 'high', label: 'high' }
  if (outbound >= 4) return { band: 'mid', label: 'mid' }
  return { band: 'low', label: 'low' }
}

function estimateReach(chart: CodeChart, startId: number): { count: number; depth: number } {
  const seen = new Set<number>([startId])
  let frontier = [startId]
  let depth = 0
  while (frontier.length > 0 && depth < 8) {
    const next: number[] = []
    for (const id of frontier) {
      for (const e of chart.edges) {
        if (e.source === id && !seen.has(e.target)) {
          seen.add(e.target)
          next.push(e.target)
        }
      }
    }
    if (next.length === 0) break
    frontier = next
    depth++
  }
  return { count: seen.size - 1, depth }
}

export function SidePanel({ chart, selectedId, delta, onSelect }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'remarks' | 'glossary' | 'help'>('remarks')
  const [copied, setCopied] = useState(false)

  const byId = useMemo(() => new Map(chart.nodes.map((n) => [n.id, n])), [chart.nodes])
  const node = selectedId != null ? byId.get(selectedId) ?? null : null

  const observations = useMemo(() => {
    const notes = interpretChart(chart)
    if (delta) notes.unshift(deltaObservation(delta, chart, t))
    return notes
  }, [chart, delta, t])

  const reach = useMemo(() => (node ? estimateReach(chart, node.id) : null), [chart, node])
  const classification = useMemo(() => (node ? classifyNode(node) : null), [node])

  const onCopy = async () => {
    if (!node) return
    try {
      await navigator.clipboard.writeText(node.excerpt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  if (!node) {
    return (
      <aside className="side-panel">
        <div className="panel-tabs">
          <button className={tab === 'remarks' ? 'active' : ''} onClick={() => setTab('remarks')}>
            {t.labels.remarks}
          </button>
          <button className={tab === 'glossary' ? 'active' : ''} onClick={() => setTab('glossary')}>
            {t.showGlossary}
          </button>
          <button className={tab === 'help' ? 'active' : ''} onClick={() => setTab('help')}>
            {t.howToRead}
          </button>
        </div>

        {tab === 'remarks' && (
          <>
            <p className="directions-intro">{t.labels.selectSymbol}</p>
            {observations.map((obs, i) => (
              <ObservationSection key={obs.title} obs={obs} index={i} onSelect={onSelect} />
            ))}
          </>
        )}

        {tab === 'glossary' && <GlossaryView t={t} />}

        {tab === 'help' && <HelpView t={t} />}
      </aside>
    )
  }

  const inboundEdges = chart.edges.filter((e) => e.target === node.id)
  const outboundEdges = chart.edges.filter((e) => e.source === node.id)
  const reading = interpretNode(chart, node)
  const complexity = complexityBand(node.outbound)
  const sameModuleCount = chart.nodes.filter((n) => n.module === node.module && n.id !== node.id).length

  return (
    <aside className="side-panel">
      <div className="panel-tabs">
        <button className={tab === 'remarks' ? 'active' : ''} onClick={() => setTab('remarks')}>
          {t.labels.remarks}
        </button>
        <button className={tab === 'glossary' ? 'active' : ''} onClick={() => setTab('glossary')}>
          {t.showGlossary}
        </button>
        <button className={tab === 'help' ? 'active' : ''} onClick={() => setTab('help')}>
          {t.howToRead}
        </button>
      </div>

      <div className="node-detail">
        <p className="panel-kicker">{t.kinds[node.kind]}</p>
        <h3>{node.name}</h3>
        <p className="position">
          <span className="position-file" title={node.file}>{shortFile(node.file)}</span>
          <span className="position-sep">·</span>
          <span className="position-row">{t.node.line} {node.row}</span>
        </p>

        {classification && classification.body && (
          <p className={`node-reading ${classification.badge ?? ''}`}>
            <span className="badge-tag">{classification.label}</span>
            {classification.body}
          </p>
        )}

        <div className="soundings">
          <div>
            <div className="figure">{node.inbound}</div>
            <div className="caption">{t.labels.calledBy}</div>
          </div>
          <div>
            <div className="figure">{node.outbound}</div>
            <div className="caption">{t.labels.callsOut}</div>
          </div>
          {reach && (
            <div>
              <div className="figure small">{reach.count}</div>
              <div className="caption">{t.node.reach}</div>
            </div>
          )}
        </div>

        {reading && reading !== classification?.body && (
          <p className="node-reading secondary">{reading}</p>
        )}

        <div className="meta-grid">
          <div className="meta-row">
            <span className="meta-label">{t.node.module}</span>
            <span className="meta-value">{node.module || '/'}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">{t.node.kind}</span>
            <span className="meta-value">{t.kinds[node.kind]}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">{t.node.complexity}</span>
            <span className={`meta-value complexity-${complexity.band}`}>
              {t.node[`complexity${complexity.band.charAt(0).toUpperCase() + complexity.band.slice(1)}` as 'complexityLow' | 'complexityMid' | 'complexityHigh']}
              <span className="meta-sub"> · {node.outbound} {t.node.callsOut}</span>
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-label">{t.node.reach}</span>
            <span className="meta-value">
              {reach?.count ?? 0} <span className="meta-sub">{t.node.reachDesc}</span>
            </span>
          </div>
        </div>

        <div className="route-list">
          {inboundEdges.length > 0 ? (
            <>
              <h4>
                {t.labels.routesInbound}
                <span className="route-count">{inboundEdges.length}</span>
              </h4>
              {inboundEdges
                .sort((a, b) => (b.charted ? 1 : 0) - (a.charted ? 1 : 0))
                .slice(0, 12)
                .map((e) => {
                  const from = byId.get(e.source)
                  if (!from) return null
                  return (
                    <button
                      key={`in-${e.source}`}
                      onClick={() => onSelect(from.id)}
                      className="route-button"
                    >
                      <span className="route-arrow">←</span>
                      <span className="route-name">{from.name}</span>
                      <span className="route-file">{shortFile(from.file)}</span>
                      {!e.charted && <span className="est"> {t.labels.estimated}</span>}
                    </button>
                  )
                })}
              {inboundEdges.length > 12 && (
                <div className="route-more">+{inboundEdges.length - 12} more</div>
              )}
            </>
          ) : (
            <p className="route-empty">{t.node.noIncoming}</p>
          )}

          {outboundEdges.length > 0 ? (
            <>
              <h4>
                {t.labels.routesOutbound}
                <span className="route-count">{outboundEdges.length}</span>
              </h4>
              {outboundEdges
                .sort((a, b) => (b.charted ? 1 : 0) - (a.charted ? 1 : 0))
                .slice(0, 12)
                .map((e) => {
                  const to = byId.get(e.target)
                  if (!to) return null
                  return (
                    <button
                      key={`out-${e.target}`}
                      onClick={() => onSelect(to.id)}
                      className="route-button"
                    >
                      <span className="route-arrow">→</span>
                      <span className="route-name">{to.name}</span>
                      <span className="route-file">{shortFile(to.file)}</span>
                      {!e.charted && <span className="est"> {t.labels.estimated}</span>}
                    </button>
                  )
                })}
              {outboundEdges.length > 12 && (
                <div className="route-more">+{outboundEdges.length - 12} more</div>
              )}
            </>
          ) : (
            <p className="route-empty">{t.node.noOutgoing}</p>
          )}
        </div>

        <div className="excerpt">
          <div className="excerpt-header">
            <p className="panel-kicker">{t.labels.source}</p>
            <button className="copy-btn" onClick={onCopy} title={t.node.copyExcerpt}>
              {copied ? `✓ ${t.node.copied}` : t.node.copyExcerpt}
            </button>
          </div>
          <pre>{node.excerpt}</pre>
        </div>

        {sameModuleCount > 0 && (
          <div className="module-siblings">
            <p className="panel-kicker">{t.node.module}: {node.module || '/'}</p>
            <div className="siblings-list">
              {chart.nodes
                .filter((n) => n.module === node.module && n.id !== node.id)
                .slice(0, 8)
                .map((n) => (
                  <button key={n.id} onClick={() => onSelect(n.id)} className="sibling-btn">
                    {n.name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function shortFile(file: string): string {
  if (file.length <= 36) return file
  return '…' + file.slice(-34)
}

function ObservationSection({
  obs,
  index,
  onSelect,
}: {
  obs: Observation
  index: number
  onSelect: (id: number) => void
}) {
  return (
    <section className="observation" key={obs.title}>
      <h4>
        <span className="numeral">{NUMERALS[index] ?? index + 1}.</span>
        {obs.title}
      </h4>
      <p>{obs.body}</p>
      {obs.refs && (
        <div className="observation-refs">
          {obs.refs.map((ref, j) => (
            <Fragment key={ref.id}>
              {j > 0 && <span className="sep">·</span>}
              <button onClick={() => onSelect(ref.id)}>{ref.name}</button>
            </Fragment>
          ))}
        </div>
      )}
    </section>
  )
}

function GlossaryView({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  const items: Array<{ term: string; body: string }> = [
    t.help.glossary.lighthouse,
    t.help.glossary.port,
    t.help.glossary.rock,
    t.help.glossary.expedition,
    t.help.glossary.island,
    t.help.glossary.strait,
    t.help.glossary.charted,
    t.help.glossary.estimated,
  ]
  return (
    <div className="glossary">
      <h3 className="glossary-title">{t.help.glossary.title}</h3>
      {items.map((item) => (
        <div className="glossary-row" key={item.term}>
          <div className="glossary-term">{item.term}</div>
          <p className="glossary-body">{item.body}</p>
        </div>
      ))}
    </div>
  )
}

function HelpView({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  return (
    <div className="help-view">
      <h3 className="help-title">{t.help.title}</h3>
      <p className="help-intro">{t.help.intro}</p>
      <div className="help-shortcuts">
        <div className="help-row"><kbd>drag</kbd><span>{t.help.pan}</span></div>
        <div className="help-row"><kbd>scroll</kbd><span>{t.help.zoom}</span></div>
        <div className="help-row"><kbd>click</kbd><span>{t.help.select}</span></div>
        <div className="help-row"><kbd>0</kbd><span>{t.help.reset}</span></div>
        <div className="help-row"><kbd>←↑→↓</kbd><span>Pan the chart</span></div>
        <div className="help-row"><kbd>+ −</kbd><span>Zoom in / out</span></div>
      </div>
    </div>
  )
}

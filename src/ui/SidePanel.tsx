import { Fragment, useMemo, useState } from 'react'
import type { ChartNode, CodeChart, DeclKind } from '../types'
import { interpretChart, interpretNode, type Observation } from '../graph/interpret'
import { relativeTime } from '../graph/snapshot'
import type { SurveyDelta } from '../graph/snapshot'
import { useI18n } from '../i18n/context'
import {
  complexityBand,
  isExpedition,
  isLighthouse,
  isPort,
  isRock,
  HUB_MIN_OUTBOUND,
  EXPEDITION_MIN_OUTBOUND,
  LIGHTHOUSE_MIN_INBOUND,
  type Complexity,
} from '../graph/thresholds'

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

function classifyNode(node: ChartNode): {
  label: string
  body: string
  badge?: string
} {
  if (isRock(node)) {
    return {
      label: 'rock',
      body: 'A rock. No route touches it: dead code, or called from outside the survey (tests, templates, reflection).',
      badge: 'rock',
    }
  }
  if (isLighthouse(node)) {
    return {
      label: 'lighthouse',
      body: `A lighthouse. Called by ${node.inbound} other symbols. A change here ripples through the chart.`,
      badge: 'lighthouse',
    }
  }
  if (isPort(node)) {
    return {
      label: 'port',
      body: 'A port of departure. Nothing in the survey calls it: an entry point, handler, or exported API.',
      badge: 'port',
    }
  }
  if (isExpedition(node)) {
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

interface ReachData {
  /** Total distinct symbols reachable from the start (BFS, depth 8). */
  count: number
  /** Maximum BFS depth that still found new symbols. */
  depth: number
  /** Out-degree at each depth layer (gives a sense of the "shape"). */
  layers: number[]
}

/** BFS over the call graph. Direction depends on the node's role:
 *  - for a port (entry point) we follow outbound (what it can reach)
 *  - for a lighthouse (heavily-called) we follow inbound (what reaches it)
 *  - otherwise we follow both and return the larger reachable set
 */
function estimateReach(chart: CodeChart, startId: number): ReachData {
  const adjOut = new Map<number, number[]>()
  const adjIn = new Map<number, number[]>()
  for (const e of chart.edges) {
    const out = adjOut.get(e.source)
    if (out) out.push(e.target)
    else adjOut.set(e.source, [e.target])
    const inn = adjIn.get(e.target)
    if (inn) inn.push(e.source)
    else adjIn.set(e.target, [e.source])
  }
  const start = chart.nodes.find((n) => n.id === startId)
  if (!start) return { count: 0, depth: 0, layers: [] }

  const direction: 'out' | 'in' | 'both' =
    start.inbound === 0 && start.outbound > 0
      ? 'out'
      : start.inbound > 5
        ? 'in'
        : 'both'

  const seen = new Set<number>([startId])
  let frontier = [startId]
  let depth = 0
  const layers: number[] = []
  while (frontier.length > 0 && depth < 8) {
    const next: number[] = []
    for (const id of frontier) {
      const targets =
        direction === 'out'
          ? adjOut.get(id) ?? []
          : direction === 'in'
            ? adjIn.get(id) ?? []
            : [...(adjOut.get(id) ?? []), ...(adjIn.get(id) ?? [])]
      for (const t of targets) {
        if (!seen.has(t)) {
          seen.add(t)
          next.push(t)
        }
      }
    }
    if (next.length === 0) break
    layers.push(next.length)
    frontier = next
    depth++
  }
  return { count: seen.size - 1, depth, layers }
}

interface CallSiteSummary {
  /** Caller symbol id (or null if not in chart). */
  id: number | null
  name: string
  file: string
  row: number
  charted: boolean
  /** How many of the same call exist across the chart. */
  count: number
}

/** Group the same source symbol's repeated calls so the panel can say
 *  "called 3 times by X" instead of listing the same caller 3 times. */
function groupCallers(chart: CodeChart, nodeId: number): CallSiteSummary[] {
  const counts = new Map<number, { count: number; charted: boolean }>()
  for (const e of chart.edges) {
    if (e.target !== nodeId) continue
    const cur = counts.get(e.source)
    if (cur) {
      cur.count++
      if (e.charted) cur.charted = true
    } else {
      counts.set(e.source, { count: 1, charted: e.charted })
    }
  }
  return [...counts.entries()]
    .map(([id, { count, charted }]) => {
      const n = chart.nodes.find((nn) => nn.id === id)
      return {
        id: n?.id ?? null,
        name: n?.name ?? `#${id}`,
        file: n?.file ?? '',
        row: n?.row ?? 0,
        charted,
        count,
      }
    })
    .sort((a, b) => b.count - a.count)
}

function groupCallees(chart: CodeChart, nodeId: number): CallSiteSummary[] {
  const counts = new Map<number, { count: number; charted: boolean }>()
  for (const e of chart.edges) {
    if (e.source !== nodeId) continue
    const cur = counts.get(e.target)
    if (cur) {
      cur.count++
      if (e.charted) cur.charted = true
    } else {
      counts.set(e.target, { count: 1, charted: e.charted })
    }
  }
  return [...counts.entries()]
    .map(([id, { count, charted }]) => {
      const n = chart.nodes.find((nn) => nn.id === id)
      return {
        id: n?.id ?? null,
        name: n?.name ?? `#${id}`,
        file: n?.file ?? '',
        row: n?.row ?? 0,
        charted,
        count,
      }
    })
    .sort((a, b) => b.count - a.count)
}

interface Recommendation {
  severity: 'info' | 'good' | 'warn' | 'danger'
  title: string
  body: string
}

function recommendationsFor(node: ChartNode, sameModule: number): Recommendation[] {
  const out: Recommendation[] = []
  if (isRock(node)) {
    out.push({
      severity: 'warn',
      title: 'No callers, no callees',
      body: 'Either dead code, or called from outside the survey (a test, a template, a string reference). Search the project for the symbol name to confirm.',
    })
  }
  if (node.outbound >= HUB_MIN_OUTBOUND) {
    out.push({
      severity: 'danger',
      title: 'Hub function',
      body: 'This symbol calls many others directly. Consider whether some of those calls could be grouped or delegated so the call graph stays shallow.',
    })
  } else if (node.outbound >= EXPEDITION_MIN_OUTBOUND) {
    out.push({
      severity: 'warn',
      title: 'Many direct calls',
      body: 'A wide call surface — easy to break on changes. Worth checking the cohesion of the called group.',
    })
  }
  if (node.inbound >= HUB_MIN_OUTBOUND) {
    out.push({
      severity: 'warn',
      title: 'Heavy inbound traffic',
      body: 'Many symbols depend on this one. A change here has a large blast radius — keep its surface stable and its tests thorough.',
    })
  } else if (node.inbound >= LIGHTHOUSE_MIN_INBOUND) {
    out.push({
      severity: 'info',
      title: 'Lighthouse',
      body: 'A change here reaches several call sites. Treat as a public API: small, focused, well-tested.',
    })
  }
  if (sameModule === 0 && (node.inbound > 0 || node.outbound > 0)) {
    out.push({
      severity: 'info',
      title: 'Crosses module boundaries',
      body: 'This symbol is the only one from its module visible to the rest of the chart. It is the module\u2019s public face.',
    })
  }
  if (node.kind === 'class' && isRock(node)) {
    out.push({
      severity: 'warn',
      title: 'Unused class',
      body: 'A class with no charted references or outgoing calls. Either instantiated via reflection or genuinely dead.',
    })
  }
  if (out.length === 0) {
    out.push({
      severity: 'good',
      title: 'Healthy shape',
      body: 'Nothing stands out about this symbol — its inbound and outbound counts are in a normal range.',
    })
  }
  return out
}

const KIND_LABELS: Record<DeclKind, string> = {
  function: 'Function',
  method: 'Method',
  class: 'Class',
  var: 'Assigned function',
}

function shortFile(file: string): string {
  if (file.length <= 36) return file
  return '…' + file.slice(-34)
}

function severityIcon(severity: Recommendation['severity']): string {
  switch (severity) {
    case 'good': return '✓'
    case 'info': return '·'
    case 'warn': return '!'
    case 'danger': return '!!'
  }
}

export function SidePanel({ chart, selectedId, delta, onSelect }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'remarks' | 'glossary' | 'help'>('remarks')
  const [copied, setCopied] = useState(false)
  const [showAllCallers, setShowAllCallers] = useState(false)
  const [showAllCallees, setShowAllCallees] = useState(false)

  const byId = useMemo(() => new Map(chart.nodes.map((n) => [n.id, n])), [chart.nodes])
  const node = selectedId != null ? byId.get(selectedId) ?? null : null

  const observations = useMemo(() => {
    const notes = interpretChart(chart)
    if (delta) notes.unshift(deltaObservation(delta, chart, t))
    return notes
  }, [chart, delta, t])

  const reach = useMemo(() => (node ? estimateReach(chart, node.id) : null), [chart, node])
  const classification = useMemo(() => (node ? classifyNode(node) : null), [node])
  const sameModuleCount = useMemo(
    () => (node ? chart.nodes.filter((n) => n.module === node.module && n.id !== node.id).length : 0),
    [chart, node],
  )
  const groupedCallers = useMemo(
    () => (node ? groupCallers(chart, node.id) : []),
    [chart, node],
  )
  const groupedCallees = useMemo(
    () => (node ? groupCallees(chart, node.id) : []),
    [chart, node],
  )
  const recs = useMemo(
    () => (node ? recommendationsFor(node, sameModuleCount) : []),
    [node, sameModuleCount],
  )

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

  const complexity: Complexity = complexityBand(node.outbound)
  const visibleCallers = showAllCallers ? groupedCallers : groupedCallers.slice(0, 8)
  const visibleCallees = showAllCallees ? groupedCallees : groupedCallees.slice(0, 8)
  const reading = interpretNode(chart, node)

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
        <p className="panel-kicker">{KIND_LABELS[node.kind]}</p>
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
          <div>
            <div className="figure small">{reach?.count ?? 0}</div>
            <div className="caption">{t.node.reach}</div>
          </div>
        </div>

        {reading && reading !== classification?.body && (
          <p className="node-reading secondary">{reading}</p>
        )}

        {reach && reach.layers.length > 0 && (
          <div className="depth-chart" aria-label={t.node.reach}>
            <div className="depth-chart-title">Reach by depth</div>
            <div className="depth-bars">
              {reach.layers.map((count, i) => {
                const max = Math.max(...reach.layers, 1)
                const heightPct = (count / max) * 100
                return (
                  <div
                    key={i}
                    className="depth-bar"
                    style={{ height: `${Math.max(heightPct, 8)}%` }}
                    title={`Depth ${i + 1}: ${count}`}
                  >
                    <span className="depth-bar-num">{count}</span>
                  </div>
                )
              })}
            </div>
            <div className="depth-axis">
              {reach.layers.map((_, i) => (
                <span key={i} className="depth-axis-tick">{i + 1}</span>
              ))}
            </div>
          </div>
        )}

        <div className="meta-grid">
          <div className="meta-row">
            <span className="meta-label">{t.node.module}</span>
            <span className="meta-value">{node.module || '/'}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">{t.node.kind}</span>
            <span className="meta-value">{KIND_LABELS[node.kind]}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">{t.node.complexity}</span>
            <span className={`meta-value complexity-${complexity.band}`}>
              {t.node[`complexity${complexity.band.charAt(0).toUpperCase() + complexity.band.slice(1)}` as 'complexityLow' | 'complexityMid' | 'complexityHigh' | 'complexityExt']}
              <span className="meta-sub"> · {node.outbound} {t.node.callsOut}</span>
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-label">{t.node.reach}</span>
            <span className="meta-value">
              {reach?.count ?? 0}
              <span className="meta-sub"> symbols · depth {reach?.depth ?? 0}</span>
            </span>
          </div>
          {sameModuleCount > 0 && (
            <div className="meta-row">
              <span className="meta-label">{t.node.module} siblings</span>
              <span className="meta-value">{sameModuleCount}</span>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {recs.length > 0 && (
          <div className="recs">
            <p className="panel-kicker">Read</p>
            {recs.map((r, i) => (
              <div key={i} className={`rec rec-${r.severity}`}>
                <span className={`rec-icon rec-icon-${r.severity}`}>{severityIcon(r.severity)}</span>
                <div>
                  <div className="rec-title">{r.title}</div>
                  <p className="rec-body">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="route-list">
          {groupedCallers.length > 0 ? (
            <>
              <h4>
                {t.labels.routesInbound}
                <span className="route-count">
                  {groupedCallers.reduce((acc, c) => acc + c.count, 0)}
                </span>
              </h4>
              {visibleCallers.map((c) => (
                <button
                  key={c.id ?? c.name}
                  onClick={() => c.id != null && onSelect(c.id)}
                  className="route-button"
                >
                  <span className="route-arrow">←</span>
                  <span className="route-name">{c.name}</span>
                  {c.count > 1 && <span className="route-times">×{c.count}</span>}
                  <span className="route-file">{shortFile(c.file)}</span>
                  {!c.charted && <span className="est">{t.labels.estimated}</span>}
                </button>
              ))}
              {groupedCallers.length > 8 && (
                <button
                  className="route-more-btn"
                  onClick={() => setShowAllCallers((v) => !v)}
                >
                  {showAllCallers ? 'show less' : `+${groupedCallers.length - 8} more`}
                </button>
              )}
            </>
          ) : (
            <p className="route-empty">{t.node.noIncoming}</p>
          )}

          {groupedCallees.length > 0 ? (
            <>
              <h4>
                {t.labels.routesOutbound}
                <span className="route-count">
                  {groupedCallees.reduce((acc, c) => acc + c.count, 0)}
                </span>
              </h4>
              {visibleCallees.map((c) => (
                <button
                  key={c.id ?? c.name}
                  onClick={() => c.id != null && onSelect(c.id)}
                  className="route-button"
                >
                  <span className="route-arrow">→</span>
                  <span className="route-name">{c.name}</span>
                  {c.count > 1 && <span className="route-times">×{c.count}</span>}
                  <span className="route-file">{shortFile(c.file)}</span>
                  {!c.charted && <span className="est">{t.labels.estimated}</span>}
                </button>
              ))}
              {groupedCallees.length > 8 && (
                <button
                  className="route-more-btn"
                  onClick={() => setShowAllCallees((v) => !v)}
                >
                  {showAllCallees ? 'show less' : `+${groupedCallees.length - 8} more`}
                </button>
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
      {obs.refs && obs.refs.length > 0 && (
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
        <div className="help-row"><kbd>←↑→↓</kbd><span>{t.help.panArrows}</span></div>
        <div className="help-row"><kbd>+ −</kbd><span>{t.help.zoomKeys}</span></div>
      </div>
    </div>
  )
}

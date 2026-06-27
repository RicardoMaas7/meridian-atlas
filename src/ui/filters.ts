export type FilterKind = 'all' | 'function' | 'method' | 'class'

export const FILTER_KIND_CYCLE: FilterKind[] = ['all', 'function', 'method', 'class']

export function nextFilterKind(current: FilterKind): FilterKind {
  const i = FILTER_KIND_CYCLE.indexOf(current)
  return FILTER_KIND_CYCLE[(i + 1) % FILTER_KIND_CYCLE.length]
}

import type { FileEntry } from '../types'

/**
 * A small fictional harbormaster's program, bundled so the chart can be
 * explored without picking a folder. Real TypeScript, really parsed —
 * the specimen goes through the same surveying as any repo.
 */

const registry = `export interface Vessel {
  name: string
  draft: number
  berth?: string
}

const vessels: Vessel[] = []

export function registerVessel(name: string, draft: number): Vessel {
  const vessel = { name, draft }
  vessels.push(vessel)
  return vessel
}

export function findVessel(name: string): Vessel | undefined {
  return vessels.find((v) => v.name === name)
}

export function listVessels(): Vessel[] {
  return [...vessels]
}
`

const tides = `export function tideHeight(hour: number): number {
  return 2.1 + 1.8 * Math.sin((hour / 12.42) * Math.PI * 2)
}

export function isNavigable(draft: number, hour: number): boolean {
  return tideHeight(hour) + 3.0 > draft + 0.5
}

export function nextWindow(draft: number, fromHour: number): number {
  let hour = fromHour
  while (!isNavigable(draft, hour)) {
    hour += 0.25
  }
  return hour
}
`

const berths = `import { findVessel } from './registry'
import { isNavigable } from './tides'

const occupied = new Map<string, string>()

export function assignBerth(vesselName: string, berth: string, hour: number): boolean {
  const vessel = findVessel(vesselName)
  if (!vessel) return false
  if (occupied.has(berth)) return false
  if (!isNavigable(vessel.draft, hour)) return false
  occupied.set(berth, vesselName)
  vessel.berth = berth
  return true
}

export function releaseBerth(berth: string): void {
  occupied.delete(berth)
}

export function occupancy(): number {
  return occupied.size
}
`

const log = `import { listVessels } from './registry'
import { occupancy } from './berths'
import { tideHeight } from './tides'

export class HarborLog {
  private entries: string[] = []

  record(message: string): void {
    this.entries.push(message)
  }

  dailySummary(hour: number): string {
    const lines = [
      'Vessels in registry: ' + listVessels().length,
      'Berths occupied: ' + occupancy(),
      'Tide at close: ' + tideHeight(hour).toFixed(2) + 'm',
    ]
    for (const line of lines) {
      this.record(line)
    }
    return lines.join('\\n')
  }
}
`

const main = `import { registerVessel } from './registry'
import { assignBerth } from './berths'
import { nextWindow } from './tides'
import { HarborLog } from './log'

export function runHarborDay(): string {
  const log = new HarborLog()
  const meridian = registerVessel('Meridian', 4.2)
  const window = nextWindow(meridian.draft, 6)
  if (assignBerth(meridian.name, 'B-12', window)) {
    log.record('Meridian berthed at B-12')
  }
  return log.dailySummary(18)
}
`

const tideTables = `def lunar_phase(day):
    return (day * 0.0339) % 1.0

def spring_coefficient(day):
    phase = lunar_phase(day)
    return 1.0 + 0.4 * abs(0.5 - phase)

def print_table(days):
    for day in range(days):
        print(day, spring_coefficient(day))

def unused_almanac():
    return 42
`

export const SPECIMEN_FILES: FileEntry[] = [
  { path: 'harbor/registry.ts', text: registry, lang: 'typescript' },
  { path: 'harbor/tides.ts', text: tides, lang: 'typescript' },
  { path: 'harbor/berths.ts', text: berths, lang: 'typescript' },
  { path: 'harbor/log.ts', text: log, lang: 'typescript' },
  { path: 'harbor/main.ts', text: main, lang: 'typescript' },
  // A second, disconnected island in another language: exercises the Python
  // grammar in the browser and gives the sailing directions something to say.
  { path: 'almanac/tide_tables.py', text: tideTables, lang: 'python' },
]

export const SPECIMEN_NAME = 'Specimen: Port Authority'

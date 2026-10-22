import type { WorkerSummary } from './types'

// Distinct non-zero protocol versions across the fleet, with how many workers
// run each. More than one is a mixed-version cluster: a rolling upgrade in
// progress, or a worker left on an older binary. Zero (or an absent field) is
// a peer that predates the version and is not counted.
export function protocolVersions(workers: WorkerSummary[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const w of workers) {
    const v = w.protocol_version ?? 0
    if (v > 0) m.set(v, (m.get(v) ?? 0) + 1)
  }
  return m
}

import { useEffect, useRef, useState } from 'react'
import type { JobOperators } from '@/lib/types'

export type OpRate = { in: number; out: number }

// Records per second per node, derived from the delta between successive
// (monotonic) counter samples of GET /jobs/:id/operators. Counters never
// decrease, so a worker dropping out shows as a dip toward 0, never negative
// (clamped). Shared by the topology overlays and the sources-and-sinks table,
// which read the same query.
export function useOperatorRates(ops: JobOperators | undefined): Record<string, OpRate> {
  const prevRef = useRef<Map<string, { in: number; out: number; ts: number }>>(new Map())
  const [rates, setRates] = useState<Record<string, OpRate>>({})
  useEffect(() => {
    if (!ops) return
    const now = Date.now()
    const next: Record<string, OpRate> = {}
    const nextPrev = new Map<string, { in: number; out: number; ts: number }>()
    for (const o of ops.operators) {
      const p = prevRef.current.get(o.node)
      if (p) {
        const dt = (now - p.ts) / 1000
        if (dt > 0) {
          next[o.node] = {
            in: Math.max(0, (o.records_in - p.in) / dt),
            out: Math.max(0, (o.records_out - p.out) / dt),
          }
        }
      }
      nextPrev.set(o.node, { in: o.records_in, out: o.records_out, ts: now })
    }
    prevRef.current = nextPrev
    // Rates are deltas between successive poll snapshots, so they can only be
    // produced when a new snapshot lands - deriving in render cannot see the
    // previous sample.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRates(next)
  }, [ops])
  return rates
}

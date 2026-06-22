// Minimal Prometheus text-exposition parser. clink's /metrics returns the
// standard text format; this turns it into addressable samples for the metrics
// dashboards. Handles HELP/TYPE comments, labels, and the histogram/summary
// _sum/_count/_bucket suffixes that clink emits as plain counters.

export interface Sample {
  name: string
  labels: Record<string, string>
  value: number
}

export interface MetricFamily {
  name: string
  help?: string
  type?: string
  samples: Sample[]
}

const lineRe = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([^\s]+)(?:\s+\d+)?$/

function parseLabels(blob?: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!blob) return out
  const inner = blob.slice(1, -1).trim()
  if (!inner) return out
  // Split on commas that are not inside quotes.
  const parts = inner.match(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g) ?? []
  for (const p of parts) {
    const m = p.match(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/)
    if (m) out[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return out
}

export function parsePrometheus(text: string): MetricFamily[] {
  const families = new Map<string, MetricFamily>()
  const fam = (name: string): MetricFamily => {
    let f = families.get(name)
    if (!f) {
      f = { name, samples: [] }
      families.set(name, f)
    }
    return f
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      const m = line.match(/^#\s+(HELP|TYPE)\s+(\S+)\s+(.*)$/)
      if (m) {
        const f = fam(m[2])
        if (m[1] === 'HELP') f.help = m[3]
        else f.type = m[3]
      }
      continue
    }
    const m = line.match(lineRe)
    if (!m) continue
    const value = Number(m[3])
    if (Number.isNaN(value)) continue
    // Family key strips known histogram/summary suffixes for grouping in the UI.
    const base = m[1].replace(/_(bucket|sum|count)$/, '')
    fam(base).samples.push({ name: m[1], labels: parseLabels(m[2]), value })
  }
  return [...families.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export interface MetricsView {
  families: MetricFamily[]
  byName: Map<string, MetricFamily>
}

export function toView(text: string): MetricsView {
  const families = parsePrometheus(text)
  return { families, byName: new Map(families.map((f) => [f.name, f])) }
}

// Sum of all samples in a family (e.g. a counter scattered across label sets).
export function familyTotal(v: MetricsView, name: string): number | undefined {
  const f = v.byName.get(name)
  if (!f) return undefined
  return f.samples.reduce((s, x) => s + x.value, 0)
}

// Single scalar value for a family with no (or one) label set.
export function scalar(v: MetricsView, name: string): number | undefined {
  const f = v.byName.get(name)
  if (!f || f.samples.length === 0) return undefined
  return f.samples[0].value
}

// Value of a specific fully-qualified sample (e.g. "clink_ckpt_duration_ms_sum"),
// summed across label sets.
export function sampleTotal(v: MetricsView, fullName: string): number | undefined {
  const base = fullName.replace(/_(bucket|sum|count)$/, '')
  const f = v.byName.get(base)
  if (!f) return undefined
  const matching = f.samples.filter((s) => s.name === fullName)
  if (matching.length === 0) return undefined
  return matching.reduce((s, x) => s + x.value, 0)
}

// Average derived from a *_sum / *_count counter pair (clink emits latency
// histograms this way). Returns undefined when either side is missing/zero.
export function avgFromSumCount(v: MetricsView, base: string): number | undefined {
  const sum = sampleTotal(v, `${base}_sum`)
  const count = sampleTotal(v, `${base}_count`)
  if (sum == null || !count) return undefined
  return sum / count
}

// Presentation formatters.

export function fmtUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 1000)}s`
}

export function fmtTime(tsMs: number): string {
  const d = new Date(tsMs)
  return (
    d.toLocaleTimeString(undefined, { hour12: false }) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  )
}

export function fmtDateTime(tsMs: number): string {
  return new Date(tsMs).toLocaleString(undefined, { hour12: false })
}

export function fmtRelative(tsMs: number, now = Date.now()): string {
  const diff = Math.max(0, now - tsMs)
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function fmtCount(n: number | undefined): string {
  if (n == null) return '-'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

// A records-per-second figure, which is fractional: whole numbers from 10 up,
// and one decimal below that so a slow trickle does not read as zero.
export function fmtRate(perSec: number | undefined): string {
  if (perSec == null || !Number.isFinite(perSec)) return '-'
  if (perSec > 0 && perSec < 10) return perSec.toFixed(1)
  return fmtCount(Math.round(perSec))
}

export function fmtBytes(n: number | undefined): string {
  if (n == null) return '-'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

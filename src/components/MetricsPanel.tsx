import { useMemo, useState } from 'react'
import { ChevronRight, Cpu, HardDrive, MemoryStick, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/StatCard'
import { ErrorState, LoadingState, EmptyState } from '@/components/States'
import { avgFromSumCount, byLabel, familyTotal, toView, type MetricFamily } from '@/lib/prometheus'
import { fmtBytes, fmtCount, fmtMs, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

interface MetricsPanelProps {
  text: string | undefined
  isLoading: boolean
  isError: boolean
  error?: unknown
  // Whose /metrics this is. Checkpoints are counted by the coordinator, and a
  // worker's registry carries the same families at 0, so a worker's panel
  // leaves the checkpoint cards out rather than show zeros that look real.
  scope?: 'coordinator' | 'worker'
}

export function MetricsPanel({
  text,
  isLoading,
  isError,
  error,
  scope = 'coordinator',
}: MetricsPanelProps) {
  const [q, setQ] = useState('')
  const view = useMemo(() => (text ? toView(text) : undefined), [text])

  if (isError) return <ErrorState error={error} />
  if (isLoading || !view) return <LoadingState label="Scraping /metrics" />
  if (view.families.length === 0) return <EmptyState label="No metrics exposed" />

  const ckptDone = familyTotal(view, 'clink_ckpt_completed_total')
  const ckptFailed = familyTotal(view, 'clink_ckpt_failed_total')
  const ckptTriggered = familyTotal(view, 'clink_ckpt_triggered_total')
  const ckptAvgMs = avgFromSumCount(view, 'clink_ckpt_duration_ms')
  type Tone = 'default' | 'ok' | 'warn' | 'danger' | 'info'
  const allCards: { label: string; value: string; tone: Tone; show: boolean }[] = [
    {
      label: 'Checkpoints completed',
      value: fmtCount(ckptDone),
      tone: 'ok',
      show: scope === 'coordinator' && ckptDone != null,
    },
    {
      label: 'Checkpoints failed',
      value: fmtCount(ckptFailed),
      tone: ckptFailed ? 'danger' : 'default',
      show: scope === 'coordinator' && ckptFailed != null,
    },
    {
      label: 'Checkpoints triggered',
      value: fmtCount(ckptTriggered),
      tone: 'info',
      show: scope === 'coordinator' && ckptTriggered != null,
    },
    {
      label: 'Avg checkpoint',
      value: ckptAvgMs != null ? fmtMs(ckptAvgMs) : '-',
      tone: 'default',
      show: scope === 'coordinator' && ckptAvgMs != null,
    },
  ]
  const cards = allCards.filter((c) => c.show)

  const families = view.families.filter(
    (f) =>
      !q ||
      f.name.toLowerCase().includes(q.toLowerCase()) ||
      f.help?.toLowerCase().includes(q.toLowerCase()),
  )

  // Process + host resources (clink_process_* / clink_disk_*). Single-sample
  // gauges, so familyTotal returns the value.
  const rss = familyTotal(view, 'clink_process_resident_memory_bytes')
  const cpuPct = familyTotal(view, 'clink_process_cpu_percent')
  const fds = familyTotal(view, 'clink_process_open_fds')
  const threads = familyTotal(view, 'clink_process_threads')
  // Disk is labeled per volume (workdir, checkpoint, ...). Join total + used by
  // the volume label so each filesystem gets its own card.
  const usedByVol = new Map(
    byLabel(view, 'clink_disk_used_bytes', 'volume').map((d) => [d.key, d.value]),
  )
  const disks = byLabel(view, 'clink_disk_total_bytes', 'volume').map((t) => ({
    volume: t.key || 'disk',
    total: t.value,
    used: usedByVol.get(t.key) ?? 0,
  }))
  const hasSystem = rss != null || cpuPct != null || disks.length > 0

  return (
    <div className="space-y-5">
      {hasSystem && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            System
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {rss != null && (
              <StatCard label="Memory (RSS)" value={fmtBytes(rss)} icon={MemoryStick} tone="info" />
            )}
            {cpuPct != null && (
              <StatCard
                label="CPU"
                value={`${cpuPct}%`}
                sub={cpuPct >= 100 ? `${(cpuPct / 100).toFixed(1)} cores` : 'of one core'}
                icon={Cpu}
                tone={cpuPct >= 90 ? 'warn' : 'default'}
              />
            )}
            {disks.map((d) => {
              const dp = pct(d.used, d.total)
              return (
                <StatCard
                  key={d.volume}
                  label={disks.length > 1 ? `Disk (${d.volume})` : 'Disk'}
                  value={`${dp}%`}
                  sub={`${fmtBytes(d.used)} / ${fmtBytes(d.total)}`}
                  icon={HardDrive}
                  tone={dp >= 85 ? 'danger' : 'default'}
                />
              )
            })}
            {fds != null && <StatCard label="Open FDs" value={fmtCount(fds)} />}
            {threads != null && <StatCard label="Threads" value={fmtCount(threads)} />}
          </div>
        </div>
      )}

      {cards.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((c) => (
            <StatCard key={c.label} label={c.label} value={c.value} tone={c.tone} />
          ))}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Filter ${view.families.length} metric families`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>

      <Card className="divide-y divide-border">
        {families.length === 0 ? (
          <EmptyState label="No metrics match the filter" />
        ) : (
          families.map((f) => <FamilyRow key={f.name} family={f} />)
        )}
      </Card>
    </div>
  )
}

function FamilyRow({ family }: { family: MetricFamily }) {
  const [open, setOpen] = useState(false)
  const total = family.samples.reduce((s, x) => s + x.value, 0)
  const hasLabels =
    family.samples.some((s) => Object.keys(s.labels).length > 0) || family.samples.length > 1
  return (
    <div className="px-4 py-2.5">
      <div
        className={cn('flex items-start gap-3', hasLabels && 'cursor-pointer')}
        role={hasLabels ? 'button' : undefined}
        tabIndex={hasLabels ? 0 : undefined}
        onClick={hasLabels ? () => setOpen((o) => !o) : undefined}
        onKeyDown={
          hasLabels
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setOpen((o) => !o)
                }
              }
            : undefined
        }
      >
        {hasLabels ? (
          <ChevronRight
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90',
            )}
          />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{family.name}</span>
            {family.type && <Badge variant="muted">{family.type}</Badge>}
          </div>
          {family.help && (
            <div className="truncate text-xs text-muted-foreground">{family.help}</div>
          )}
        </div>
        <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
          {fmtCount(total)}
        </span>
      </div>
      {open && hasLabels && (
        <div className="ml-7 mt-2 space-y-1 border-l border-border pl-3">
          {family.samples.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 font-mono text-xs">
              <span className="min-w-0 truncate text-muted-foreground">
                {s.name}
                {Object.keys(s.labels).length > 0 && (
                  <span className="text-primary/80">
                    {'{'}
                    {Object.entries(s.labels)
                      .map(([k, v]) => `${k}="${v}"`)
                      .join(', ')}
                    {'}'}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

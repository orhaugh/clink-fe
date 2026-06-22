import { useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/StatCard'
import { ErrorState, LoadingState, EmptyState } from '@/components/States'
import { avgFromSumCount, familyTotal, toView, type MetricFamily } from '@/lib/prometheus'
import { fmtCount, fmtMs } from '@/lib/format'
import { cn } from '@/lib/utils'

interface MetricsPanelProps {
  text: string | undefined
  isLoading: boolean
  isError: boolean
  error?: unknown
}

export function MetricsPanel({ text, isLoading, isError, error }: MetricsPanelProps) {
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
    { label: 'Checkpoints completed', value: fmtCount(ckptDone), tone: 'ok', show: ckptDone != null },
    { label: 'Checkpoints failed', value: fmtCount(ckptFailed), tone: ckptFailed ? 'danger' : 'default', show: ckptFailed != null },
    { label: 'Checkpoints triggered', value: fmtCount(ckptTriggered), tone: 'info', show: ckptTriggered != null },
    { label: 'Avg checkpoint', value: ckptAvgMs != null ? fmtMs(ckptAvgMs) : '-', tone: 'default', show: ckptAvgMs != null },
  ]
  const cards = allCards.filter((c) => c.show)

  const families = view.families.filter(
    (f) => !q || f.name.toLowerCase().includes(q.toLowerCase()) || f.help?.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="space-y-5">
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
  const hasLabels = family.samples.some((s) => Object.keys(s.labels).length > 0) || family.samples.length > 1
  return (
    <div className="px-4 py-2.5">
      <div
        className={cn('flex items-start gap-3', hasLabels && 'cursor-pointer')}
        onClick={() => hasLabels && setOpen((o) => !o)}
      >
        {hasLabels ? (
          <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{family.name}</span>
            {family.type && <Badge variant="muted">{family.type}</Badge>}
          </div>
          {family.help && <div className="truncate text-xs text-muted-foreground">{family.help}</div>}
        </div>
        <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">{fmtCount(total)}</span>
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
                    {Object.entries(s.labels).map(([k, v]) => `${k}="${v}"`).join(', ')}
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

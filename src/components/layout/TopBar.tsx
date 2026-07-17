import { Radio, Server, Cpu } from 'lucide-react'
import { useCluster, useHealth } from '@/hooks/useApi'
import { useEventsContext } from '@/components/EventsProvider'
import { fmtUptime, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

function ConnDot({ ok, pulse, label }: { ok: boolean; pulse?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          ok ? 'bg-ok' : 'bg-danger',
          ok && pulse && 'animate-pulse-dot',
        )}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  )
}

export function TopBar() {
  const health = useHealth()
  const cluster = useCluster()
  const { state } = useEventsContext()

  const c = cluster.data
  const slotsPct = c ? pct(c.slots_in_use, c.total_slot_capacity) : 0

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Server className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {c ? `${c.advertise_host}:${c.control_port}` : 'Coordinator'}
          </span>
        </div>
        {health.data && (
          <span className="text-xs text-muted-foreground">up {fmtUptime(health.data.uptime_s)}</span>
        )}
      </div>

      <div className="flex items-center gap-5">
        {c && (
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Cpu className="h-4 w-4" />
            <span className="tabular-nums">
              {c.slots_in_use}/{c.total_slot_capacity} slots
            </span>
            <span className="text-muted-foreground/60">({slotsPct}%)</span>
          </div>
        )}
        <ConnDot
          ok={!health.isError && !!health.data?.ok}
          pulse
          label={health.isError ? 'coordinator unreachable' : 'coordinator healthy'}
        />
        <span className="inline-flex items-center gap-1.5">
          <Radio className={cn('h-3.5 w-3.5', state === 'open' ? 'text-ok' : 'text-muted-foreground')} />
          <span className="text-xs text-muted-foreground">
            {state === 'open' ? 'live' : state === 'connecting' ? 'connecting' : 'offline'}
          </span>
        </span>
      </div>
    </header>
  )
}

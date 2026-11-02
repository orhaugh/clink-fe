import { Radio, Server, Cpu } from 'lucide-react'
import { useCluster, useHealth } from '@/hooks/useApi'
import { useAuthToken } from '@/hooks/useAuthToken'
import { useEventsContext } from '@/components/EventsProvider'
import { coordinatorStatus, type CoordinatorTone } from '@/lib/connection'
import { fmtUptime, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

const DOT: Record<CoordinatorTone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  idle: 'bg-muted-foreground',
}

function ConnDot({
  tone,
  pulse,
  label,
}: {
  tone: CoordinatorTone
  pulse?: boolean
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          DOT[tone],
          tone === 'ok' && pulse && 'animate-pulse-dot',
        )}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  )
}

export function TopBar() {
  const health = useHealth()
  const cluster = useCluster()
  const token = useAuthToken()
  const { state } = useEventsContext()

  const c = cluster.data
  const slotsPct = c ? pct(c.slots_in_use, c.total_slot_capacity) : 0
  const status = coordinatorStatus(health, token !== '')

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
          <span className="text-xs text-muted-foreground">
            up {fmtUptime(health.data.uptime_s)}
          </span>
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
        <ConnDot tone={status.tone} pulse label={status.label} />
        <span className="inline-flex items-center gap-1.5">
          <Radio
            className={cn('h-3.5 w-3.5', state === 'open' ? 'text-ok' : 'text-muted-foreground')}
          />
          <span className="text-xs text-muted-foreground">
            {state === 'open' ? 'live' : state === 'connecting' ? 'connecting' : 'offline'}
          </span>
        </span>
      </div>
    </header>
  )
}

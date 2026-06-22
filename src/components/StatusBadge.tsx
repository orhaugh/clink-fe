import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { JobState } from '@/lib/types'

const dot = 'mr-1.5 inline-block h-1.5 w-1.5 rounded-full'

const jobVariant: Record<JobState, { variant: 'ok' | 'info' | 'danger' | 'muted'; dot: string; label: string }> = {
  running: { variant: 'info', dot: 'bg-info animate-pulse-dot', label: 'Running' },
  completed: { variant: 'ok', dot: 'bg-ok', label: 'Completed' },
  failed: { variant: 'danger', dot: 'bg-danger', label: 'Failed' },
  cancelled: { variant: 'muted', dot: 'bg-muted-foreground', label: 'Cancelled' },
}

export function JobStateBadge({ state }: { state: JobState }) {
  const s = jobVariant[state]
  return (
    <Badge variant={s.variant}>
      <span className={cn(dot, s.dot)} />
      {s.label}
    </Badge>
  )
}

export function TmStateBadge({ lost }: { lost: boolean }) {
  return lost ? (
    <Badge variant="danger">
      <span className={cn(dot, 'bg-danger')} />
      Lost
    </Badge>
  ) : (
    <Badge variant="ok">
      <span className={cn(dot, 'bg-ok')} />
      Live
    </Badge>
  )
}

export function SubtaskStatusBadge({ status }: { status: string }) {
  const ready = status === 'ready'
  return (
    <Badge variant={ready ? 'ok' : 'warn'}>
      <span className={cn(dot, ready ? 'bg-ok' : 'bg-warn')} />
      {status}
    </Badge>
  )
}

const logToneClass: Record<string, string> = {
  error: 'text-danger',
  warn: 'text-warn',
  info: 'text-info',
  debug: 'text-muted-foreground',
}

export function LogLevelBadge({ level }: { level: string }) {
  return (
    <span className={cn('font-mono text-xs uppercase', logToneClass[level] ?? 'text-foreground')}>{level}</span>
  )
}

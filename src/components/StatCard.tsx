import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: LucideIcon
  tone?: 'default' | 'ok' | 'warn' | 'danger' | 'info'
}

const toneText: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-foreground',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-info',
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'default' }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={cn('text-2xl font-semibold tabular-nums', toneText[tone])}>{value}</div>
          {sub != null && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
        {Icon && <Icon className="h-5 w-5 text-muted-foreground/70" />}
      </div>
    </Card>
  )
}

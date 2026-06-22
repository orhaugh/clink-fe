import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LoadingState({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground', className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}...
    </div>
  )
}

export function ErrorState({ error, className }: { error: unknown; className?: string }) {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      <AlertTriangle className="h-6 w-6 text-danger" />
      <div className="text-sm font-medium text-danger">Request failed</div>
      <div className="max-w-md font-mono text-xs text-muted-foreground">{msg}</div>
      <div className="mt-1 max-w-md text-xs text-muted-foreground">
        Is a JobManager reachable at the configured target? See README for the dev proxy setup.
      </div>
    </div>
  )
}

export function EmptyState({ label, hint, className }: { label: string; hint?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      <Inbox className="h-6 w-6 text-muted-foreground/60" />
      <div className="text-sm text-muted-foreground">{label}</div>
      {hint && <div className="max-w-md text-xs text-muted-foreground/80">{hint}</div>}
    </div>
  )
}

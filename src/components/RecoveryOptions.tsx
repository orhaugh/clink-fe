import { useState } from 'react'
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  BARRIER_ALIGNMENTS,
  describeRecovery,
  type BarrierAlignment,
  type RecoveryOptions,
} from '@/lib/recovery'

// The per-job recovery options a submission carries (see lib/recovery.ts).
// Collapsed by default behind a one-line summary that always states the
// consequence of the current choice, because the silent failure this guards
// against is a job that runs, produces output, and could never recover.
export function RecoveryOptionsFields({
  value,
  onChange,
  idPrefix,
  className,
}: {
  value: RecoveryOptions
  onChange: (next: RecoveryOptions) => void
  idPrefix: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const set = <K extends keyof RecoveryOptions>(k: K, v: RecoveryOptions[K]) =>
    onChange({ ...value, [k]: v })
  const num = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s))
  const id = (f: string) => `${idPrefix}-${f}`

  return (
    <div className={cn('rounded-md border border-border/60', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-medium">Recovery</span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-xs',
            value.checkpoint_dir?.trim() ? 'text-muted-foreground' : 'text-warn',
          )}
        >
          {describeRecovery(value)}
        </span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-border/60 px-3 py-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={id('checkpoint-dir')}>Checkpoint directory</Label>
            <Input
              id={id('checkpoint-dir')}
              placeholder="/var/lib/clink/checkpoints (a path the workers can write)"
              value={value.checkpoint_dir ?? ''}
              onChange={(e) => set('checkpoint_dir', e.target.value)}
              className="h-9 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Without one the job never checkpoints: exactly-once sinks never commit and a worker
              loss is not recoverable.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor={id('interval')}>Checkpoint interval (ms)</Label>
            <Input
              id={id('interval')}
              type="number"
              min={0}
              placeholder="coordinator default"
              value={value.checkpoint_interval_ms ?? ''}
              onChange={(e) => set('checkpoint_interval_ms', num(e.target.value))}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={id('restarts')}>Max restarts on worker loss</Label>
            <Input
              id={id('restarts')}
              type="number"
              min={0}
              placeholder="coordinator default"
              value={value.max_restarts_on_worker_loss ?? ''}
              onChange={(e) => set('max_restarts_on_worker_loss', num(e.target.value))}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={id('backend')}>State backend URI</Label>
            <Input
              id={id('backend')}
              placeholder="e.g. rocksdb:///var/lib/clink/state (default: the coordinator's)"
              value={value.state_backend ?? ''}
              onChange={(e) => set('state_backend', e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={id('alignment')}>Barrier alignment</Label>
            <Select
              value={value.alignment ?? 'default'}
              onValueChange={(v) =>
                set('alignment', v === 'default' ? undefined : (v as BarrierAlignment))
              }
            >
              <SelectTrigger id={id('alignment')} className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">coordinator default</SelectItem>
                {BARRIER_ALIGNMENTS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={id('restore-dir')}>Restore from directory</Label>
            <Input
              id={id('restore-dir')}
              placeholder="a previous checkpoint directory (optional)"
              value={value.restore_from_dir ?? ''}
              onChange={(e) => set('restore_from_dir', e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={id('restore-id')}>Restore checkpoint id</Label>
            <Input
              id={id('restore-id')}
              type="number"
              min={0}
              placeholder="latest completed"
              value={value.restore_from_checkpoint_id ?? ''}
              onChange={(e) => set('restore_from_checkpoint_id', num(e.target.value))}
              className="h-9"
            />
          </div>
        </div>
      )}
    </div>
  )
}

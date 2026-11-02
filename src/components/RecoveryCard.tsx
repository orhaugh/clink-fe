import { ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GuaranteeBadge } from '@/components/StatusBadge'
import { describeJobGuarantee } from '@/lib/guarantees'
import { fmtMs } from '@/lib/format'
import { describeRestarts } from '@/lib/recovery'
import type { JobDetail } from '@/lib/types'

// What the job is actually running with, and what the coordinator's analyser
// concluded it promises. Both come from GET /jobs/:id; a coordinator that
// predates the fields gets a short note instead of invented values.
export function RecoveryCard({ job }: { job: JobDetail }) {
  const hasConfig = job.checkpoint_dir !== undefined
  const checkpointing = !!job.checkpoint_dir
  const guarantee = describeJobGuarantee(job.delivery_guarantee)
  const reasons = job.guarantee_reasons ?? []
  const warnings = job.guarantee_warnings ?? []
  const barrierMode = job.adaptive_barrier_mode
    ? 'adaptive (chosen per trigger from measured pressure)'
    : job.unaligned_checkpoints
      ? 'unaligned'
      : 'aligned'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Recovery &amp; delivery guarantee
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <GuaranteeBadge
            level={job.delivery_guarantee}
            limitingFactor={job.guarantee_limiting_factor}
          />
          {guarantee ? (
            <span className="text-sm text-muted-foreground">
              {guarantee.label}
              {job.guarantee_limiting_factor && (
                <>
                  {' '}
                  Limited by <span className="font-mono">{job.guarantee_limiting_factor}</span>.
                </>
              )}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              This coordinator does not report the job&apos;s delivery guarantee.
            </span>
          )}
        </div>

        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-md border border-warn/40 bg-warn/[0.06] px-3 py-2 text-xs text-warn">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {hasConfig ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
            <Field label="Checkpointing">
              {checkpointing ? (
                <Badge variant="ok">on</Badge>
              ) : (
                <Badge variant="warn">off (no checkpoint directory)</Badge>
              )}
            </Field>
            <Field label="Checkpoint directory" mono>
              {job.checkpoint_dir || '-'}
            </Field>
            <Field label="Interval" mono>
              {checkpointing && job.checkpoint_interval_ms
                ? fmtMs(job.checkpoint_interval_ms)
                : '-'}
            </Field>
            <Field label="State backend" mono>
              {job.state_backend_uri || 'coordinator default'}
            </Field>
            <Field label="Barrier mode">{checkpointing ? barrierMode : '-'}</Field>
            <Field label="Restarts on worker loss" mono>
              {describeRestarts(job)}
            </Field>
            <Field label="Restored from" mono>
              {job.restore_from_dir
                ? `${job.restore_from_dir}${job.restore_from_checkpoint_id ? ` @ ${job.restore_from_checkpoint_id}` : ''}`
                : 'fresh start'}
            </Field>
            <Field label="Latest completed checkpoint" mono>
              {job.latest_completed_checkpoint_id || '-'}
            </Field>
            <Field label="Pending checkpoints" mono>
              {job.pending_checkpoint_ids.length > 0
                ? job.pending_checkpoint_ids.join(', ')
                : 'none'}
            </Field>
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">
            This coordinator does not report the checkpoint configuration a job runs with.
          </p>
        )}

        {reasons.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              How the analyser reached this level ({reasons.length})
            </summary>
            <ul className="mt-2 space-y-1 font-mono text-muted-foreground">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? 'mt-0.5 break-all font-mono text-xs' : 'mt-0.5 text-xs'}>{children}</dd>
    </div>
  )
}

import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Camera,
  GitCommitHorizontal,
  Scaling,
  ShieldCheck,
} from 'lucide-react'
import {
  useJob,
  useJobGraph,
  useJobLineage,
  useJobOperators,
  useCancelJob,
  useRescaleJob,
  useSavepointJob,
} from '@/hooks/useApi'
import { LineagePanel } from '@/components/LineagePanel'
import { EndpointsPanel } from '@/components/EndpointsPanel'
import { RecoveryCard } from '@/components/RecoveryCard'
import { OperatorDetail } from '@/components/OperatorDetail'
import { useOperatorRates } from '@/hooks/useOperatorRates'
import { describeJobGuarantee } from '@/lib/guarantees'
import { STREAMING_HINT, jobProgress } from '@/lib/progress'
import type { OperatorRuntime } from '@/lib/types'

// Lazy so React Flow + dagre (their own chunk) only load when a job's graph is
// actually viewed, not on every page.
const JobGraph = lazy(() => import('@/components/JobGraph').then((m) => ({ default: m.JobGraph })))
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ErrorState, LoadingState, EmptyState } from '@/components/States'
import { JobStateBadge } from '@/components/StatusBadge'
import { toast } from '@/components/ui/sonner'
import { deriveJobState, type JobDetail as JobDetailT, type JobState } from '@/lib/types'
import { fmtDateTime } from '@/lib/format'
import { roleHint, roleLabel } from '@/lib/roles'

export function JobDetail() {
  const { id = '0' } = useParams()
  const jobId = Number(id)
  const job = useJob(jobId)
  // Shared with the lineage and endpoint panels below: one request per job. A
  // job known only from its history record has no lineage to ask for.
  const lineage = useJobLineage(jobId, job.data !== undefined && !job.data.from_history)

  if (job.isError) return <ErrorState error={job.error} />
  if (job.isLoading || !job.data) return <LoadingState />

  const j = job.data
  const state = deriveJobState(j)
  if (j.from_history) return <JobRecord job={j} state={state} />
  const progress = jobProgress(j, lineage.data)
  const guarantee = describeJobGuarantee(j.delivery_guarantee)

  return (
    <div className="space-y-6">
      <PageHeader
        title={<JobTitle job={j} state={state} />}
        actions={<JobActions job={j} running={state === 'running'} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Progress"
          value={
            progress.kind === 'streaming' ? (
              <span title={STREAMING_HINT}>streaming</span>
            ) : progress.kind === 'share' ? (
              `${progress.pct}%`
            ) : (
              '-'
            )
          }
          sub={
            progress.kind === 'streaming'
              ? 'runs until it is stopped'
              : progress.kind === 'share'
                ? `${progress.done}/${progress.total} subtasks`
                : ''
          }
          tone="info"
        />
        <StatCard label="Subtasks" value={j.tasks.length} />
        <StatCard
          label="Delivery guarantee"
          value={<span className="text-base">{guarantee ? guarantee.short : 'not reported'}</span>}
          sub={
            j.guarantee_limiting_factor
              ? `limited by ${j.guarantee_limiting_factor}`
              : guarantee
                ? 'nothing limits it'
                : 'older coordinator'
          }
          icon={ShieldCheck}
          tone={guarantee ? (guarantee.tone === 'muted' ? 'default' : guarantee.tone) : 'default'}
        />
        <StatCard
          label="Latest checkpoint"
          value={j.latest_completed_checkpoint_id || '-'}
          sub={
            j.pending_checkpoint_ids.length > 0
              ? `${j.pending_checkpoint_ids.length} pending`
              : 'none pending'
          }
          icon={GitCommitHorizontal}
        />
        <StatCard
          label="Failures"
          value={j.subtask_errors.length || j.errors.length}
          tone={j.errors.length > 0 ? 'danger' : 'ok'}
        />
      </div>

      <GraphSection jobId={j.id} />

      <EndpointsPanel jobId={j.id} />

      <RecoveryCard job={j} />

      <LineagePanel jobId={j.id} />

      <FailuresPanel job={j} />

      <Card>
        <CardHeader>
          <CardTitle>Subtask placement</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {j.tasks.length === 0 ? (
            <EmptyState label="No subtasks deployed" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Subtask</TableHead>
                  <TableHead>Worker</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {j.tasks.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs" title={roleHint(t.role)}>
                      {roleLabel(t.role)}
                    </TableCell>
                    <TableCell className="tabular-nums">{t.subtask_idx}</TableCell>
                    <TableCell>
                      {t.worker_id ? (
                        <Link
                          to={`/workers/${t.worker_id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {t.worker_id}
                        </Link>
                      ) : (
                        <Badge variant="muted">unassigned</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function JobTitle({ job: j, state }: { job: JobDetailT; state: JobState }) {
  return (
    <span className="flex items-center gap-3">
      <Link to="/jobs" className="text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <span className="font-mono">Job #{j.id}</span>
      {j.name ? <span className="text-muted-foreground">{j.name}</span> : null}
      <JobStateBadge state={state} />
    </span>
  )
}

// A job that ended under an earlier Coordinator: this one read back its history
// record and nothing else, so there is no graph, subtask, lineage or
// configuration to show, and no action to take.
function JobRecord({ job: j, state }: { job: JobDetailT; state: JobState }) {
  const stoppedAt = j.stopped_at_checkpoint_id ?? 0
  return (
    <div className="space-y-6">
      <PageHeader title={<JobTitle job={j} state={state} />} />
      <Card>
        <CardHeader>
          <CardTitle>Known from its record</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This job ended under an earlier Coordinator. This one keeps its record: how it ended, its
          errors and its checkpoints. Its graph, subtasks and configuration ended with it.
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Latest checkpoint"
          value={j.latest_completed_checkpoint_id || '-'}
          icon={GitCommitHorizontal}
        />
        <StatCard
          label="Stopped at"
          value={stoppedAt || '-'}
          sub={stoppedAt > 0 ? 'a graceful stop' : 'not stopped'}
        />
        <StatCard
          label="Failures"
          value={j.errors.length}
          tone={j.errors.length > 0 ? 'danger' : 'ok'}
        />
      </div>
      <FailuresPanel job={j} />
    </div>
  )
}

function JobActions({ job, running }: { job: JobDetailT; running: boolean }) {
  const cancel = useCancelJob()
  const savepoint = useSavepointJob()

  const onSavepoint = async () => {
    const t = toast.loading(`Taking savepoint of job #${job.id}...`)
    const ack = await savepoint.mutateAsync({ id: job.id })
    if (ack.ok) {
      toast.success(`Savepoint ${ack.checkpoint_id}`, {
        id: t,
        description: ack.checkpoint_dir || ack.message,
      })
    } else {
      toast.error('Savepoint failed', { id: t, description: ack.message })
    }
  }

  const onCancel = async () => {
    const ack = await cancel.mutateAsync(job.id)
    if (ack.ok) toast.success(`Job #${job.id} cancelling`, { description: ack.message })
    else toast.error('Cancel failed', { description: ack.message })
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onSavepoint} disabled={savepoint.isPending}>
        <Camera className="h-4 w-4" />
        Savepoint
      </Button>
      <RescaleDialog job={job} disabled={!running} />
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={!running || cancel.isPending}>
            <Ban className="h-4 w-4" />
            Cancel
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel job #{job.id}?</DialogTitle>
            <DialogDescription>
              Requests a graceful cancel. Subtasks drain via their cancellation paths; the job will
              not restart.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Keep running
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" size="sm" onClick={onCancel}>
                Cancel job
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RescaleDialog({ job, disabled }: { job: JobDetailT; disabled: boolean }) {
  // Current parallelism per role = count of that role's subtasks.
  const current: Record<string, number> = {}
  for (const t of job.tasks) current[t.role] = (current[t.role] ?? 0) + 1
  const roles = Object.keys(current).sort()

  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<Record<string, number>>(current)
  const rescale = useRescaleJob()

  const onOpen = (o: boolean) => {
    if (o) setTargets(current)
    setOpen(o)
  }

  const onSubmit = async () => {
    const ack = await rescale.mutateAsync({ id: job.id, roleParallelism: targets })
    if (ack.ok) toast.success(`Job #${job.id} rescaled`, { description: ack.message })
    else toast.error('Rescale rejected', { description: ack.message })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Scaling className="h-4 w-4" />
          Rescale
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rescale job #{job.id}</DialogTitle>
          <DialogDescription>
            Set a new parallelism per role. Scale-up only: each value must be a positive multiple of
            the current parallelism. Keyed state is preserved across the rescale.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {roles.length === 0 ? (
            <EmptyState label="No roles to rescale" />
          ) : (
            roles.map((role) => (
              <div key={role} className="flex items-center justify-between gap-4">
                <Label className="font-mono">{role}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">now {current[role]}</span>
                  <Input
                    type="number"
                    min={current[role]}
                    className="w-24"
                    value={targets[role] ?? current[role]}
                    onChange={(e) => setTargets((p) => ({ ...p, [role]: Number(e.target.value) }))}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" onClick={onSubmit} disabled={rescale.isPending || roles.length === 0}>
            {rescale.isPending ? 'Rescaling...' : 'Apply rescale'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GraphSection({ jobId }: { jobId: number }) {
  const graph = useJobGraph(jobId)
  const ops = useJobOperators(jobId)
  const [selected, setSelected] = useState<string | null>(null)

  // Map node id -> live stats; records/sec comes from the shared rate hook.
  const statsByNode = useMemo(() => {
    const m: Record<string, OperatorRuntime> = {}
    for (const o of ops.data?.operators ?? []) m[o.node] = o
    return m
  }, [ops.data])
  const rates = useOperatorRates(ops.data)

  const selectedOp = selected ? (statsByNode[selected] ?? null) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topology</CardTitle>
      </CardHeader>
      <CardContent>
        {graph.isError ? (
          <ErrorState error={graph.error} />
        ) : graph.isLoading || !graph.data ? (
          <LoadingState label="Loading graph" />
        ) : !graph.data.available || graph.data.nodes.length === 0 ? (
          <EmptyState
            label="No topology for this job"
            hint="The job graph is retained from submission; jobs submitted before graph retention show nothing here."
          />
        ) : (
          <>
            <Suspense fallback={<LoadingState label="Loading graph" />}>
              <JobGraph
                graph={graph.data}
                statsByNode={statsByNode}
                ratesByNode={rates}
                onSelect={setSelected}
              />
            </Suspense>
            <OperatorDetail
              op={selectedOp}
              asOfMs={ops.dataUpdatedAt}
              onClose={() => setSelected(null)}
            />
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <Legend swatch="bg-info" label="source" />
              <Legend swatch="bg-ok" label="sink" />
              <Legend swatch="bg-warn" label="keyed (key glyph)" />
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-muted-foreground" /> forward
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 border-t border-dashed border-warn" />{' '}
                rebalance
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-primary" /> hash-partitioned
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-ok" /> backpressure
                (green/amber/red)
              </span>
              <span>▸/s = records per second; click a node for detail</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${swatch}`} />
      {label}
    </span>
  )
}

function FailuresPanel({ job }: { job: JobDetailT }) {
  if (job.subtask_errors.length === 0 && job.errors.length === 0) return null

  return (
    <Card className="border-danger/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-danger">
          <AlertTriangle className="h-4 w-4" />
          Failures &amp; stack traces
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {job.subtask_errors.length > 0
          ? job.subtask_errors.map((se, i) => (
              <div key={i} className="rounded-md border border-danger/30 bg-danger/[0.05]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-danger/20 px-3 py-2 text-xs">
                  <span className="font-mono font-medium text-danger">
                    {roleLabel(se.role)}[{se.subtask_idx}]
                  </span>
                  {se.worker_id && (
                    <Link
                      to={`/workers/${se.worker_id}`}
                      className="font-mono text-primary hover:underline"
                    >
                      {se.worker_id}
                    </Link>
                  )}
                  <Badge variant="muted">attempt {se.attempt}</Badge>
                  {se.ts_ms > 0 && (
                    <span className="text-muted-foreground">{fmtDateTime(se.ts_ms)}</span>
                  )}
                </div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs text-danger/90">
                  {se.message}
                </pre>
              </div>
            ))
          : job.errors.map((e, i) => (
              <pre
                key={i}
                className="overflow-auto whitespace-pre-wrap rounded-md border border-danger/30 bg-danger/[0.05] p-3 font-mono text-xs text-danger/90"
              >
                {e}
              </pre>
            ))}
        <p className="text-xs text-muted-foreground">
          Messages carry the operator exception text and, where the node toolchain supports it, a
          capture-site stack trace. The trace is taken in the runner thread (post-unwind), so it
          shows the runner to operator call chain rather than the exact throw frame.
        </p>
      </CardContent>
    </Card>
  )
}
